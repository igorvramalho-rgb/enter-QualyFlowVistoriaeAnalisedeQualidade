import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo-storage";
import type { PhotoEntry, PhotoMap } from "@/lib/report-document";

/**
 * Inventário **somente leitura** das fotografias do Emissor.
 *
 * Compara o que existe no armazenamento com o que os relatórios realmente
 * referenciam (`path`, `originalPath` e `history`). Nada é apagado, movido ou
 * alterado aqui: a função apenas classifica cada arquivo.
 */

export const PHOTO_PREFIX = "qualyflow/fotos";

/** Carência padrão antes de um arquivo sem referência virar candidato. */
export const DEFAULT_GRACE_DAYS = 30;

export type PhotoRole = "atual" | "original" | "historico";

export type PhotoCategory =
  | "referenciado_atual"
  | "referenciado_original"
  | "referenciado_historico"
  | "orfao_carencia"
  | "orfao_candidato"
  | "referencia_sem_arquivo";

export type SuggestedAction = "preservar" | "revisar" | "candidato";

export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  referenciado_atual: "Referenciado (foto atual)",
  referenciado_original: "Referenciado (original)",
  referenciado_historico: "Referenciado (histórico)",
  orfao_carencia: "Sem referência · em carência",
  orfao_candidato: "Sem referência · candidato",
  referencia_sem_arquivo: "Referência sem arquivo",
};

export interface PhotoReference {
  reportId: string;
  reportName: string;
  slot: string;
  role: PhotoRole;
}

export interface BucketFile {
  path: string;
  bytes: number;
  createdAt: string;
}

export interface ReportPhotoSource {
  id: string;
  name: string;
  photos: PhotoMap;
}

export interface InventoryRow {
  path: string;
  bytes: number;
  createdAt: string;
  ageDays: number;
  category: PhotoCategory;
  references: PhotoReference[];
  /** Citado por dois ou mais relatórios (ex.: relatório duplicado). */
  shared: boolean;
  action: SuggestedAction;
  note: string;
}

export interface CategoryTotal {
  files: number;
  bytes: number;
}

export interface InventorySummary {
  files: number;
  bytes: number;
  referencedFiles: number;
  referencedBytes: number;
  sharedFiles: number;
  orphanGraceFiles: number;
  orphanGraceBytes: number;
  orphanCandidateFiles: number;
  orphanCandidateBytes: number;
  missingFiles: number;
  recoverableBytes: number;
  oldestFileAt: string;
  newestFileAt: string;
  byCategory: Record<PhotoCategory, CategoryTotal>;
}

export interface PhotoInventory {
  rows: InventoryRow[];
  summary: InventorySummary;
  graceDays: number;
  generatedAt: string;
}

const EXTERNAL_SOURCE = /^(https?:|data:|blob:)/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function emptyTotals(): Record<PhotoCategory, CategoryTotal> {
  return {
    referenciado_atual: { files: 0, bytes: 0 },
    referenciado_original: { files: 0, bytes: 0 },
    referenciado_historico: { files: 0, bytes: 0 },
    orfao_carencia: { files: 0, bytes: 0 },
    orfao_candidato: { files: 0, bytes: 0 },
    referencia_sem_arquivo: { files: 0, bytes: 0 },
  };
}

/** Lê os caminhos de foto citados por todos os relatórios visíveis. */
export async function fetchReportPhotoSources(): Promise<ReportPhotoSource[]> {
  const { data, error } = await supabase.from("qualyflow_reports").select("id, name, photos");

  if (error) {
    throw new Error(`Não foi possível ler os relatórios: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    photos: (row.photos ?? {}) as unknown as PhotoMap,
  }));
}

/** Lista os arquivos do bucket, paginando até o fim (somente leitura). */
export async function listBucketFiles(prefix = PHOTO_PREFIX): Promise<BucketFile[]> {
  const pageSize = 100;
  const files: BucketFile[] = [];

  for (let page = 0; page < 100; page += 1) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(prefix, {
      limit: pageSize,
      offset: page * pageSize,
    });

    if (error) {
      throw new Error(`Não foi possível listar o armazenamento: ${error.message}`);
    }

    const items = data ?? [];
    for (const item of items) {
      // Entradas sem id são pastas, não arquivos.
      if (!item.name || item.id === null) {
        continue;
      }
      const size = (item.metadata as { size?: number } | null)?.size;
      files.push({
        path: `${prefix}/${item.name}`,
        bytes: Number(size ?? 0),
        createdAt: item.created_at ?? "",
      });
    }

    if (items.length < pageSize) {
      break;
    }
  }

  return files;
}

/** Constrói o mapa caminho → referências encontradas nos relatórios. */
export function collectReferences(reports: ReportPhotoSource[]): Map<string, PhotoReference[]> {
  const map = new Map<string, PhotoReference[]>();
  const seen = new Set<string>();

  const add = (path: string | undefined, reference: PhotoReference) => {
    if (!path || EXTERNAL_SOURCE.test(path)) {
      return;
    }
    const key = `${reference.reportId}|${reference.slot}|${reference.role}|${path}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const list = map.get(path) ?? [];
    list.push(reference);
    map.set(path, list);
  };

  for (const report of reports) {
    for (const [slot, value] of Object.entries(report.photos ?? {})) {
      const photo = value as PhotoEntry | undefined;
      if (!photo) {
        continue;
      }
      const base = { reportId: report.id, reportName: report.name, slot };

      add(photo.path, { ...base, role: "atual" });
      if (photo.originalPath && photo.originalPath !== photo.path) {
        add(photo.originalPath, { ...base, role: "original" });
      }
      for (const previous of photo.history ?? []) {
        if (previous && previous !== photo.path && previous !== photo.originalPath) {
          add(previous, { ...base, role: "historico" });
        }
      }
    }
  }

  return map;
}

function primaryCategory(references: PhotoReference[]): PhotoCategory {
  if (references.some((reference) => reference.role === "atual")) {
    return "referenciado_atual";
  }
  if (references.some((reference) => reference.role === "original")) {
    return "referenciado_original";
  }
  return "referenciado_historico";
}

function ageInDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - created) / DAY_MS));
}

export function buildInventory(params: {
  files: BucketFile[];
  reports: ReportPhotoSource[];
  graceDays?: number;
  now?: Date;
}): PhotoInventory {
  const graceDays = params.graceDays ?? DEFAULT_GRACE_DAYS;
  const now = params.now ?? new Date();
  const references = collectReferences(params.reports);
  const fileMap = new Map(params.files.map((file) => [file.path, file]));

  const rows: InventoryRow[] = [];

  for (const file of params.files) {
    const refs = references.get(file.path) ?? [];
    const ageDays = ageInDays(file.createdAt, now);
    const shared = new Set(refs.map((reference) => reference.reportId)).size > 1;

    let category: PhotoCategory;
    let action: SuggestedAction;
    let note: string;

    if (refs.length > 0) {
      category = primaryCategory(refs);
      action = "preservar";
      note = shared
        ? `Citado por ${new Set(refs.map((reference) => reference.reportId)).size} relatórios`
        : "Em uso por relatório existente";
    } else if (ageDays < graceDays) {
      category = "orfao_carencia";
      action = "revisar";
      note = `Carência: faltam ${graceDays - ageDays} dia(s)`;
    } else {
      category = "orfao_candidato";
      action = "candidato";
      note = "Sem referência em nenhum relatório";
    }

    rows.push({
      path: file.path,
      bytes: file.bytes,
      createdAt: file.createdAt,
      ageDays,
      category,
      references: refs,
      shared,
      action,
      note,
    });
  }

  // Referências que não encontraram arquivo: prova de integridade, nunca exclusão.
  for (const [path, refs] of references) {
    if (fileMap.has(path)) {
      continue;
    }
    rows.push({
      path,
      bytes: 0,
      createdAt: "",
      ageDays: 0,
      category: "referencia_sem_arquivo",
      references: refs,
      shared: new Set(refs.map((reference) => reference.reportId)).size > 1,
      action: "preservar",
      note: "Referenciado por relatório, mas ausente no armazenamento",
    });
  }

  const byCategory = emptyTotals();
  const summary: InventorySummary = {
    files: params.files.length,
    bytes: params.files.reduce((total, file) => total + file.bytes, 0),
    referencedFiles: 0,
    referencedBytes: 0,
    sharedFiles: 0,
    orphanGraceFiles: 0,
    orphanGraceBytes: 0,
    orphanCandidateFiles: 0,
    orphanCandidateBytes: 0,
    missingFiles: 0,
    recoverableBytes: 0,
    oldestFileAt: "",
    newestFileAt: "",
    byCategory,
  };

  for (const row of rows) {
    byCategory[row.category].files += 1;
    byCategory[row.category].bytes += row.bytes;

    switch (row.category) {
      case "referenciado_atual":
      case "referenciado_original":
      case "referenciado_historico":
        summary.referencedFiles += 1;
        summary.referencedBytes += row.bytes;
        break;
      case "orfao_carencia":
        summary.orphanGraceFiles += 1;
        summary.orphanGraceBytes += row.bytes;
        break;
      case "orfao_candidato":
        summary.orphanCandidateFiles += 1;
        summary.orphanCandidateBytes += row.bytes;
        break;
      default:
        summary.missingFiles += 1;
        break;
    }

    if (row.shared && row.category !== "referencia_sem_arquivo") {
      summary.sharedFiles += 1;
    }
  }

  summary.recoverableBytes = summary.orphanCandidateBytes;

  const dates = params.files
    .map((file) => file.createdAt)
    .filter((value) => Boolean(value))
    .sort();

  summary.oldestFileAt = dates[0] ?? "";
  summary.newestFileAt = dates[dates.length - 1] ?? "";

  rows.sort((a, b) => {
    const order: PhotoCategory[] = [
      "orfao_candidato",
      "orfao_carencia",
      "referencia_sem_arquivo",
      "referenciado_atual",
      "referenciado_original",
      "referenciado_historico",
    ];
    const diff = order.indexOf(a.category) - order.indexOf(b.category);
    return diff !== 0 ? diff : b.bytes - a.bytes;
  });

  return {
    rows,
    summary,
    graceDays,
    generatedAt: now.toISOString(),
  };
}

/** Linhas do CSV, na mesma ordem exibida na tela. */
export function inventoryCsvRows(inventory: PhotoInventory): string[][] {
  return inventory.rows.map((row) => [
    row.path,
    CATEGORY_LABELS[row.category],
    row.action,
    row.shared ? "sim" : "não",
    String(row.bytes),
    (row.bytes / 1024).toFixed(0),
    row.createdAt,
    String(row.ageDays),
    row.references.map((reference) => reference.reportName).join(" | "),
    row.references.map((reference) => reference.slot).join(" | "),
    row.references.map((reference) => reference.role).join(" | "),
    row.note,
  ]);
}

export const INVENTORY_CSV_HEADERS = [
  "caminho",
  "categoria",
  "acao_sugerida",
  "compartilhado_entre_relatorios",
  "bytes",
  "tamanho_kb",
  "criado_em",
  "idade_dias",
  "relatorios",
  "campos",
  "papeis",
  "observacao",
];
