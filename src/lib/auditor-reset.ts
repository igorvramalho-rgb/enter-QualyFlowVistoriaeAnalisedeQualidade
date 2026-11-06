import { supabase } from "@/integrations/supabase/client";

/**
 * Limpeza controlada do banco do Qualy Auditor.
 *
 * Apaga **somente** as tabelas `qa_*`. As tabelas do Analista, Emissor e
 * configurações não são tocadas. A exclusão é permitida pela RLS apenas ao
 * gestor; para outros perfis nada é apagado.
 */

export interface AuditorTotals {
  documents: number;
  items: number;
  cases: number;
  events: number;
  redo: number;
  reports: number;
}

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error));
}

async function contar(tabela: "qa_documents" | "qa_document_items" | "qa_cases" | "qa_case_events" | "qa_redo" | "qa_reports") {
  const { count, error } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  if (error) {
    fail(error);
  }
  return count ?? 0;
}

export async function fetchAuditorTotals(): Promise<AuditorTotals> {
  const [documents, items, cases, events, redo, reports] = await Promise.all([
    contar("qa_documents"),
    contar("qa_document_items"),
    contar("qa_cases"),
    contar("qa_case_events"),
    contar("qa_redo"),
    contar("qa_reports"),
  ]);
  return { documents, items, cases, events, redo, reports };
}

/** Ordem segura: filhos antes dos pais. */
export async function clearAuditorDatabase(): Promise<void> {
  const ordem = [
    "qa_case_events",
    "qa_reports",
    "qa_redo",
    "qa_document_items",
    "qa_cases",
    "qa_documents",
  ] as const;

  for (const tabela of ordem) {
    const { error } = await supabase.from(tabela).delete().gte("created_at", "1970-01-01");
    if (error) {
      fail(error);
    }
  }

  // Confere o resultado: sem permissão de gestor a RLS não apaga nada.
  const restante = await fetchAuditorTotals();
  const sobra = Object.values(restante).reduce((total, valor) => total + valor, 0);
  if (sobra > 0) {
    throw new Error(
      "Os registros não foram apagados. A exclusão é permitida apenas ao perfil de gestor.",
    );
  }
}
