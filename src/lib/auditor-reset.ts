import { supabase } from "@/integrations/supabase/client";

/**
 * Limpeza controlada do banco do Qualy Auditor.
 *
 * Apaga **somente** as tabelas `qa_*`, e agora permite escolher o escopo:
 * um ciclo inteiro, uma célula ou todo o módulo. As tabelas do Analista,
 * Emissor e configurações nunca são tocadas.
 */

export type ResetScopeType = "cycle" | "cell" | "all";

export interface ResetScope {
  type: ResetScopeType;
  /** Id do ciclo ou chave da célula. */
  value?: string;
}

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

/** Quantas FV/OS existem no escopo escolhido. */
export async function fetchScopeTotal(scope: ResetScope): Promise<number> {
  if (scope.type === "all") {
    const { count, error } = await supabase
      .from("qa_cases")
      .select("*", { count: "exact", head: true });
    if (error) {
      fail(error);
    }
    return count ?? 0;
  }

  if (!scope.value) {
    return 0;
  }

  const base = supabase.from("qa_cases").select("*", { count: "exact", head: true });
  const { count, error } =
    scope.type === "cycle"
      ? await base.eq("cycle_id", scope.value)
      : await base.eq("cell", scope.value);

  if (error) {
    fail(error);
  }
  return count ?? 0;
}

interface CaseRow {
  id: string;
  document_id: string | null;
}

async function casosDoEscopo(scope: ResetScope): Promise<CaseRow[]> {
  const base = supabase.from("qa_cases").select("id, document_id");
  const consulta =
    scope.type === "all"
      ? base
      : scope.type === "cycle"
        ? base.eq("cycle_id", scope.value ?? "")
        : base.eq("cell", scope.value ?? "");

  const { data, error } = await consulta;
  if (error) {
    fail(error);
  }
  return data ?? [];
}

const CHUNK = 100;

/** Apaga apenas o escopo escolhido (ciclo, célula ou tudo). */
export async function clearScope(scope: ResetScope): Promise<number> {
  const casos = await casosDoEscopo(scope);
  if (casos.length === 0) {
    return 0;
  }

  const caseIds = casos.map((row) => row.id);
  const docIds = casos.map((row) => row.document_id).filter((id): id is string => Boolean(id));

  const cliente = supabase as unknown as {
    from: (tabela: string) => {
      delete: () => { in: (coluna: string, valores: string[]) => Promise<{ error: unknown }> };
    };
  };

  const apagar = async (tabela: string, coluna: string, ids: string[]) => {
    for (let index = 0; index < ids.length; index += CHUNK) {
      const { error } = await cliente.from(tabela).delete().in(coluna, ids.slice(index, index + CHUNK));
      if (error) {
        fail(error);
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

  // "Todo o banco": remove também documentos/etapas que ficaram sem tratativa.
  if (scope.type === "all") {
    const tabelas = ["qa_case_events", "qa_reports", "qa_redo", "qa_document_items", "qa_documents"];
    for (const tabela of tabelas) {
      await supabase.from(tabela as "qa_documents").delete().gte("created_at", "1970-01-01");
    }
  }

  const restante = await fetchScopeTotal(scope);
  if (restante > 0) {
    throw new Error("Os registros não foram apagados. A exclusão é permitida apenas ao gestor.");
  }

  return casos.length;
}

/** Mantido para compatibilidade: limpa todo o módulo. */
export async function clearAuditorDatabase(): Promise<void> {
  await clearScope({ type: "all" });
}
