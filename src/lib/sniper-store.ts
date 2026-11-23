import { supabase } from "@/integrations/supabase/client";
import { getActiveCycleId } from "@/lib/cycles";
import {
  invalidateAuditorCache,
  STATUS_BY_CELL,
  type CaseOutcome,
  type CellKey,
} from "@/lib/auditor";
import type {
  SniperDocument,
  SniperItem,
  SniperMotivoOrigem,
  SniperSectionSummary,
  SniperVerdict,
} from "@/lib/sniper";

/**
 * Base própria do Sniper Analítico — tabela `qa_sniper_documents`.
 * Nada aqui lê ou apaga `qa_cases`, `qa_documents` ou `qualyflow_analyses`:
 * a migração para uma célula é a única escrita fora da base do Sniper.
 */

/** Documento do Sniper já gravado (mesma leitura + identidade da linha). */
export interface SniperSavedDocument extends SniperDocument {
  id: string;
  fingerprint: string;
  importedAt: string;
  migratedCell: string;
  migratedAt: string | null;
}

export interface SniperMigrationResult {
  criados: number;
  movidos: number;
  semIdentificacao: number;
}

const OUTCOME_BY_CELL: Record<CellKey, CaseOutcome> = {
  fiscalizacao: "pendente",
  refazer: "nao_conforme",
  respondidos: "conforme",
  rpa: "pendente",
  sae: "pendente",
  nao_avaliado: "pendente",
  nao_executado: "pendente",
};

const MAX_ITEMS_POR_DOC = 120;

function fail(error: unknown): never {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  throw new Error(message);
}

function asItems(value: unknown): SniperItem[] {
  return Array.isArray(value) ? (value as SniperItem[]) : [];
}

function asSections(value: unknown): SniperSectionSummary[] {
  return Array.isArray(value) ? (value as SniperSectionSummary[]) : [];
}

function toSaved(row: {
  id: string;
  fingerprint: string;
  created_at: string;
  items: unknown;
  sections: unknown;
} & Record<string, unknown>): SniperSavedDocument {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    importedAt: row.created_at,
    migratedCell: String(row.migrated_cell ?? ""),
    migratedAt: (row.migrated_at as string | null) ?? null,
    fileName: String(row.file_name ?? ""),
    pages: Number(row.pages ?? 1),
    hasText: Boolean(row.has_text),
    fac: String(row.fac ?? ""),
    os: String(row.os ?? ""),
    data: String(row.data_avaliacao ?? ""),
    municipio: String(row.municipio ?? ""),
    endereco: String(row.endereco ?? ""),
    polo: String(row.polo ?? ""),
    unidade: String(row.unidade ?? ""),
    categoria: String(row.categoria ?? ""),
    contratada: String(row.contratada ?? ""),
    servicoExecutado: String(row.servico_executado ?? ""),
    servicoAcatado: String(row.servico_acatado ?? ""),
    auditor: String(row.auditor ?? ""),
    conceito: String(row.conceito ?? ""),
    items: asItems(row.items),
    total: Number(row.total_items ?? 0),
    na: Number(row.na_items ?? 0),
    conforme: Number(row.conforme_items ?? 0),
    naoConforme: Number(row.nao_conforme_items ?? 0),
    informativo: Number(row.informativo_items ?? 0),
    semResultado: Number(row.sem_resultado_items ?? 0),
    sections: asSections(row.sections),
    motivos: [],
    observacoes: [],
    motivo: String(row.motivo ?? ""),
    motivoOrigem: (row.motivo_origem as SniperMotivoOrigem) ?? "ausente",
    naoExecutado: row.verdict === "nao_executado",
    verdict: (row.verdict as SniperVerdict) ?? "sem_itens",
  };
}

/** Carrega a base do Sniper (independente do ciclo selecionado). */
export async function fetchSniperDocuments(): Promise<SniperSavedDocument[]> {
  const { data, error } = await supabase
    .from("qa_sniper_documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    fail(error);
  }

  return (data ?? []).map((row) => toSaved(row as never));
}

export interface SniperImportEntry {
  doc: SniperDocument;
  fingerprint: string;
}

/** Grava/atualiza em lotes pequenos — cada linha carrega a lista de etapas. */
export async function importSniperDocuments(entries: SniperImportEntry[]): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const agora = new Date().toISOString();
  let gravados = 0;

  for (let index = 0; index < entries.length; index += 25) {
    const lote = entries.slice(index, index + 25).map(({ doc, fingerprint }) => ({
      fingerprint,
      file_name: doc.fileName,
      pages: doc.pages,
      has_text: doc.hasText,
      fac: doc.fac,
      os: doc.os,
      data_avaliacao: doc.data,
      municipio: doc.municipio,
      endereco: doc.endereco,
      polo: doc.polo,
      unidade: doc.unidade,
      categoria: doc.categoria,
      contratada: doc.contratada,
      servico_executado: doc.servicoExecutado,
      servico_acatado: doc.servicoAcatado,
      auditor: doc.auditor,
      conceito: doc.conceito,
      total_items: doc.total,
      na_items: doc.na,
      conforme_items: doc.conforme,
      nao_conforme_items: doc.naoConforme,
      informativo_items: doc.informativo,
      sem_resultado_items: doc.semResultado,
      verdict: doc.verdict,
      motivo: doc.motivo,
      motivo_origem: doc.motivoOrigem,
      items: doc.items.slice(0, MAX_ITEMS_POR_DOC) as never,
      sections: doc.sections as never,
      updated_at: agora,
    }));

    const { error } = await supabase
      .from("qa_sniper_documents")
      .upsert(lote, { onConflict: "fingerprint" });

    if (error) {
      fail(error);
    }
    gravados += lote.length;
  }

  return gravados;
}

/** Quantos documentos existem na base do Sniper (independe da página carregada). */
export async function countSniperDocuments(): Promise<number> {
  const { count, error } = await supabase
    .from("qa_sniper_documents")
    .select("id", { count: "exact", head: true });

  if (error) {
    fail(error);
  }
  return count ?? 0;
}

/**
 * Limpa a base do Sniper (somente ela).
 * Sem `ids`, apaga todos os documentos da base — inclusive os que não estão na
 * página carregada. Com `ids`, apaga apenas os escolhidos.
 */
export async function clearSniperBase(ids?: string[]): Promise<number> {
  if (ids && ids.length > 0) {
    for (let index = 0; index < ids.length; index += 100) {
      const lote = ids.slice(index, index + 100);
      const { error } = await supabase.from("qa_sniper_documents").delete().in("id", lote);
      if (error) {
        fail(error);
      }
    }
    return ids.length;
  }

  const total = await countSniperDocuments();
  const { error } = await supabase
    .from("qa_sniper_documents")
    .delete()
    .gte("created_at", "1970-01-01");

  if (error) {
    fail(error);
  }
  return total;
}

async function marcarMigrados(ids: string[], cell: CellKey): Promise<void> {
  const agora = new Date().toISOString();

  for (let index = 0; index < ids.length; index += 100) {
    const lote = ids.slice(index, index + 100);
    const { error } = await supabase
      .from("qa_sniper_documents")
      .update({ migrated_cell: cell, migrated_at: agora, updated_at: agora })
      .in("id", lote);
    if (error) {
      fail(error);
    }
  }
}

/**
 * Leva os documentos escolhidos para a célula do Qualy Auditor.
 * Reaproveita a tratativa da FV/OS quando ela já existe (muda de célula) e cria
 * uma nova quando ainda não existe. Cada movimentação fica registrada no
 * histórico do caso.
 */
export async function migrateSniperToCell(
  documentos: SniperSavedDocument[],
  cell: CellKey,
): Promise<SniperMigrationResult> {
  const alvos = documentos.filter((doc) => doc.fac.trim() || doc.os.trim());
  const semIdentificacao = documentos.length - alvos.length;
  if (alvos.length === 0) {
    return { criados: 0, movidos: 0, semIdentificacao };
  }

  const agora = new Date().toISOString();
  const status = STATUS_BY_CELL[cell];
  const outcome = OUTCOME_BY_CELL[cell];
  const cycleId = getActiveCycleId();

  const { data: existentes, error: erroConsulta } = await supabase
    .from("qa_cases")
    .select("id, fac, os")
    .limit(5000);

  if (erroConsulta) {
    fail(erroConsulta);
  }

  const porIdentidade = new Map<string, string>();
  (existentes ?? []).forEach((row) => {
    porIdentidade.set(`${String(row.fac).trim()}|${String(row.os).trim()}`, row.id);
  });

  const moverIds: string[] = [];
  const criar: {
    fac: string;
    os: string;
    address: string;
    municipality: string;
    locality: string;
    service_type: string;
    contractor: string;
    analysis_status: string;
    outcome: string;
    cell: string;
    cycle_id: string | null;
    cell_data: Record<string, string>;
  }[] = [];

  alvos.forEach((doc) => {
    const chave = `${doc.fac.trim()}|${doc.os.trim()}`;
    const existente = porIdentidade.get(chave);
    if (existente) {
      moverIds.push(existente);
      return;
    }

    criar.push({
      fac: doc.fac.trim(),
      os: doc.os.trim(),
      address: doc.endereco,
      municipality: doc.municipio,
      locality: doc.polo,
      service_type: doc.servicoAcatado || doc.servicoExecutado,
      contractor: doc.contratada,
      analysis_status: status,
      outcome,
      cell,
      cycle_id: cycleId,
      cell_data: {
        motivo: doc.motivo,
        origem: "sniper",
        veredito: doc.verdict,
      },
    });
  });

  for (let index = 0; index < moverIds.length; index += 100) {
    const lote = moverIds.slice(index, index + 100);
    const { error } = await supabase
      .from("qa_cases")
      .update({ cell, analysis_status: status, outcome, updated_at: agora })
      .in("id", lote);
    if (error) {
      fail(error);
    }
  }

  const criadosIds: string[] = [];
  for (let index = 0; index < criar.length; index += 100) {
    const lote = criar.slice(index, index + 100);
    const { data, error } = await supabase.from("qa_cases").insert(lote).select("id");
    if (error) {
      fail(error);
    }
    (data ?? []).forEach((row) => criadosIds.push(row.id));
  }

  const eventos = [...moverIds, ...criadosIds].map((caseId) => ({
    case_id: caseId,
    event_type: "movimentacao_celula",
    payload: { cell, origem: "sniper" } as never,
  }));

  for (let index = 0; index < eventos.length; index += 100) {
    const { error } = await supabase.from("qa_case_events").insert(eventos.slice(index, index + 100));
    if (error) {
      fail(error);
    }
  }

  await marcarMigrados(
    alvos.map((doc) => doc.id),
    cell,
  );

  invalidateAuditorCache();

  return { criados: criadosIds.length, movidos: moverIds.length, semIdentificacao };
}
