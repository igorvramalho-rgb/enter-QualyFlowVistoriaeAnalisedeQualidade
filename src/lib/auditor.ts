import { supabase } from "@/integrations/supabase/client";

export const AUDITOR_NAME = "QUALY AUDITOR";
export const AUDITOR_SUBTITLE = "INTELIGÊNCIA DE FISCALIZAÇÃO";
export const AUDITOR_SIGNATURE = "Criado por Igor Ramalho";

/** Seis células operacionais — destino definido manualmente pelo usuário. */
export const CELLS = {
  fiscalizacao: {
    key: "fiscalizacao",
    label: "Em fiscalização",
    short: "Fiscalização",
    description: "FV/OS analisadas e encaminhadas ao fiscal para verificação em campo.",
  },
  refazer: {
    key: "refazer",
    label: "Refazer",
    short: "Refazer",
    description: "Serviço confirmado como não conforme e encaminhado para correção.",
  },
  respondidos: {
    key: "respondidos",
    label: "Respondidos à AlphaGeos",
    short: "Respondidos",
    description: "Resposta efetivamente encaminhada à AlphaGeos.",
  },
  rpa: {
    key: "rpa",
    label: "RPA / Defesas Técnicas",
    short: "RPA",
    description: "Contestação técnica do apontamento, com fundamentação preservada.",
  },
  nao_avaliado: {
    key: "nao_avaliado",
    label: "N/A / Serviços não avaliados",
    short: "N/A",
    description: "Serviço não avaliado, não localizado ou com interferência.",
  },
} as const;

export type CellKey = keyof typeof CELLS;
export const CELL_KEYS = Object.keys(CELLS) as CellKey[];

export function cellLabel(key: string): string {
  return CELLS[key as CellKey]?.label ?? key;
}

/** Situação da tratativa (uma por FV/OS). */
export const ANALYSIS_STATUS = {
  aguardando_analise: "Aguardando análise",
  em_analise: "Em análise",
  encaminhado_fiscalizacao: "Encaminhado para fiscalização",
  aguardando_retorno_fiscal: "Aguardando retorno do fiscal",
  conforme_verificado: "Conforme após verificação",
  nao_conforme_confirmado: "Não conforme confirmado",
  necessita_esclarecimento: "Necessita de esclarecimento",
  encaminhado_refazer: "Encaminhado para refazer",
  aguardando_relatorio: "Aguardando relatório de resposta",
  resposta_enviada: "Resposta enviada à AlphaGeos",
  encerrado: "Encerrado",
} as const;

export type AnalysisStatus = keyof typeof ANALYSIS_STATUS;

export const ANALYSIS_ORDER = Object.keys(ANALYSIS_STATUS) as AnalysisStatus[];

/** Situação da correção — etapa distinta, nunca somada à classificação. */
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

export const REDO_ORDER = Object.keys(REDO_STATUS) as RedoStatus[];
export const REDO_OPEN: RedoStatus[] = REDO_ORDER.filter((status) => status !== "encerrado");

export const TEAM_TYPES = {
  asfalto: "Reposição asfáltica",
  piso: "Piso",
  concreto: "Concreto",
} as const;

export type TeamType = keyof typeof TEAM_TYPES;

export const OUTCOME_LABELS = {
  pendente: "Pendente",
  conforme: "Conforme",
  nao_conforme: "Não conforme",
} as const;

export type CaseOutcome = keyof typeof OUTCOME_LABELS;

export const EVENT_LABELS: Record<string, string> = {
  recebimento: "Documento recebido",
  analise_iniciada: "Análise iniciada",
  parecer_registrado: "Parecer registrado",
  encaminhado_fiscalizacao: "Encaminhado para fiscalização",
  conforme_verificado: "Conforme após verificação",
  nao_conforme_confirmado: "Não conforme confirmado",
  necessita_esclarecimento: "Necessita de esclarecimento",
  encaminhado_refazer: "Encaminhado para refazer",
  aguardando_relatorio: "Aguardando relatório",
  resposta_enviada: "Resposta enviada à AlphaGeos",
  retorno_alphageos: "Devolução da AlphaGeos",
  encerrado: "Encerrado",
};

export interface AuditorCase {
  id: string;
  documentId: string | null;
  fac: string;
  os: string;
  address: string;
  municipality: string;
  locality: string;
  serviceType: string;
  contractor: string;
  status: AnalysisStatus;
  outcome: CaseOutcome;
  cell: CellKey;
  cellData: Record<string, string>;
  reopenCount: number;
  returnedCount: number;
  opinion: string;
  notes: string;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditorCaseItem {
  id: string;
  code: string;
  description: string;
  originalResult: string;
  complement: string;
  page: number | null;
  internalResult: string | null;
  notes: string;
}

export interface AuditorEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditorRedo {
  id: string;
  caseId: string;
  itemCode: string;
  problem: string;
  reason: string;
  teamType: string;
  foreman: string;
  sentAt: string | null;
  scheduledAt: string | null;
  status: RedoStatus;
  finishedAt: string | null;
  notes: string;
  photosBefore: string[];
  photosAfter: string[];
}

export interface AuditorReport {
  id: string;
  caseId: string;
  templateId: string;
  values: Record<string, string>;
  photos: Record<string, unknown>;
  justification: string;
  observations: string;
  status: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface CaseRow {
  id: string;
  fac: string;
  os: string;
  address: string;
  municipality: string;
  locality: string;
  serviceType: string;
  status: AnalysisStatus;
  outcome: CaseOutcome;
  cell: CellKey;
  updatedAt: string;
  returnedCount: number;
  /** Nome do PDF — usado quando a FV/OS não foi extraída. */
  fileName: string;
}

function fail(error: unknown): never {
  throw error instanceof Error ? error : new Error(String(error));
}

function toCase(row: Record<string, unknown>): AuditorCase {
  return {
    id: String(row.id),
    documentId: (row.document_id as string | null) ?? null,
    fac: String(row.fac ?? ""),
    os: String(row.os ?? ""),
    address: String(row.address ?? ""),
    municipality: String(row.municipality ?? ""),
    locality: String(row.locality ?? ""),
    serviceType: String(row.service_type ?? ""),
    contractor: String(row.contractor ?? ""),
    status: (row.analysis_status as AnalysisStatus) ?? "aguardando_analise",
    outcome: (row.outcome as CaseOutcome) ?? "pendente",
    cell: ((row.cell as CellKey) ?? "fiscalizacao"),
    cellData: (row.cell_data as Record<string, string>) ?? {},
    reopenCount: Number(row.reopen_count ?? 0),
    returnedCount: Number(row.returned_count ?? 0),
    opinion: String(row.internal_opinion ?? ""),
    notes: String(row.internal_notes ?? ""),
    decidedAt: (row.decided_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/* ------------------------------------------------------------------ consultas */

export async function fetchCases(): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from("qa_cases")
    .select(
      "id, fac, os, address, municipality, locality, service_type, analysis_status, outcome, updated_at, returned_count, cell, qa_documents(file_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    fail(error);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fac: row.fac,
    os: row.os,
    address: row.address,
    municipality: row.municipality,
    locality: row.locality,
    serviceType: row.service_type,
    status: row.analysis_status as AnalysisStatus,
    outcome: row.outcome as CaseOutcome,
    cell: (row.cell as CellKey) ?? "fiscalizacao",
    updatedAt: row.updated_at,
    returnedCount: row.returned_count,
    fileName: (row.qa_documents as { file_name?: string } | null)?.file_name ?? "",
  }));
}

export async function fetchCase(caseId: string): Promise<AuditorCase | null> {
  const { data, error } = await supabase.from("qa_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) fail(error);
  return data ? toCase(data) : null;
}

export async function fetchCaseItems(documentId: string | null): Promise<AuditorCaseItem[]> {
  if (!documentId) {
    return [];
  }
  const { data, error } = await supabase
    .from("qa_document_items")
    .select("id, code, description, original_result, complement, page_number, internal_result, notes")
    .eq("document_id", documentId)
    .order("code", { ascending: true });

  if (error) fail(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    description: row.description,
    originalResult: row.original_result,
    complement: row.complement,
    page: row.page_number,
    internalResult: row.internal_result,
    notes: row.notes,
  }));
}

export async function fetchCaseEvents(caseId: string): Promise<AuditorEvent[]> {
  const { data, error } = await supabase
    .from("qa_case_events")
    .select("id, event_type, payload, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) fail(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

/** Move a tratativa de célula (decisão sempre humana) e registra o evento. */
export async function moveCaseToCell(caseId: string, cell: CellKey): Promise<void> {
  const { error } = await supabase
    .from("qa_cases")
    .update({ cell, updated_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) fail(error);

  await supabase.from("qa_case_events").insert({
    case_id: caseId,
    event_type: "movimentacao_celula",
    payload: { cell } as never,
  });
}

/** Grava dados próprios da célula (merge raso, sem apagar o que já existe). */
export async function saveCellData(
  caseId: string,
  patch: Record<string, string>,
  current: Record<string, string>,
): Promise<void> {
  const { error } = await supabase
    .from("qa_cases")
    .update({ cell_data: { ...current, ...patch } as never, updated_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) fail(error);
}

export interface CaseUpdate {
  status?: AnalysisStatus;
  outcome?: CaseOutcome;
  opinion?: string;
  notes?: string;
  decided?: boolean;
}

/** Atualiza a tratativa e registra o evento correspondente. */
export async function updateCase(
  caseId: string,
  patch: CaseUpdate,
  event?: { type: string; payload?: Record<string, unknown> },
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, string | null> = { updated_at: now };

  if (patch.status) payload.analysis_status = patch.status;
  if (patch.outcome) payload.outcome = patch.outcome;
  if (typeof patch.opinion === "string") payload.internal_opinion = patch.opinion;
  if (typeof patch.notes === "string") payload.internal_notes = patch.notes;
  if (patch.decided) {
    payload.decided_at = now;
    payload.decided_by = (await supabase.auth.getUser()).data.user?.id ?? null;
  }

  const { error } = await supabase.from("qa_cases").update(payload as never).eq("id", caseId);
  if (error) fail(error);

  if (event) {
    await supabase.from("qa_case_events").insert({
      case_id: caseId,
      event_type: event.type,
      payload: (event.payload ?? {}) as never,
    });
  }
}

/** Devolução da AlphaGeos: reabre a MESMA tratativa e conta o retorno. */
export async function registerReturn(caseId: string, reason: string, current: number): Promise<void> {
  const { error } = await supabase
    .from("qa_cases")
    .update({
      analysis_status: "em_analise",
      outcome: "pendente",
      returned_count: current + 1,
      reopen_count: current + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) fail(error);

  await supabase.from("qa_case_events").insert({
    case_id: caseId,
    event_type: "retorno_alphageos",
    payload: { reason },
  });
}

export async function saveItemInternal(
  itemId: string,
  internalResult: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from("qa_document_items")
    .update({ internal_result: internalResult || null, notes })
    .eq("id", itemId);
  if (error) fail(error);
}

/* -------------------------------------------------------------------- refazer */

function toRedo(row: Record<string, unknown>): AuditorRedo {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    itemCode: String(row.item_code ?? ""),
    problem: String(row.problem ?? ""),
    reason: String(row.reason ?? ""),
    teamType: String(row.team_type ?? ""),
    foreman: String(row.foreman ?? ""),
    sentAt: (row.sent_at as string | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    status: (row.redo_status as RedoStatus) ?? "pendente_encaminhamento",
    finishedAt: (row.finished_at as string | null) ?? null,
    notes: String(row.notes ?? ""),
    photosBefore: (row.photos_before as string[]) ?? [],
    photosAfter: (row.photos_after as string[]) ?? [],
  };
}

export async function fetchRedoQueue(): Promise<AuditorRedo[]> {
  const { data, error } = await supabase
    .from("qa_redo")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) fail(error);
  return (data ?? []).map(toRedo);
}

export async function fetchRedoForCase(caseId: string): Promise<AuditorRedo | null> {
  const { data, error } = await supabase
    .from("qa_redo")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) fail(error);
  return data ? toRedo(data) : null;
}

export interface RedoInput {
  caseId: string;
  itemCode: string;
  problem: string;
  reason: string;
  teamType: string;
  foreman: string;
  sentAt: string | null;
  scheduledAt: string | null;
  status: RedoStatus;
  finishedAt: string | null;
  notes: string;
  photosBefore: string[];
  photosAfter: string[];
}

export async function saveRedo(input: RedoInput): Promise<void> {
  const payload = {
    case_id: input.caseId,
    item_code: input.itemCode,
    problem: input.problem,
    reason: input.reason,
    team_type: input.teamType,
    foreman: input.foreman,
    sent_at: input.sentAt,
    scheduled_at: input.scheduledAt,
    redo_status: input.status,
    finished_at: input.finishedAt,
    notes: input.notes,
    photos_before: input.photosBefore,
    photos_after: input.photosAfter,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("qa_redo").upsert(payload, { onConflict: "case_id" });
  if (error) fail(error);
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
  uploadStatus: string;
}

/** Documentos recebidos (inclui os que ficaram com upload pendente). */
export async function fetchDocuments(limit = 60): Promise<AuditorDocument[]> {
  const { data, error } = await supabase
    .from("qa_documents")
    .select(
      "id, file_name, pages, imported_at, source, text_available, fields, pdf_path, upload_status",
    )
    .order("imported_at", { ascending: false })
    .limit(limit);

  if (error) fail(error);

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
      uploadStatus: row.upload_status ?? "concluido",
    };
  });
}

export interface AuditorCounts {
  documents: number;
  cases: number;
  events: number;
  byStatus: Record<string, number>;
  byCell: Record<string, number>;
  conforme: number;
  naoConforme: number;
  redoOpen: number;
  redoDone: number;
  reportsSent: number;
  returns: number;
}

/** Contagens reais do módulo (etapas nunca somadas entre si). */
export async function fetchAuditorCounts(): Promise<AuditorCounts> {
  const [documents, cases, redo, reports, events] = await Promise.all([
    supabase.from("qa_documents").select("*", { count: "exact", head: true }),
    supabase.from("qa_cases").select("analysis_status, outcome, returned_count, cell"),
    supabase.from("qa_redo").select("redo_status"),
    supabase.from("qa_reports").select("status"),
    supabase.from("qa_case_events").select("*", { count: "exact", head: true }),
  ]);

  if (documents.error) fail(documents.error);
  if (cases.error) fail(cases.error);
  if (redo.error) fail(redo.error);
  if (reports.error) fail(reports.error);
  if (events.error) fail(events.error);

  const byStatus: Record<string, number> = {};
  const byCell: Record<string, number> = {};
  let conforme = 0;
  let naoConforme = 0;
  let returns = 0;

  for (const row of cases.data ?? []) {
    byStatus[row.analysis_status] = (byStatus[row.analysis_status] ?? 0) + 1;
    byCell[row.cell ?? "fiscalizacao"] = (byCell[row.cell ?? "fiscalizacao"] ?? 0) + 1;
    if (row.outcome === "conforme") conforme += 1;
    if (row.outcome === "nao_conforme") naoConforme += 1;
    returns += row.returned_count ?? 0;
  }

  const redoRows = redo.data ?? [];
  const redoDone = redoRows.filter((item) => item.redo_status === "encerrado").length;

  return {
    documents: documents.count ?? 0,
    cases: cases.data?.length ?? 0,
    events: events.count ?? 0,
    byStatus,
    byCell,
    conforme,
    naoConforme,
    redoOpen: redoRows.length - redoDone,
    redoDone,
    reportsSent: (reports.data ?? []).filter((item) => item.status === "enviado").length,
    returns,
  };
}

/* ------------------------------------------------------------------ relatórios */

function toReport(row: Record<string, unknown>): AuditorReport {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    templateId: String(row.template_id ?? ""),
    values: (row.values as Record<string, string>) ?? {},
    photos: (row.photos as Record<string, unknown>) ?? {},
    justification: String(row.justification ?? ""),
    observations: String(row.observations ?? ""),
    status: String(row.status ?? "rascunho"),
    sentAt: (row.sent_at as string | null) ?? null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function fetchReportsQueue(): Promise<AuditorReport[]> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) fail(error);
  return (data ?? []).map(toReport);
}

export async function fetchReportForCase(caseId: string): Promise<AuditorReport | null> {
  const { data, error } = await supabase
    .from("qa_reports")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) fail(error);
  return data ? toReport(data) : null;
}

export async function saveReport(input: {
  caseId: string;
  templateId: string;
  values: Record<string, string>;
  photos: Record<string, unknown>;
  justification: string;
  observations: string;
  status: string;
}): Promise<void> {
  const { error } = await supabase.from("qa_reports").upsert(
    {
      case_id: input.caseId,
      template_id: input.templateId,
      values: input.values as never,
      photos: input.photos as never,
      justification: input.justification,
      observations: input.observations,
      status: input.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "case_id" },
  );
  if (error) fail(error);
}

export async function markReportSent(caseId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("qa_reports")
    .update({ status: "enviado", sent_at: now, updated_at: now })
    .eq("case_id", caseId);
  if (error) fail(error);

  await updateCase(
    caseId,
    { status: "resposta_enviada" },
    { type: "resposta_enviada", payload: { sentAt: now } },
  );
}

/* ------------------------------------------------------- importações pendentes */

export interface PendingUpload {
  id: string;
  fileName: string;
  fingerprint: string;
  status: string;
  createdAt: string;
}

export async function fetchPendingUploads(): Promise<PendingUpload[]> {
  const { data, error } = await supabase
    .from("qa_documents")
    .select("id, file_name, fingerprint, upload_status, created_at")
    .neq("upload_status", "concluido")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) fail(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    fingerprint: row.fingerprint,
    status: row.upload_status,
    createdAt: row.created_at,
  }));
}

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
