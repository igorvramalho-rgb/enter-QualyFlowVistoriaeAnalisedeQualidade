import { supabase } from "@/integrations/supabase/client";
import { invalidateAuditorCache } from "@/lib/auditor";
import { extractAuditorDocument, AUDITOR_FIELDS } from "@/lib/auditor-pdf";
import { signedPdfUrl } from "@/lib/auditor-save";

/**
 * Reextrai um PDF já importado usando OCR local.
 *
 * Serve para os documentos digitalizados (sem camada de texto), que entram com
 * os campos vazios. O arquivo original é baixado por link assinado, lido no
 * navegador e **só completa o que está vazio** — nada é sobrescrito.
 */

export interface ReextractResult {
  ok: boolean;
  message: string;
  preenchidos: string[];
}

export async function reextractWithOcr(
  documentId: string,
  onProgress?: (etapa: string) => void,
): Promise<ReextractResult> {
  const { data: doc, error } = await supabase
    .from("qa_documents")
    .select("id, pdf_path, file_name, fields")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message, preenchidos: [] };
  }
  if (!doc?.pdf_path) {
    return { ok: false, message: "Este documento não tem PDF guardado.", preenchidos: [] };
  }

  onProgress?.("Abrindo o PDF...");
  const url = await signedPdfUrl(doc.pdf_path);
  if (!url) {
    return { ok: false, message: "Não foi possível abrir o PDF guardado.", preenchidos: [] };
  }

  const resposta = await fetch(url);
  const blob = await resposta.blob();
  const arquivo = new File([blob], doc.file_name || "documento.pdf", { type: "application/pdf" });

  onProgress?.("Lendo com OCR (pode levar alguns segundos)...");
  const extraction = await extractAuditorDocument(arquivo, {
    ocr: true,
    onOcrProgress: (etapa, pagina, total) => onProgress?.(`OCR ${etapa} · página ${pagina}/${total}`),
  });

  if (!extraction.textAvailable) {
    return {
      ok: false,
      message: "O OCR não conseguiu ler texto útil neste PDF.",
      preenchidos: [],
    };
  }

  const atuais = (doc.fields as Record<string, string>) ?? {};
  const novos: Record<string, string> = { ...atuais };
  const preenchidos: string[] = [];

  for (const { key, label } of AUDITOR_FIELDS) {
    const valorOcr = (extraction.fields[key]?.value ?? "").trim();
    if (valorOcr && !(novos[key] ?? "").trim()) {
      novos[key] = valorOcr;
      preenchidos.push(label);
    }
  }

  const { error: erroDoc } = await supabase
    .from("qa_documents")
    .update({
      fields: novos as never,
      source: "texto+ocr",
      text_available: true,
    })
    .eq("id", documentId);

  if (erroDoc) {
    return { ok: false, message: erroDoc.message, preenchidos: [] };
  }

  // Completa a tratativa com o que foi lido (sem sobrescrever o preenchido).
  const { data: caso } = await supabase
    .from("qa_cases")
    .select("id, fac, os, address, municipality, locality, service_type, contractor")
    .eq("document_id", documentId)
    .maybeSingle();

  if (caso) {
    const patch: Record<string, string> = {};
    const aplicar = (campo: string, atual: string | null, novo: string) => {
      if (novo && !(atual ?? "").trim()) {
        patch[campo] = novo;
      }
    };

    aplicar("fac", caso.fac, novos.fac ?? "");
    aplicar("os", caso.os, novos.os ?? "");
    aplicar("address", caso.address, novos.endereco ?? "");
    aplicar("municipality", caso.municipality, novos.municipio ?? "");
    aplicar("locality", caso.locality, novos.localidade ?? "");
    aplicar("service_type", caso.service_type, novos.servico ?? "");
    aplicar("contractor", caso.contractor, novos.contratada ?? "");

    if (Object.keys(patch).length > 0) {
      await supabase
        .from("qa_cases")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", caso.id);
    }
  }

  // Se o documento ainda não tem etapas, grava as lidas agora.
  const { count } = await supabase
    .from("qa_document_items")
    .select("*", { count: "exact", head: true })
    .eq("document_id", documentId);

  if ((count ?? 0) === 0 && extraction.items.length > 0) {
    await supabase.from("qa_document_items").insert(
      extraction.items.map((item) => ({
        document_id: documentId,
        code: item.code,
        description: item.description,
        original_result: item.originalResult,
        complement: item.complement,
        page_number: item.page,
      })),
    );
  }

  invalidateAuditorCache();

  return {
    ok: true,
    preenchidos,
    message:
      preenchidos.length > 0
        ? `Campos preenchidos: ${preenchidos.join(", ")}.`
        : "Leitura concluída, mas nenhum campo novo foi encontrado.",
  };
}
