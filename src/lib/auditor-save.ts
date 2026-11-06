import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo-storage";
import type { AuditorExtraction, AuditorItem } from "@/lib/auditor-pdf";

/**
 * Persistência do Qualy Auditor: PDF original em área privada, documento,
 * etapas e a tratativa (uma por FV/OS).
 *
 * Nada é apagado. Reimportar o mesmo arquivo é bloqueado pelo fingerprint e
 * uma nova devolutiva reaproveita a mesma tratativa.
 */

const AUDITOR_PREFIX = "qualyflow/auditor";
const SIGNED_TTL_SECONDS = 60 * 60 * 12;

export interface ExistingDocument {
  id: string;
  fileName: string;
  importedAt: string;
}

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error));
}

/** Já existe documento com este fingerprint? */
export async function findDocumentByFingerprint(
  fingerprint: string,
): Promise<ExistingDocument | null> {
  const { data, error } = await supabase
    .from("qa_documents")
    .select("id, file_name, imported_at")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    fail(error);
  }

  return data ? { id: data.id, fileName: data.file_name, importedAt: data.imported_at } : null;
}

/** Envia o PDF original para o armazenamento privado e devolve o caminho. */
export async function uploadOriginalPdf(documentId: string, file: File): Promise<string> {
  const path = `${AUDITOR_PREFIX}/${documentId}/original.pdf`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) {
    fail(error);
  }

  return path;
}

/** Link temporário para abrir o PDF guardado. */
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
}

export interface ConfirmResult {
  documentId: string;
  caseId: string | null;
}

/**
 * Grava o documento, as etapas e a tratativa. A classificação original vem da
 * extração e não é alterada por esta função.
 */
export async function confirmAuditorDocument(input: ConfirmInput): Promise<ConfirmResult> {
  const { extraction, file, fields, items } = input;
  const documentId = crypto.randomUUID();

  const pdfPath = await uploadOriginalPdf(documentId, file);

  const { error: documentError } = await supabase.from("qa_documents").insert({
    id: documentId,
    fingerprint: extraction.fingerprint,
    file_name: extraction.fileName,
    pdf_path: pdfPath,
    pages: extraction.pages,
    fields,
    confidence: {},
    snippet: "",
    source: extraction.usedOcr ? "texto+ocr" : extraction.textAvailable ? "texto" : "sem-texto",
    text_available: extraction.textAvailable,
  });

  if (documentError) {
    fail(documentError);
  }

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

  // Uma tratativa por FV/OS: reaproveita a existente em caso de devolutiva.
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
        .update({ document_id: documentId, updated_at: new Date().toISOString() })
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
          analysis_status: "aguardando_analise",
          outcome: "pendente",
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
      payload: { documentId, fileName: extraction.fileName, pages: extraction.pages },
    });
  }

  return { documentId, caseId };
}
