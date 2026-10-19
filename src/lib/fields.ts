/** Utilitários de texto, data e formatação usados nos relatórios e na análise. */

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Mantém as quebras de linha (necessárias para os padrões de extração). */
export function normalizeText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function tidyValue(value: string | undefined, maxLength = 90): string {
  if (!value) {
    return "";
  }
  const cleaned = stripAccents(value)
    .replace(/^[\s:|\-–—.]+/, "")
    .replace(/[\s|:;–—-]+$/, "")
    .replace(/[.\s]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

export function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

export function upper(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function formatDateBR(value: string | Date | undefined): string {
  if (!value) {
    return "";
  }
  const date = typeof value === "string" ? parseAnyDate(value) : value;
  if (!date || Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Converte "16/10/2026" ou "2026-10-16" para o formato aceito por <input type="date">. */
export function toDateInputValue(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const date = parseAnyDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseAnyDate(value: string): Date | null {
  const trimmed = value.trim();

  const br = trimmed.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function formatDateTimeBR(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${formatDateBR(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
}
