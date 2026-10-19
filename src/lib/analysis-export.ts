import {
  DOCUMENT_TYPE_LABELS,
  EXPORT_FIELDS,
  STATUS_LABELS,
  type AnalysisRecord,
  type AnalysisSource,
} from "@/lib/analysis";
import { formatDateBR } from "@/lib/fields";

export interface ExportMatrix {
  headers: string[];
  rows: string[][];
}

export const SOURCE_LABELS: Record<AnalysisSource, string> = {
  texto: "Texto do PDF",
  "nome-do-arquivo": "Nome do arquivo",
  manual: "Revisão manual",
  "sem-texto": "Sem texto (digitalizado)",
};

const EXTRA_HEADERS = [
  "Status",
  "Tipo de relatório",
  "Arquivo",
  "Páginas",
  "Origem dos dados",
  "Revisado",
];

/**
 * Matriz única de exportação, compartilhada pelo CSV e pelo Excel, garantindo
 * as mesmas colunas e a mesma ordem nos dois arquivos.
 */
export function buildAnalysisMatrix(records: AnalysisRecord[]): ExportMatrix {
  const headers = [...EXPORT_FIELDS.map((field) => field.label), ...EXTRA_HEADERS];

  const rows = records.map((record) => [
    ...EXPORT_FIELDS.map((field) => formatField(record, field.key)),
    STATUS_LABELS[record.status],
    DOCUMENT_TYPE_LABELS[record.documentType],
    record.fileName,
    String(record.pages),
    SOURCE_LABELS[record.source],
    record.reviewed ? "Sim" : "Não",
  ]);

  return { headers, rows };
}

function formatField(record: AnalysisRecord, key: string): string {
  const value = record.fields[key] ?? "";
  if (key === "data" && value) {
    const formatted = formatDateBR(value);
    return formatted || value;
  }
  return value;
}
