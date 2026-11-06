import { deriveNumbersFromFileName, sanitizeAddress } from "@/lib/fields";

/**
 * Regras de leitura do FV (parte pura, sem pdf.js) para poder ser testada
 * isoladamente. Nada aqui decide conclusão técnica: os dados são apenas
 * localizados e a classificação original é preservada como veio.
 */

export type AuditorFieldKey =
  | "fac"
  | "os"
  | "data"
  | "endereco"
  | "municipio"
  | "localidade"
  | "servico"
  | "contratada"
  | "equipe";

export const AUDITOR_FIELDS: { key: AuditorFieldKey; label: string }[] = [
  { key: "fac", label: "Nº FAC" },
  { key: "os", label: "OS" },
  { key: "data", label: "Data da fiscalização" },
  { key: "endereco", label: "Endereço" },
  { key: "municipio", label: "Município" },
  { key: "localidade", label: "Localidade / Polo" },
  { key: "servico", label: "Tipo de serviço" },
  { key: "contratada", label: "Contratada" },
  { key: "equipe", label: "Equipe executante" },
];

export interface AuditorFieldValue {
  value: string;
  page: number | null;
}

export interface AuditorItem {
  code: string;
  description: string;
  /** Classificação original da AlphaGeos — nunca alterada pelo sistema. */
  originalResult: string;
  complement: string;
  page: number;
}

export interface AuditorCaption {
  text: string;
  page: number;
}

export type DivergenceLevel = "informacao" | "atencao" | "divergencia";

export interface AuditorDivergence {
  level: DivergenceLevel;
  message: string;
}

export interface PageText {
  page: number;
  text: string;
}

export interface ParsedDocument {
  fields: Record<AuditorFieldKey, AuditorFieldValue>;
  items: AuditorItem[];
  captions: AuditorCaption[];
  observations: string;
  divergences: AuditorDivergence[];
}

const FIELD_PATTERNS: Record<AuditorFieldKey, RegExp[]> = {
  fac: [/n[ºo°]?\s*fac\s*[:=]?\s*(\d{4,9})/i, /\bfac\s*[:=]?\s*(\d{4,9})/i],
  os: [
    /os\s*n?[ºo°]?\s*[:=]?\s*(\d{9,12})/i,
    /ordem\s*de\s*servi[cç]o\s*[:=]?\s*(\d{9,12})/i,
    /\bos\s*n?[ºo°]?\s*(\d{9,12})/i,
  ],
  data: [
    /data\s*(?:da\s*)?(?:avalia[cç][aã]o|vistoria|fiscaliza[cç][aã]o)\s*[:=]?\s*(\d{2}[/.]\d{2}[/.]\d{2,4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ],
  endereco: [/endere[cç]o\s*[:=]?\s*([^\n|]{5,120})/i],
  municipio: [/munic[ií]pio\s*[:=]?\s*([^\n|]{2,50})/i],
  localidade: [/localidade\s*[:=]?\s*([^\n|]{2,50})/i, /polo\s*[:=]?\s*([^\n|]{2,50})/i],
  servico: [
    /servi[cç]o\s*(?:executado|exda)\s*[:=]?\s*([^\n|]{3,100})/i,
    /tipo\s*de\s*servi[cç]o\s*[:=]?\s*([^\n|]{3,100})/i,
  ],
  contratada: [/contratada(?:\s*auditada)?\s*[:=]?\s*([^\n|]{2,80})/i],
  equipe: [/equipe(?:\s*executante)?\s*[:=]?\s*([^\n|]{2,80})/i],
};

const STOP_LABELS =
  /\b(?:n[ºo°]?\s*fac|os\s*n?[ºo°]?|data\s*(?:da\s*)?(?:avalia|vistoria|fiscaliza)|endere[cç]o|munic[ií]pio|polo|localidade|regi[aã]o|coordenadas|categoria|contratada|servi[cç]o|auditor|resultado|unidade|\u00e1rea|protocolo)\b/i;

/** Corta o valor no próximo rótulo conhecido (as colunas do PDF vêm coladas). */
function cleanValue(raw: string): string {
  const stop = raw.search(STOP_LABELS);
  const value = (stop > 0 ? raw.slice(0, stop) : raw).replace(/\s{2,}/g, " ").trim();
  return value.replace(/[;,.-]+$/, "").trim();
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (found?.[1]) {
      const value = cleanValue(found[1]);
      if (value) {
        return value;
      }
    }
  }
  return "";
}

/** Localiza os campos página a página e guarda a página de origem. */
export function extractFields(pages: PageText[]): Record<AuditorFieldKey, AuditorFieldValue> {
  const fields = Object.fromEntries(
    AUDITOR_FIELDS.map(({ key }) => [key, { value: "", page: null } as AuditorFieldValue]),
  ) as Record<AuditorFieldKey, AuditorFieldValue>;

  for (const page of pages) {
    for (const { key } of AUDITOR_FIELDS) {
      if (fields[key].value) {
        continue;
      }
      const value = firstMatch(page.text, FIELD_PATTERNS[key]);
      if (value) {
        fields[key] = {
          value: key === "endereco" ? sanitizeAddress(value) : value,
          page: page.page,
        };
      }
    }
  }

  return fields;
}

const ITEM_LINE = /^(\d{1,2}\.\d{1,2})\s+(?=[A-ZÀ-Ú(])/;
const RESULT_TOKENS: { regex: RegExp; label: string }[] = [
  { regex: /n[ãa]o\s*conforme/gi, label: "Não Conforme" },
  { regex: /\bn\s*\/\s*a\b/gi, label: "N/A" },
  { regex: /informativo/gi, label: "Informativo" },
  { regex: /\bconforme\b/gi, label: "Conforme" },
];

function readResult(block: string): { label: string; index: number; length: number } | null {
  const negatives: [number, number][] = [];
  let best: { label: string; index: number; length: number } | null = null;

  for (const token of RESULT_TOKENS) {
    token.regex.lastIndex = 0;
    let match = token.regex.exec(block);
    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      if (token.label === "Não Conforme") {
        negatives.push([start, end]);
      }
      const insideNegative =
        token.label === "Conforme" && negatives.some(([from, to]) => start >= from && start < to);
      if (!insideNegative && (!best || start > best.index)) {
        best = { label: token.label, index: start, length: match[0].length };
      }
      match = token.regex.exec(block);
    }
  }

  return best;
}

/** Etapas avaliadas da página, com a classificação original preservada. */
export function parseItems(pageText: string, page: number): AuditorItem[] {
  const start = pageText.search(/itens\s*avaliados/i);
  if (start < 0) {
    return [];
  }

  const lines = pageText.slice(start).split("\n");
  const items: AuditorItem[] = [];
  let current: { code: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) {
      return;
    }
    const block = current.lines.join(" ").replace(/\s{2,}/g, " ").trim();
    const result = readResult(block);
    const description = (result ? block.slice(0, result.index) : block)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    items.push({
      code: current.code,
      description,
      originalResult: result?.label ?? "",
      complement: result ? block.slice(result.index + result.length).trim().slice(0, 220) : "",
      page,
    });
    current = null;
  };

  for (const line of lines) {
    const match = ITEM_LINE.exec(line);
    if (match) {
      flush();
      current = { code: match[1], lines: [line.slice(match[0].length)] };
      continue;
    }
    if (/^(item|descritivo|avalia[cç][aã]o|complemento)\b/i.test(line)) {
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  flush();

  return items.filter((item) => item.description.length > 0);
}

const CAPTION_LINE = /^foto\s*\d{1,3}\s*[-–—:.]?\s*(.{3,140})$/i;

/** Legenda de foto (conferência humana; nunca usada como prova automática). */
export function parseCaptions(pageText: string, page: number): AuditorCaption[] {
  return pageText
    .split("\n")
    .map((line) => CAPTION_LINE.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match?.[1]))
    .map((match) => ({ text: match[1].trim(), page }));
}

export function readObservations(pages: PageText[]): string {
  for (const item of pages) {
    const found = /observa[cç][oõ]es|obs\s*[:=]/i.exec(item.text);
    if (found) {
      const after = item.text.slice(found.index + found[0].length).trim();
      if (after.length > 3) {
        return after.slice(0, 600);
      }
    }
  }
  return "";
}

export function buildDivergences(input: {
  fields: Record<AuditorFieldKey, AuditorFieldValue>;
  items: AuditorItem[];
  captions: AuditorCaption[];
  textAvailable: boolean;
  fileName: string;
  usedOcr: boolean;
}): AuditorDivergence[] {
  const list: AuditorDivergence[] = [];

  if (!input.textAvailable) {
    list.push({
      level: "atencao",
      message: "Documento sem camada de texto. Ligue o OCR para tentar ler o conteúdo.",
    });
  }

  if (input.items.length === 0) {
    list.push({
      level: "atencao",
      message: "Nenhuma etapa avaliada foi localizada. Confira o documento original.",
    });
  }

  const semClassificacao = input.items.filter((item) => !item.originalResult).length;
  if (semClassificacao > 0) {
    list.push({
      level: "atencao",
      message: `${semClassificacao} etapa(s) sem classificação explícita — não entram como conformidade.`,
    });
  }

  const avaliadas = input.items.filter((item) => item.originalResult !== "N/A");
  if (input.items.length > 0 && avaliadas.length === 0) {
    list.push({
      level: "informacao",
      message: "Todas as etapas estão N/A: não há avaliação positiva neste documento.",
    });
  }

  const temConforme = input.items.some((item) => item.originalResult === "Conforme");
  const temNaoConforme = input.items.some((item) => item.originalResult === "Não Conforme");
  if (temConforme && temNaoConforme) {
    list.push({
      level: "divergencia",
      message: "Há etapas conformes e não conformes no mesmo documento. Conferir antes de concluir.",
    });
  }

  const daNome = deriveNumbersFromFileName(input.fileName);
  if (daNome.fac && input.fields.fac.value && daNome.fac !== input.fields.fac.value) {
    list.push({
      level: "divergencia",
      message: `FV do texto (${input.fields.fac.value}) difere do nome do arquivo (${daNome.fac}).`,
    });
  }
  if (daNome.os && input.fields.os.value && daNome.os !== input.fields.os.value) {
    list.push({
      level: "divergencia",
      message: `OS do texto (${input.fields.os.value}) difere do nome do arquivo (${daNome.os}).`,
    });
  }

  if (!input.fields.endereco.value) {
    list.push({
      level: "atencao",
      message: "Endereço não identificado. Preencha na revisão antes de confirmar.",
    });
  }

  if (input.captions.length > 0) {
    list.push({
      level: "informacao",
      message: `${input.captions.length} legenda(s) de foto encontradas — a validação é humana.`,
    });
  }

  if (input.usedOcr) {
    list.push({
      level: "informacao",
      message: "Leitura por OCR em parte das páginas: confira os campos com atenção.",
    });
  }

  return list;
}

/** Junta a leitura de todas as páginas em um resultado único. */
export function parseAuditorPages(
  pages: PageText[],
  meta: { fileName: string; textAvailable: boolean; usedOcr: boolean },
): ParsedDocument {
  const fields = extractFields(pages);
  const items: AuditorItem[] = [];
  const seen = new Set<string>();
  const captions: AuditorCaption[] = [];

  for (const page of pages) {
    for (const item of parseItems(page.text, page.page)) {
      if (seen.has(item.code)) {
        continue;
      }
      seen.add(item.code);
      items.push(item);
    }
    captions.push(...parseCaptions(page.text, page.page));
  }

  const observations = readObservations(pages);

  return {
    fields,
    items,
    captions,
    observations,
    divergences: buildDivergences({
      fields,
      items,
      captions,
      textAvailable: meta.textAvailable,
      fileName: meta.fileName,
      usedOcr: meta.usedOcr,
    }),
  };
}
