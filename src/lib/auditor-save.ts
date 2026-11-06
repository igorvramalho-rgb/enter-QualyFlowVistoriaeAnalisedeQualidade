import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo-storage";
import { extractAuditorDocument, AUDITOR_FIELDS } from "@/lib/auditor-pdf";
import type { AuditorExtraction, AuditorItem } from "@/lib/auditor-pdf";
import type { AnalysisStatus, CaseOutcome, CellKey } from "@/lib/auditor";

/** Situação inicial sugerida por célula (o usuário pode mudar depois). */
const STATUS_BY_CELL: Record<CellKey, AnalysisStatus> = {
  fiscalizacao: "encaminhado_fiscalizacao",
  refazer: "encaminhado_refazer",
  respondidos: "resposta_enviada",
  rpa: "em_analise",
  nao_avaliado: "necessita_esclarecimento",
};

/** N/A nunca vira conformidade nem não conformidade confirmada. */
const OUTCOME_BY_CELL: Record<CellKey, CaseOutcome> = {
  fiscalizacao: "pendente",
  refazer: "nao_conforme",
  respondidos: "conforme",
  rpa: "pendente",
  nao_avaliado: "pendente",
};

/**
 * Persistência do Qualy Auditor.
 *
 * Ordem segura: o documento é registrado **antes** do upload do PDF. Assim,
 * qualquer falha deixa uma linha identificável (`upload_status = "pendente"`)
 * com nome do arquivo e fingerprint — nunca um arquivo anônimo no bucket.
 */

const AUDITOR_PREFIX = "qualyflow/auditor";
const SIGNED_TTL_SECONDS = 60 * 60 * 12;

export interface ExistingDocument {
  id: string;
  fileName: string;
  importedAt: string;
  uploadStatus: string;
  fingerprint: string;
}

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error));
}

export function originalPdfPath(documentId: string): string {
  return `${AUDITOR_PREFIX}/${documentId}/original.pdf`;
}

/** Fingerprints já registrados — deduplicação em lote com uma única consulta. */
export async function fetchAllFingerprints(): Promise<Set<string>> {
  const { data, error } = await supabase.from("qa_documents").select("fingerprint").limit(5000);
  if (error) {
    fail(error);
  }
  return new Set((data ?? []).map((row) => String(row.fingerprint)));
}

export async function findDocumentByFingerprint(
  fingerprint: string,
): Promise<ExistingDocument | null> {
  const { data, error } = await supabase
    .from("qa_documents")
    .select("id, file_name, imported_at, upload_status, fingerprint")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    fail(error);
  }

  return data
    ? {
        id: data.id,
        fileName: data.file_name,
        importedAt: data.imported_at,
        uploadStatus: data.upload_status ?? "concluido",
        fingerprint: data.fingerprint,
      }
    : null;
}

async function upload(documentId: string, file: File): Promise<string> {
  const path = originalPdfPath(documentId);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    fail(error);
  }
  return path;
}

export async function signedPdfUrl(path: string): Promise<string | null> {
  if (!path) {
    return null;
  }
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error) {
    return null;
  }
  return data?.signedUrl ?? null;
}

export interface ConfirmInput {
  extraction: AuditorExtraction;
  file: File;
  fields: Record<string, string>;
  items: AuditorItem[];
  /** Célula escolhida manualmente no momento da importação. */
  cell: CellKey;
}

export interface ConfirmResult {
  documentId: string;
  caseId: string | null;
  uploadOk: boolean;
  uploadError: string;
}

export async function confirmAuditorDocument(input: ConfirmInput): Promise<ConfirmResult> {
  const { extraction, file, fields, items, cell } = input;
  const documentId = crypto.randomUUID();

  // 1) Registro primeiro (identificável mesmo se o upload falhar).
  const { error: documentError } = await supabase.from("qa_documents").insert({
    id: documentId,
    fingerprint: extraction.fingerprint,
    file_name: extraction.fileName,
    pdf_path: "",
    pages: extraction.pages,
    fields,
    confidence: {},
    snippet: "",
    source: extraction.usedOcr ? "texto+ocr" : extraction.textAvailable ? "texto" : "sem-texto",
    text_available: extraction.textAvailable,
    upload_status: "pendente",
    upload_error: "",
  });

  if (documentError) {
    fail(documentError);
  }

  // 2) Upload do PDF original.
  let uploadOk = true;
  let uploadError = "";
  try {
    const path = await upload(documentId, file);
    await supabase
      .from("qa_documents")
      .update({ pdf_path: path, upload_status: "concluido", upload_error: "" })
      .eq("id", documentId);
  } catch (problem) {
    uploadOk = false;
    uploadError = problem instanceof Error ? problem.message : "Falha no envio do PDF";
    await supabase
      .from("qa_documents")
      .update({ upload_status: "pendente", upload_error: uploadError })
      .eq("id", documentId);
  }

  // 3) Etapas avaliadas (classificação original intocada).
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("qa_document_items").insert(
      items.map((item) => ({
        document_id: documentId,
        code: item.code,
        description: item.description,
        original_result: item.originalResult,
        complement: item.complement,
        page_number: item.page,
      })),
    );
    if (itemsError) {
      fail(itemsError);
    }
  }

  // 4) Tratativa única por FV/OS.
  let caseId: string | null = null;
  const fac = (fields.fac ?? "").trim();
  const os = (fields.os ?? "").trim();

  if (fac || os) {
    const { data: existing, error: findError } = await supabase
      .from("qa_cases")
      .select("id")
      .eq("fac", fac)
      .eq("os", os)
      .maybeSingle();

    if (findError) {
      fail(findError);
    }

    if (existing) {
      caseId = existing.id;
      await supabase
        .from("qa_cases")
        .update({
          document_id: documentId,
          cell,
          analysis_status: STATUS_BY_CELL[cell],
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId);
    } else {
      const { data: created, error: caseError } = await supabase
        .from("qa_cases")
        .insert({
          document_id: documentId,
          fac,
          os,
          address: (fields.endereco ?? "").trim(),
          municipality: (fields.municipio ?? "").trim(),
          locality: (fields.localidade ?? "").trim(),
          service_type: (fields.servico ?? "").trim(),
          contractor: (fields.contratada ?? "").trim(),
          analysis_status: STATUS_BY_CELL[cell],
          outcome: OUTCOME_BY_CELL[cell],
          cell,
        })
        .select("id")
        .single();

      if (caseError) {
        fail(caseError);
      }
      caseId = created?.id ?? null;
    }
  }

  if (caseId) {
    await supabase.from("qa_case_events").insert({
      case_id: caseId,
      event_type: "recebimento",
      payload: {
        documentId,
        fileName: extraction.fileName,
        pages: extraction.pages,
        uploadOk,
      } as never,
    });
  }

  return { documentId, caseId, uploadOk, uploadError };
}

/** Retoma o upload de um documento registrado que ficou pendente. */
export async function retryPendingUpload(
  documentId: string,
  fingerprint: string,
  file: File,
): Promise<{ ok: boolean; message: string }> {
  try {
    const path = await upload(documentId, file);
    const { error } = await supabase
      .from("qa_documents")
      .update({ pdf_path: path, upload_status: "concluido", upload_error: "", fingerprint })
      .eq("id", documentId);
    if (error) {
      fail(error);
    }
    return { ok: true, message: "PDF enviado e vínculo concluído." };
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Falha no envio";
    await supabase
      .from("qa_documents")
      .update({ upload_status: "pendente", upload_error: message })
      .eq("id", documentId);
    return { ok: false, message };
  }
}

/* ------------------------------------------------------- importação em lote */

export interface BatchProgress {
  done: number;
  total: number;
  name: string;
}

export interface BatchResult {
  registrados: number;
  duplicados: number;
  falhas: number;
  pendentes: number;
  primeiroErro: string;
}

const CONCURRENCY = 4;
const ITEM_CHUNK = 100;
const EVENT_CHUNK = 100;

interface Prepared {
  documentId: string;
  fields: Record<string, string>;
  items: AuditorItem[];
  fileName: string;
  pages: number;
  fac: string;
  os: string;
  uploadOk: boolean;
}

/** Importa vários PDFs: extração em paralelo, gravação em massa. */
export async function importAuditorBatch(params: {
  files: File[];
  cell: CellKey;
  ocr: boolean;
  onProgress?: (progress: BatchProgress) => void;
  shouldCancel?: () => boolean;
}): Promise<BatchResult> {
  const { files, cell, ocr, onProgress, shouldCancel } = params;

  const resultado: BatchResult = {
    registrados: 0,
    duplicados: 0,
    falhas: 0,
    pendentes: 0,
    primeiroErro: "",
  };

  const [fingerprints, casos] = await Promise.all([
    fetchAllFingerprints(),
    supabase.from("qa_cases").select("id, fac, os").limit(5000),
  ]);

  if (casos.error) {
    fail(casos.error);
  }

  const vistos = new Set(fingerprints);
  const mapaCasos = new Map<string, string>();
  for (const row of casos.data ?? []) {
    mapaCasos.set(`${row.fac}|${row.os}`, row.id);
  }

  const chave = (fac: string, os: string) => `${fac.trim()}|${os.trim()}`;
  const preparados: Prepared[] = [];
  let concluidos = 0;

  // Extração + gravação do documento em paralelo (limite de 4 simultâneos).
  const fila = [...files];

  const trabalhar = async (): Promise<void> => {
    for (;;) {
      if (shouldCancel?.()) {
        return;
      }
      const file = fila.shift();
      if (!file) {
        return;
      }
      try {
        const extraction = await extractAuditorDocument(file, { ocr });

        if (vistos.has(extraction.fingerprint)) {
          resultado.duplicados += 1;
          return;
        }
        vistos.add(extraction.fingerprint);

        const fields = Object.fromEntries(
          AUDITOR_FIELDS.map(({ key }) => [key, extraction.fields[key].value]),
        );
        const documentId = crypto.randomUUID();

        const { error: docError } = await supabase.from("qa_documents").insert({
          id: documentId,
          fingerprint: extraction.fingerprint,
          file_name: extraction.fileName,
          pdf_path: "",
          pages: extraction.pages,
          fields,
          confidence: {},
          snippet: "",
          source: extraction.usedOcr
            ? "texto+ocr"
            : extraction.textAvailable
              ? "texto"
              : "sem-texto",
          text_available: extraction.textAvailable,
          upload_status: "pendente",
          upload_error: "",
        });

        if (docError) {
          fail(docError);
        }

        let uploadOk = true;
        try {
          const path = await upload(documentId, file);
          await supabase
            .from("qa_documents")
            .update({ pdf_path: path, upload_status: "concluido" })
            .eq("id", documentId);
        } catch {
          uploadOk = false;
        }

        preparados.push({
          documentId,
          fields,
          items: extraction.items,
          fileName: extraction.fileName,
          pages: extraction.pages,
          fac: (fields.fac ?? "").trim(),
          os: (fields.os ?? "").trim(),
          uploadOk,
        });

        resultado.registrados += 1;
        if (!uploadOk) resultado.pendentes += 1;
      } catch (problem) {
        resultado.falhas += 1;
        if (!resultado.primeiroErro) {
          resultado.primeiroErro = `${file.name}: ${
            problem instanceof Error ? problem.message : "erro desconhecido"
          }`;
        }
      } finally {
        concluidos += 1;
        onProgress?.({ done: concluidos, total: files.length, name: file.name });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fila.length) }, () => trabalhar()));

  // Etapas avaliadas em massa (1 chamada por 100 documentos).
  const itens = preparados.flatMap((doc) =>
    doc.items.map((item) => ({
      document_id: doc.documentId,
      code: item.code,
      description: item.description,
      original_result: item.originalResult,
      complement: item.complement,
      page_number: item.page,
    })),
  );

  for (let index = 0; index < itens.length; index += ITEM_CHUNK) {
    const { error } = await supabase
      .from("qa_document_items")
      .insert(itens.slice(index, index + ITEM_CHUNK));
    if (error) {
      fail(error);
    }
  }

  // Tratativas: reaproveita por FV/OS ou cria uma nova.
  const eventos: { case_id: string; event_type: string; payload: unknown }[] = [];

  for (const doc of preparados) {
    const key = chave(doc.fac, doc.os);
    if (!doc.fac && !doc.os) {
      continue;
    }

    let caseId = mapaCasos.get(key);
    if (caseId) {
      await supabase
        .from("qa_cases")
        .update({
          document_id: doc.documentId,
          cell,
          analysis_status: STATUS_BY_CELL[cell],
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId);
    } else {
      const { data: created, error } = await supabase
        .from("qa_cases")
        .insert({
          document_id: doc.documentId,
          fac: doc.fac,
          os: doc.os,
          address: (doc.fields.endereco ?? "").trim(),
          municipality: (doc.fields.municipio ?? "").trim(),
          locality: (doc.fields.localidade ?? "").trim(),
          service_type: (doc.fields.servico ?? "").trim(),
          contractor: (doc.fields.contratada ?? "").trim(),
          analysis_status: STATUS_BY_CELL[cell],
          outcome: OUTCOME_BY_CELL[cell],
          cell,
        })
        .select("id")
        .single();

      if (error) {
        fail(error);
      }
      caseId = created?.id;
      if (caseId) {
        mapaCasos.set(key, caseId);
      }
    }

    if (caseId) {
      eventos.push({
        case_id: caseId,
        event_type: "recebimento",
        payload: { documentId: doc.documentId, fileName: doc.fileName, pages: doc.pages },
      });
    }
  }

  for (let index = 0; index < eventos.length; index += EVENT_CHUNK) {
    await supabase.from("qa_case_events").insert(eventos.slice(index, index + EVENT_CHUNK) as never);
  }

  return resultado;
}
