import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo-storage";
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
