import { supabase } from "@/integrations/supabase/client";

/** Identidade do módulo (usada nas telas e no rodapé institucional). */
export const AUDITOR_NAME = "QUALY AUDITOR";
export const AUDITOR_SUBTITLE = "INTELIGÊNCIA DE FISCALIZAÇÃO";
export const AUDITOR_SIGNATURE = "Criado por Igor Ramalho";

/** Situação da análise interna — separada da classificação original da AlphaGeos. */
export const ANALYSIS_STATUS = {
  aguardando_analise: "Aguardando análise",
  em_analise: "Em análise",
  encaminhado_fiscalizacao: "Encaminhado para fiscalização",
  conforme_verificado: "Conforme após verificação",
  nao_conforme_confirmado: "Não conforme confirmado",
  necessita_esclarecimento: "Necessita de esclarecimento",
} as const;

export type AnalysisStatus = keyof typeof ANALYSIS_STATUS;

/** Situação da correção — outra etapa, não se soma à classificação. */
export const REDO_STATUS = {
  pendente_encaminhamento: "Pendente de encaminhamento",
  encaminhado: "Encaminhado ao encarregado",
  aguardando_programacao: "Aguardando programação",
  programado: "Programado",
  em_execucao: "Em execução",
  aguardando_verificacao: "Aguardando verificação do fiscal",
  corrigido_fotos: "Correção comprovada por fotos",
  aguardando_resposta: "Aguardando resposta à AlphaGeos",
  encerrado: "Encerrado",
} as const;

export type RedoStatus = keyof typeof REDO_STATUS;

export const OUTCOME_LABELS = {
  pendente: "Pendente",
  conforme: "Conforme",
  nao_conforme: "Não conforme",
} as const;

export type CaseOutcome = keyof typeof OUTCOME_LABELS;

export interface AuditorCounts {
  documents: number;
  cases: number;
  byStatus: Record<string, number>;
  conforme: number;
  naoConforme: number;
  redoOpen: number;
  redoDone: number;
  reportsSent: number;
  returns: number;
}

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error));
}

/** Contagens reais das tabelas do módulo (nada é somado entre etapas diferentes). */
export async function fetchAuditorCounts(): Promise<AuditorCounts> {
  const [documents, cases, redo, reports, returns] = await Promise.all([
    supabase.from("qa_documents").select("*", { count: "exact", head: true }),
    supabase.from("qa_cases").select("analysis_status, outcome"),
    supabase.from("qa_redo").select("redo_status"),
    supabase.from("qa_reports").select("status"),
    supabase
      .from("qa_case_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "retorno_alphageos"),
  ]);

  if (documents.error) fail(documents.error);
  if (cases.error) fail(cases.error);
  if (redo.error) fail(redo.error);
  if (reports.error) fail(reports.error);
  if (returns.error) fail(returns.error);

  const byStatus: Record<string, number> = {};
  let conforme = 0;
  let naoConforme = 0;

  for (const row of cases.data ?? []) {
    byStatus[row.analysis_status] = (byStatus[row.analysis_status] ?? 0) + 1;
    if (row.outcome === "conforme") conforme += 1;
    if (row.outcome === "nao_conforme") naoConforme += 1;
  }

  const redoRows = redo.data ?? [];
  const redoDone = redoRows.filter((item) => item.redo_status === "encerrado").length;

  return {
    documents: documents.count ?? 0,
    cases: cases.data?.length ?? 0,
    byStatus,
    conforme,
    naoConforme,
    redoOpen: redoRows.length - redoDone,
    redoDone,
    reportsSent: (reports.data ?? []).filter((item) => item.status === "enviado").length,
    returns: returns.count ?? 0,
  };
}

export interface AuditorDocument {
  id: string;
  fileName: string;
  pages: number;
  importedAt: string;
  source: string;
  textAvailable: boolean;
  fac: string;
  os: string;
  address: string;
  pdfPath: string;
}

/** Documentos já recebidos (a importação entra na Etapa 3). */
export async function fetchDocuments(limit = 40): Promise<AuditorDocument[]> {
  const { data, error } = await supabase
    .from("qa_documents")
    .select("id, file_name, pages, imported_at, source, text_available, fields, pdf_path")
    .order("imported_at", { ascending: false })
    .limit(limit);

  if (error) {
    fail(error);
  }

  return (data ?? []).map((row) => {
    const fields = (row.fields ?? {}) as Record<string, string>;
    return {
      id: row.id,
      fileName: row.file_name,
      pages: row.pages,
      importedAt: row.imported_at,
      source: row.source,
      textAvailable: row.text_available,
      fac: fields.fac ?? "",
      os: fields.os ?? "",
      address: fields.endereco ?? "",
      pdfPath: row.pdf_path ?? "",
    };
  });
}

export interface AuditorRedoRow {
  id: string;
  itemCode: string;
  teamType: string;
  foreman: string;
  status: RedoStatus;
  sentAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
}

/** Serviços encaminhados para refazer. */
export async function fetchRedoQueue(limit = 60): Promise<AuditorRedoRow[]> {
  const { data, error } = await supabase
    .from("qa_redo")
    .select("id, item_code, team_type, foreman, redo_status, sent_at, scheduled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    fail(error);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    itemCode: row.item_code,
    teamType: row.team_type,
    foreman: row.foreman,
    status: row.redo_status as RedoStatus,
    sentAt: row.sent_at,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
  }));
}

export interface AuditorReportRow {
  id: string;
  caseId: string;
  templateId: string;
  status: string;
  sentAt: string | null;
  justification: string;
  updatedAt: string;
}

/** Relatórios de resposta por FV/OS. */
export async function fetchReportsQueue(limit = 60): Promise<AuditorReportRow[]> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select("id, case_id, template_id, status, sent_at, justification, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    fail(error);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    caseId: row.case_id,
    templateId: row.template_id,
    status: row.status,
    sentAt: row.sent_at,
    justification: row.justification,
    updatedAt: row.updated_at,
  }));
}

/** Dias decorridos desde o encaminhamento (sem inventar prazos). */
export function daysSince(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}
