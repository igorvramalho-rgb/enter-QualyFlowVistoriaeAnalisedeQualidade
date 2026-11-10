import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo-storage";
import { extractAuditorDocument, AUDITOR_FIELDS } from "@/lib/auditor-pdf";
import type { AuditorExtraction, AuditorItem } from "@/lib/auditor-pdf";
import { STATUS_BY_CELL, type AnalysisStatus, type CaseOutcome, type CellKey } from "@/lib/auditor";
import { deriveNumbersFromFileName } from "@/lib/fields";


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

/** FV/OS vêm da extração; quando faltam, o nome do arquivo costuma trazê-las. */
export function resolveIdentity(
  fields: Record<string, string>,
  fileName: string,
): { fac: string; os: string } {
  const doNome = deriveNumbersFromFileName(fileName);
  return {
    fac: (fields.fac || doNome.fac || "").trim(),
    os: (fields.os || doNome.os || "").trim(),
  };
}

/**
 * Garante que o documento tenha uma tratativa e que ela esteja na célula pedida.
 * Sem isso, documento sem FV/OS ficava fora de todas as células.
 */
async function ensureCase(params: {
  documentId: string;
  fields: Record<string, string>;
  fileName: string;
  cell: CellKey;
  mapa: Map<string, string>;
}): Promise<string | null> {
  const { fac, os } = resolveIdentity(params.fields, params.fileName);
  const chave = fac || os ? `${fac}|${os}` : `doc:${params.documentId}`;

  let existente = params.mapa.get(chave);

  if (!existente) {
    const consulta = supabase.from("qa_cases").select("id");
    const { data: achado } = fac || os
      ? await consulta.eq("fac", fac).eq("os", os).maybeSingle()
      : await consulta.eq("document_id", params.documentId).maybeSingle();

    if (achado?.id) {
      existente = achado.id;
      params.mapa.set(chave, achado.id);
    }
  }

  if (existente) {
    await supabase
      .from("qa_cases")
      .update({
        document_id: params.documentId,
        cell: params.cell,
        analysis_status: STATUS_BY_CELL[params.cell],
        updated_at: new Date().toISOString(),
      })
      .eq("id", existente);
    return existente;
  }

  const { data, error } = await supabase
    .from("qa_cases")
    .insert({
      document_id: params.documentId,
      fac,
      os,
      address: (params.fields.endereco ?? "").trim(),
      municipality: (params.fields.municipio ?? "").trim(),
      locality: (params.fields.localidade ?? "").trim(),
      service_type: (params.fields.servico ?? "").trim(),
      contractor: (params.fields.contratada ?? "").trim(),
      analysis_status: STATUS_BY_CELL[params.cell],
      outcome: OUTCOME_BY_CELL[params.cell],
      cell: params.cell,
    })
    .select("id")
    .single();

  if (error) {
    fail(error);
  }

  const caseId = data?.id ?? null;
  if (caseId) {
    params.mapa.set(chave, caseId);
  }
  return caseId;
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
    cell,
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

  // 4) Tratativa: garante uma por FV/OS (ou por documento, sem FV/OS).
  const caseId = await ensureCase({
    documentId,
    fields,
    fileName: extraction.fileName,
    cell,
    mapa: new Map<string, string>(),
  });

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
  movidos: number;
  falhas: number;
  pendentes: number;
  primeiroErro: string;
}

const CONCURRENCY = 3;

/**
 * Importa vários PDFs. Cada arquivo é concluído de ponta a ponta (documento,
 * PDF, etapas, tratativa e evento) dentro do próprio try: uma falha em um
 * arquivo nunca interrompe os demais.
 */
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
    movidos: 0,
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

  const fila = [...files];
  let concluidos = 0;

  const registrar = async (file: File): Promise<void> => {
    const extraction = await extractAuditorDocument(file, { ocr });
    const fields = Object.fromEntries(
      AUDITOR_FIELDS.map(({ key }) => [key, extraction.fields[key].value]),
    );

    // Já existe: garante a tratativa e move para a célula escolhida.
    if (vistos.has(extraction.fingerprint)) {
      const { data: existente } = await supabase
        .from("qa_documents")
        .select("id, fields, file_name")
        .eq("fingerprint", extraction.fingerprint)
        .maybeSingle();

      if (!existente) {
        resultado.duplicados += 1;
        return;
      }

      await supabase.from("qa_documents").update({ cell }).eq("id", existente.id);

      // Documento antigo pode ter ficado sem etapas: completa agora.
      const { count: itensExistentes } = await supabase
        .from("qa_document_items")
        .select("*", { count: "exact", head: true })
        .eq("document_id", existente.id);

      if ((itensExistentes ?? 0) === 0 && extraction.items.length > 0) {
        await supabase.from("qa_document_items").insert(
          extraction.items.map((item) => ({
            document_id: existente.id,
            code: item.code,
            description: item.description,
            original_result: item.originalResult,
            complement: item.complement,
            page_number: item.page,
          })),
        );
      }

      const caseId = await ensureCase({
        documentId: existente.id,
        fields: (existente.fields as Record<string, string>) ?? {},
        fileName: existente.file_name ?? file.name,
        cell,
        mapa: mapaCasos,
      });
      if (caseId) {
        await supabase.from("qa_case_events").insert({
          case_id: caseId,
          event_type: "recebimento",
          payload: { documentId: existente.id, fileName: existente.file_name } as never,
        });
      }
      resultado.movidos += 1;
      return;
    }

    vistos.add(extraction.fingerprint);

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
      source: extraction.usedOcr ? "texto+ocr" : extraction.textAvailable ? "texto" : "sem-texto",
      text_available: extraction.textAvailable,
      upload_status: "pendente",
      upload_error: "",
      cell,
    });

    if (docError) {
      throw new Error(`registro do documento: ${docError.message}`);
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

    if (extraction.items.length > 0) {
      const { error: itensError } = await supabase.from("qa_document_items").insert(
        extraction.items.map((item) => ({
          document_id: documentId,
          code: item.code,
          description: item.description,
          original_result: item.originalResult,
          complement: item.complement,
          page_number: item.page,
        })),
      );
      if (itensError) {
        throw new Error(`etapas avaliadas: ${itensError.message}`);
      }
    }

    const caseId = await ensureCase({
      documentId,
      fields,
      fileName: extraction.fileName,
      cell,
      mapa: mapaCasos,
    });

    if (caseId) {
      await supabase.from("qa_case_events").insert({
        case_id: caseId,
        event_type: "recebimento",
        payload: { documentId, fileName: extraction.fileName, pages: extraction.pages } as never,
      });
    }

    resultado.registrados += 1;
    if (!uploadOk) resultado.pendentes += 1;
  };

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
        await registrar(file);
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

  return resultado;
}
