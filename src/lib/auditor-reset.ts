import { supabase } from "@/integrations/supabase/client";
import type { CellKey } from "@/lib/auditor";

const CHUNK = 100;

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

/** Quantas FV/OS existem numa célula. */
export async function fetchCellTotal(cell: CellKey): Promise<number> {
  const { count, error } = await supabase
    .from("qa_cases")
    .select("*", { count: "exact", head: true })
    .eq("cell", cell);
  if (error) {
    fail(error);
  }
  return count ?? 0;
}

/**
 * Apaga apenas os registros de uma célula (FV/OS + etapas + movimentações +
 * refazer + relatórios daquelas tratativas). Nenhuma outra célula é afetada.
 */
export async function clearAuditorCell(cell: CellKey): Promise<number> {
  const { data, error } = await supabase
    .from("qa_cases")
    .select("id, document_id")
    .eq("cell", cell);

  if (error) {
    fail(error);
  }

  const casos = data ?? [];
  if (casos.length === 0) {
    return 0;
  }

  const caseIds = casos.map((row) => row.id);
  const docIds = casos
    .map((row) => row.document_id)
    .filter((id): id is string => Boolean(id));

  // Cliente genérico: evita a inferência profunda de tipos com nome de tabela variável.
  const cliente = supabase as unknown as {
    from: (tabela: string) => {
      delete: () => { in: (coluna: string, valores: string[]) => Promise<{ error: unknown }> };
    };
  };

  const apagar = async (tabela: string, coluna: string, ids: string[]) => {
    for (let index = 0; index < ids.length; index += CHUNK) {
      const { error: falha } = await cliente
        .from(tabela)
        .delete()
        .in(coluna, ids.slice(index, index + CHUNK));
      if (falha) {
        fail(falha);
      }
    }
  };

  await apagar("qa_case_events", "case_id", caseIds);
  await apagar("qa_reports", "case_id", caseIds);
  await apagar("qa_redo", "case_id", caseIds);
  if (docIds.length > 0) {
    await apagar("qa_document_items", "document_id", docIds);
  }
  await apagar("qa_cases", "id", caseIds);
  if (docIds.length > 0) {
    await apagar("qa_documents", "id", docIds);
  }

  const restante = await fetchCellTotal(cell);
  if (restante > 0) {
    throw new Error("Os registros não foram apagados. A exclusão é permitida apenas ao gestor.");
  }

  return casos.length;
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
