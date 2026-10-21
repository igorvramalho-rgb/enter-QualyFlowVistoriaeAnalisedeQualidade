import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { migrateRecordFields, type AnalysisRecord } from "@/lib/analysis";
import type {
  GeotagSettings,
  PhotoMap,
  QualyflowSettings,
  ReportDraft,
  ReportValues,
} from "@/lib/report-document";
import { normalizeSettings } from "@/lib/report-document";
import { deriveNumbersFromFileName, sanitizeAddress } from "@/lib/fields";
import type { ReportTemplateId } from "@/lib/report-templates";

type Tables = Database["public"]["Tables"];
type ReportRow = Tables["qualyflow_reports"]["Row"];
type AnalysisRow = Tables["qualyflow_analyses"]["Row"];
type SettingsRow = Tables["qualyflow_settings"]["Row"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

function asObject<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  return value as T;
}

/* ------------------------------------------------------------------ relatórios */

export function toReport(row: ReportRow): ReportDraft {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id as ReportTemplateId,
    values: asObject<ReportValues>(row.values, {}),
    photos: asObject<PhotoMap>(row.photos, {}),
    objeto: row.objeto,
    observacoes: row.observacoes,
    geotag: asObject<GeotagSettings>(row.geotag, { enabled: false, defaults: { dataHora: "", coordenadas: "", endereco: "", bairro: "", cidade: "" } }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PAGE_SIZE = 500;
const MAX_ROWS = 50000;

export async function fetchReports(): Promise<ReportDraft[]> {
  const rows: ReportRow[] = [];

  for (let from = 0; rows.length < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("qualyflow_reports")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.map(toReport);
}

export async function saveReport(draft: ReportDraft): Promise<ReportDraft> {
  const payload = {
    name: draft.name,
    template_id: draft.templateId,
    values: draft.values,
    photos: draft.photos,
    objeto: draft.objeto ?? "",
    observacoes: draft.observacoes ?? "",
    geotag: draft.geotag ?? {},
  };

  if (isUuid(draft.id)) {
    const { data, error } = await supabase
      .from("qualyflow_reports")
      .upsert({ id: draft.id, ...payload }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toReport(data);
  }

  const { data, error } = await supabase
    .from("qualyflow_reports")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return toReport(data);
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("qualyflow_reports").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

/* -------------------------------------------------------------------- vistorias */

export function toAnalysis(row: AnalysisRow): AnalysisRecord {
  const fields = migrateRecordFields(asObject<Record<string, string>>(row.fields, {}));
  const derived = deriveNumbersFromFileName(row.file_name);

  return {
    id: row.id,
    fingerprint: row.fingerprint,
    fileName: row.file_name,
    pages: row.pages,
    analyzedAt: row.analyzed_at,
    documentType: row.document_type as AnalysisRecord["documentType"],
    textAvailable: row.text_available,
    source: row.source as AnalysisRecord["source"],
    fields: {
      ...fields,
      // garante OS/FAC em registros antigos e limpa resíduos do endereço
      fac: fields.fac || derived.fac || "",
      os: fields.os || derived.os || "",
      endereco: sanitizeAddress(fields.endereco),
    },
    confidence: asObject<AnalysisRecord["confidence"]>(row.confidence, {}),
    status: row.status as AnalysisRecord["status"],
    snippet: row.snippet,
    reviewed: row.reviewed,
  };
}

/**
 * Lê a base inteira em páginas: sem isso o servidor devolve apenas a primeira
 * página (limite de linhas) e parte dos PDFs importados "desaparecia" da tela.
 */
export async function fetchAnalyses(): Promise<AnalysisRecord[]> {
  const rows: AnalysisRow[] = [];

  for (let from = 0; rows.length < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("qualyflow_analyses")
      .select("*")
      .order("analyzed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.map(toAnalysis);
}

function analysisPayload(record: AnalysisRecord) {
  return {
    fingerprint: record.fingerprint,
    file_name: record.fileName,
    pages: record.pages,
    document_type: record.documentType,
    text_available: record.textAvailable,
    source: record.source,
    fields: record.fields,
    confidence: record.confidence,
    status: record.status,
    snippet: record.snippet ?? "",
    reviewed: record.reviewed ?? false,
    analyzed_at: record.analyzedAt,
  };
}

export async function saveAnalysis(record: AnalysisRecord): Promise<AnalysisRecord> {
  const payload = analysisPayload(record);

  if (isUuid(record.id)) {
    const { data, error } = await supabase
      .from("qualyflow_analyses")
      .upsert({ id: record.id, ...payload }, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toAnalysis(data);
  }

  const { data, error } = await supabase
    .from("qualyflow_analyses")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return toAnalysis(data);
}

const INSERT_CHUNK = 200;

export async function saveAnalyses(records: AnalysisRecord[]): Promise<AnalysisRecord[]> {
  if (records.length === 0) {
    return [];
  }

  const rows = records.map((record) => ({
    ...(isUuid(record.id) ? { id: record.id } : {}),
    ...analysisPayload(record),
  }));

  const saved: AnalysisRecord[] = [];

  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    const chunk = rows.slice(index, index + INSERT_CHUNK);
    const { data, error } = await supabase.from("qualyflow_analyses").insert(chunk).select("*");
    if (error) {
      throw error;
    }
    saved.push(...(data ?? []).map(toAnalysis));
  }

  return saved;
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await supabase.from("qualyflow_analyses").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteAllAnalyses(): Promise<void> {
  const { error } = await supabase
    .from("qualyflow_analyses")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (error) {
    throw error;
  }
}

/* ---------------------------------------------------------------- configurações */

export async function fetchSettings(): Promise<QualyflowSettings> {
  const { data, error } = await supabase
    .from("qualyflow_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return normalizeSettings(undefined);
  }
  return normalizeSettings(toSettings(data));
}

function toSettings(row: SettingsRow): QualyflowSettings {
  return normalizeSettings({
    header: asObject<Partial<QualyflowSettings["header"]>>(row.header, {}),
    logos: asObject<Partial<QualyflowSettings["logos"]>>(row.logos, {}),
  } as Partial<QualyflowSettings>);
}

export async function saveSettings(settings: QualyflowSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const { error } = await supabase.from("qualyflow_settings").upsert(
    {
      id: "default",
      header: normalized.header,
      logos: normalized.logos,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

/* --------------------------------------------------------- migração da base local */

export async function countReports(): Promise<number> {
  const { count, error } = await supabase
    .from("qualyflow_reports")
    .select("id", { count: "exact", head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function countAnalyses(): Promise<number> {
  const { count, error } = await supabase
    .from("qualyflow_analyses")
    .select("id", { count: "exact", head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
}
