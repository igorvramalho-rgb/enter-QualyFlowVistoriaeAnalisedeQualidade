import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ANALYSIS_FIELDS,
  MAX_PAGES,
  PdfExtractionError,
  type AnalysisRecord,
  type AnalysisSource,
  type Confidence,
  type DocumentType,
  type QualityStatus,
} from "@/lib/analysis";
import {
  deriveNumbersFromFileName,
  normalizeText,
  sanitizeAddress,
  stripAccents,
  tidyValue,
} from "@/lib/fields";
import { createId } from "@/lib/storage";

export * from "@/lib/analysis";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface TextPart {
  x: number;
  text: string;
}

interface TextLine {
  text: string;
  y: number;
  parts: TextPart[];
}

interface BuiltLine {
  text: string;
  spans: { start: number; end: number; x: number }[];
}

interface ColumnLabel {
  key: string;
  pattern: RegExp;
}

/**
 * Rótulos da tabela de cabeçalho dos modelos, na ordem em que aparecem:
 * "OS Nº: | FV: | SERVIÇO EXDA: | POLO: | ENDEREÇO: | DATA:" (o modelo antigo
 * grafava esse campo como "Nº FAC").
 */
const TABLE_LABELS: ColumnLabel[] = [
  { key: "os", pattern: /\bos\s*n[º°.]?|\bos\s*[:=]/ },
  { key: "fac", pattern: /\bfv\b|n[º°.]?\s*fac/ },
  { key: "servicoExda", pattern: /servi[cc]o\s*exda/ },
  { key: "equipeExecutante", pattern: /equipe/ },
  { key: "tipoNaoConformidade", pattern: /tipo\s*de\s*nao\s*conformidade|tipo/ },
  { key: "polo", pattern: /polo/ },
  { key: "endereco", pattern: /endere[cç]o/ },
  { key: "data", pattern: /data/ },
];

/**
 * Rótulo e valor na mesma linha (tabela "DADOS DA VISTORIA" do SGZ-156 e
 * variações). Aplicado sobre o texto sem acentos e em minúsculas.
 */
const INLINE_PATTERNS: Record<string, RegExp[]> = {
  os: [
    /n[º°.]?\s*o\.?\s*s\.?\s*n?[º°.]?\s*[:=]?\s*([0-9][0-9./-]{4,})/,
    /\bos\s*n[º°.]?\s*[:=]?\s*([0-9][0-9./-]{4,})/,
    /\bo\.?\s*s\.?\s*[:=]?\s*([0-9][0-9./-]{4,})/,
  ],
  fac: [
    /n[º°.]?\s*fac\s*[:=]?\s*([0-9][0-9./-]{2,})/,
    /\b(fv[\s-]*[0-9][0-9./-]{2,})/,
    /\bfv\s*[:=]\s*([0-9][0-9./-]{2,})/,
  ],
  protocoloSgz: [/protocolo\s*(?:sgz)?\s*[:=]?\s*([0-9][0-9./-]{4,})/],
  contratada: [
    /contratada(?:\s*auditada)?\s*[:=]?\s*([^\n|]{2,60})/,
  ],
  servicoExda: [
    /servi[cc]o\s*(?:exda|executado)\s*[:=]?\s*([^\n|]{3,60})/,
    /servi[cc]o\s*[:=]\s*([^\n|]{3,60})/,
  ],
  equipeExecutante: [
    /equipe\s*(?:executante|de\s*execucao)?\s*[:=]?\s*([^\n|]{3,60})/,
  ],
  tipoNaoConformidade: [
    /tipo\s*de\s*nao\s*conformidade\s*[:=]?\s*([^\n|]{3,80})/,
    /motivo\s*(?:da\s*)?(?:nao\s*conformidade)?\s*[:=]?\s*([^\n|]{3,80})/,
    /descri[cçc][aã]o\s*(?:da\s*)?(?:nao\s*conformidade)?\s*[:=]?\s*([^\n|]{3,80})/,
    /apontamento\s*(?:de\s*)?(?:nao\s*conformidade)?\s*[:=]?\s*([^\n|]{3,80})/,
    /itens?\s*nao\s*conformes?\s*[:=]?\s*([^\n|]{3,80})/,
    /pendencia\s*[:=]?\s*([^\n|]{3,80})/,
    /nao\s*conformidade\s*[:=]\s*([^\n|]{3,80})/,
    /tipo\s*[:=]\s*([^\n|]{3,80})/,
  ],
  origemDemanda: [/origem\s*da\s*demanda\s*[:=]?\s*([^\n|]{2,60})/],
  prazo: [
    /prazo\s*para\s*conclusao\s*[:=]?\s*([^\n|]{2,40})/,
    /prazo\s*[:=]?\s*([^\n|]{2,40})/,
  ],
  polo: [/polo\s*[:=]?\s*([a-z][^\n|]{1,40})/],
  endereco: [/endere[cç]o\s*[:=]?\s*([^\n|]{5,80})/],
  data: [
    /data\s*(?:da\s*|de\s*)?avaliacao\s*[:=]?\s*(\d{2}[/.-]\d{2}[/.-]\d{2,4})/,
    /data\s*(?:da\s*)?vistoria\s*[:=]?\s*(\d{2}[/.-]\d{2}[/.-]\d{2,4})/,
    /data\s*[:=]?\s*(\d{2}[/.-]\d{2}[/.-]\d{2,4})/,
    /(\d{2}\/\d{2}\/\d{4})/,
  ],
};

const ADDRESS_FALLBACK = [
  /\b((?:r\.|rua|av\.?|avenida|alameda|estrada|travessa|tv\.?)\s+[^\n|,]{3,50}(?:,\s*\d{1,6})?)/,
];

export interface AnalyzeOptions {
  onProgress?: (page: number, total: number) => void;
  /** Liga o OCR local nas páginas sem camada de texto aproveitável. */
  ocr?: boolean;
  onOcrProgress?: (stage: string, page: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export async function analyzePdfFile(
  file: File,
  onProgressOrOptions?: ((page: number, total: number) => void) | AnalyzeOptions,
): Promise<AnalysisRecord> {
  const options: AnalyzeOptions =
    typeof onProgressOrOptions === "function"
      ? { onProgress: onProgressOrOptions }
      : onProgressOrOptions ?? {};
  const onProgress = options.onProgress;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    throw new PdfExtractionError("Selecione um arquivo PDF de vistoria.");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: buffer });
  let document: pdfjs.PDFDocumentProxy;
  try {
    document = await loadingTask.promise;
  } catch {
    void loadingTask.destroy();
    throw new PdfExtractionError("Não foi possível ler este PDF. O arquivo pode estar corrompido.");
  }

  try {
    if (document.numPages > MAX_PAGES) {
      throw new PdfExtractionError(
        `O arquivo tem ${document.numPages} páginas. O limite por arquivo é de ${MAX_PAGES}.`,
      );
    }

    const lines: TextLine[] = [];
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.(pageNumber, document.numPages);
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageLinesText = pageLines(content.items);
      const pageText = normalizeText(pageLinesText.map((line) => line.text).join("\n"));
      pageTexts.push(pageText);
      lines.push(...pageLinesText);
      page.cleanup();
    }

    const record = buildRecord(file, document.numPages, lines);

    // OCR local apenas nas páginas sem texto aproveitável (opcional)
    if (options.ocr) {
      const { ocrPdfPages, pageNeedsOcr } = await import("@/lib/pdf-ocr");
      const paginasSemTexto = pageTexts.filter((text) => pageNeedsOcr(text)).length;

      if (paginasSemTexto > 0) {
        const resultados = await ocrPdfPages(file, pageTexts, {
          onProgress: options.onOcrProgress,
          shouldCancel: options.shouldCancel,
        });

        if (resultados.length > 0) {
          const ocrLines: TextLine[] = [];
          resultados.forEach((resultado) => {
            resultado.text
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .forEach((line, index) =>
                ocrLines.push({ text: line, y: 1000 - index * 10, parts: [{ x: 0, text: line }] }),
              );
          });

          const comOcr = buildRecord(file, document.numPages, [...lines, ...ocrLines]);
          const mediaConfianca =
            resultados.reduce((soma, item) => soma + item.confidence, 0) / resultados.length;

          return {
            ...comOcr,
            snippet: `${comOcr.snippet}\n\n[OCR local] páginas reconhecidas: ${resultados
              .map((item) => item.page)
              .join(", ")} • confiança média ${mediaConfianca.toFixed(0)}%`,
            reviewed: false,
          };
        }
      }
    }

    return record;
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      /* a leitura terminou; falha ao liberar o worker não invalida o resultado */
    }
  }
}

function buildRecord(file: File, pages: number, lines: TextLine[]): AnalysisRecord {
  const text = normalizeText(lines.map((line) => line.text).join("\n"));

  const normalized = stripAccents(text).toLowerCase();
  const hasText = normalized.replace(/\s/g, "").length >= 40;
  const fromName = recordFromFileName(file.name);

  const fields: Record<string, string> = {};
  const confidence: Record<string, Confidence> = {};

  const setField = (key: string, value: string, level: Confidence) => {
    const base = key === "endereco" ? sanitizeAddress(value) : value;
    const clean = tidyValue(cutAtStopWords(stripTrailingLabels(base), key), 120);
    if (!clean) {
      return;
    }
    if (confidence[key] && rank(confidence[key]) >= rank(level)) {
      return;
    }
    fields[key] = clean;
    confidence[key] = level;
  };

  if (hasText) {
    Object.entries(extractTableFields(lines)).forEach(([key, value]) =>
      setField(key, value, "alta"),
    );

    const itensNaoConformes = extractNonConformityItems(text);
    if (itensNaoConformes) {
      setField("tipoNaoConformidade", itensNaoConformes, "media");
    }

    Object.entries(INLINE_PATTERNS).forEach(([key, patterns]) => {
      const value = matchFirst(text, normalized, patterns);
      if (value) {
        setField(key, value, "media");
      }
    });

    const osFallback = matchFirst(text, normalized, [
      /\b(\d{10})\b/,
      /\b(\d{9})\b/,
      /\b(\d{11})\b/,
    ]);
    if (osFallback) {
      setField("os", osFallback, "baixa");
    }

    const address = matchFirst(text, normalized, ADDRESS_FALLBACK);
    if (address) {
      setField("endereco", address, "baixa");
    }
  }

  Object.entries(fromName).forEach(([key, value]) => {
    if (value) {
      setField(key, value, "baixa");
    }
  });

  ANALYSIS_FIELDS.forEach(({ key }) => {
    if (!fields[key]) {
      confidence[key] = "nenhuma";
    }
  });

  if (fields.polo) {
    fields.polo = fields.polo.charAt(0).toUpperCase() + fields.polo.slice(1);
  }

  const documentType = detectDocumentType(normalized, file.name);
  const source: AnalysisSource = hasText
    ? "texto"
    : Object.keys(fromName).length > 0
      ? "nome-do-arquivo"
      : "sem-texto";

  return {
    id: createId(),
    fingerprint: `${file.name}::${pages}::${text.slice(0, 140)}`,
    fileName: file.name,
    pages,
    analyzedAt: new Date().toISOString(),
    documentType,
    textAvailable: hasText,
    source,
    fields,
    confidence,
    status: detectStatus(normalized, fields.situacao, documentType, fields.tipoNaoConformidade),
    snippet: text.slice(0, 1200),
  };
}

/**
 * Leitura por colunas: encontra a linha de rótulos da tabela e distribui os
 * valores das linhas seguintes nas colunas pela posição horizontal. Funciona
 * tanto para conteúdo em célula separada quanto para a mesma linha do rótulo.
 */
function extractTableFields(lines: TextLine[]): Partial<Record<string, string>> {
  let best: Partial<Record<string, string>> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const labelLine = buildLine(lines[index].parts);
    const columns = matchColumns(labelLine.text);

    if (columns.length < 4) {
      continue;
    }

    const positions = columns.map((column) => ({
      key: column.key,
      x: spanX(labelLine.spans, column.start),
    }));

    const boundaries = positions.map((position, positionIndex) =>
      positionIndex === 0
        ? Number.NEGATIVE_INFINITY
        : (positions[positionIndex - 1].x + position.x) / 2,
    );

    const leftLimit = positions[0].x - 24;
    const result: Partial<Record<string, string>> = {};
    let previousY = lines[index].y;
    let wrapLine = -1;

    for (let scan = index + 1; scan < Math.min(index + 3, lines.length); scan += 1) {
      const line = lines[scan];
      if (line.parts.length === 0) {
        continue;
      }

      const leftmost = Math.min(...line.parts.map((part) => part.x));
      const gap = previousY - line.y;
      if (leftmost < leftLimit || gap > 40) {
        break;
      }
      previousY = line.y;

      line.parts.forEach((part) => {
        const columnIndex = findColumnIndex(part.x, boundaries);
        const key = positions[columnIndex]?.key;
        if (!key) {
          return;
        }
        result[key] = result[key] ? `${result[key]} ${part.text}` : part.text;
      });

      if (Object.keys(result).length >= positions.length) {
        wrapLine = scan + 1;
        break;
      }
    }

    // Linha de quebra da última célula (ex.: "VIA - REPOSICAO" + "ASFALTICA").
    if (wrapLine > 0 && wrapLine < lines.length) {
      const wrapped = lines[wrapLine];
      const gap = previousY - wrapped.y;
      const leftmost = wrapped.parts.length > 0 ? Math.min(...wrapped.parts.map((p) => p.x)) : 0;
      const looksLikeWrap =
        wrapped.parts.length > 0 &&
        wrapped.parts.length <= 2 &&
        wrapped.parts.every((part) => part.text.split(/\s+/).length <= 3 && part.text.length <= 30);

      if (looksLikeWrap && leftmost >= leftLimit && gap <= 40) {
        wrapped.parts.forEach((part) => {
          const columnIndex = findColumnIndex(part.x, boundaries);
          const key = positions[columnIndex]?.key;
          if (!key) {
            return;
          }
          result[key] = result[key] ? `${result[key]} ${part.text}` : part.text;
        });
      }
    }

    if (Object.keys(result).length > Object.keys(best).length) {
      best = result;
    }
    if (Object.keys(best).length >= 4) {
      break;
    }
  }

  return best;
}

function spanX(spans: BuiltLine["spans"], offset: number): number {
  const span = spans.find((candidate) => offset >= candidate.start && offset < candidate.end);
  return span?.x ?? spans[spans.length - 1]?.x ?? 0;
}

function matchColumns(text: string): { key: string; start: number; end: number }[] {
  const found: { key: string; start: number; end: number }[] = [];
  const used: { start: number; end: number }[] = [];

  for (const label of TABLE_LABELS) {
    const pattern = new RegExp(label.pattern.source, "g");
    let match = pattern.exec(text);

    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = used.some((range) => start < range.end && end > range.start);
      if (!overlaps) {
        found.push({ key: label.key, start, end });
        used.push({ start, end });
        break;
      }
      match = pattern.exec(text);
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

function findColumnIndex(x: number, boundaries: number[]): number {
  for (let index = 0; index < boundaries.length; index += 1) {
    if (x < boundaries[index]) {
      return index - 1 >= 0 ? index - 1 : 0;
    }
  }
  return boundaries.length - 1;
}

function buildLine(parts: TextPart[]): BuiltLine {
  const ordered = [...parts].sort((a, b) => a.x - b.x);
  let text = "";
  const spans: BuiltLine["spans"] = [];

  ordered.forEach((part, index) => {
    if (index > 0) {
      text += " ";
    }
    const start = text.length;
    text += part.text;
    spans.push({ start, end: text.length, x: part.x });
  });

  return { text: stripAccents(text).toLowerCase(), spans };
}

/**
 * Corta a captura quando o valor "engole" o próximo rótulo da tabela
 * (ex.: "POLO: ENDEREÇO: DATA:"), evitando dados falsos.
 */
const LABEL_GUARD =
  /(?:^|\s)(?:os|n[º°]?\s*fac|n[º°]?\s*o\.?\s*s\.?|servi[cc]o|polo|endere[cç]o|data|origem\s*da\s*demanda|prazo|contratada)\s*[:=]/i;

function stripTrailingLabels(value: string): string {
  const match = LABEL_GUARD.exec(value);
  return match ? value.slice(0, match.index) : value;
}

const STOP_WORDS = [
  "situacao atual",
  "situacao",
  "em obra",
  "asfalto provisorio",
  "asfalto definitivo",
  "falta repor sinalizacao",
  "protocolo sgz",
  "protocolo",
  "origem da demanda",
  "prazo para conclusao",
  "prazo",
  "contratada",
  "endereco",
  "polo",
  "servico exda",
  "servico acatado",
  "coordenadas",
  "categoria",
  "auditor",
  "conceito",
  "lider",
  "unidade area",
  "tipo de nao conformidade",
  "equipe executante",
  "equipe",
  "fv",
  "n fac",
];

const OWN_LABELS: Record<string, string[]> = {
  endereco: ["endereco"],
  polo: ["polo"],
  prazo: ["prazo", "prazo para conclusao"],
  protocoloSgz: ["protocolo", "protocolo sgz"],
  origemDemanda: ["origem da demanda"],
  situacao: ["situacao", "situacao atual"],
  contratada: ["contratada"],
  servicoExda: ["servico exda"],
  equipeExecutante: ["equipe", "equipe executante"],
  tipoNaoConformidade: ["tipo de nao conformidade"],
  fac: ["fv", "n fac"],
};

/** Corta o valor antes do próximo rótulo da ficha (ex.: "FINALIZADA Situação Atual"). */
function cutAtStopWords(value: string, fieldKey: string): string {
  const normalizedValue = stripAccents(value).toLowerCase();
  const own = OWN_LABELS[fieldKey] ?? [];
  let cutIndex = value.length;

  STOP_WORDS.forEach((word) => {
    if (own.includes(word)) {
      return;
    }
    const index = normalizedValue.indexOf(word);
    if (index > 0 && index < cutIndex) {
      cutIndex = index;
    }
  });

  return value.slice(0, cutIndex).trim();
}

/**
 * O formulário FV traz a tabela "ITENS AVALIADOS", onde cada item recebe um
 * veredito (Conforme / Não Conforme / N/A). Aqui são montados os motivos: o
 * número e a descrição de cada item marcado como "Não Conforme".
 */
export function extractNonConformityItems(raw: string, limit = 3): string {
  const text = raw.replace(/\s+/g, " ");
  const start = text.search(/itens\s*avaliados/i);
  const section = start >= 0 ? text.slice(start) : text;

  const found = new Map<string, string>();
  const verdict = /n[aã]o\s*conforme/gi;
  let match = verdict.exec(section);
  let guard = 0;

  while (match && guard < 60) {
    guard += 1;
    const before = section.slice(0, match.index);
    const numberMatch = /(\d+\.\d+)\s+(?![\s\S]*\d+\.\d+)/.exec(before);

    if (numberMatch) {
      const item = numberMatch[1];
      const description = before
        .slice(numberMatch.index + numberMatch[0].length)
        .replace(/n[aã]o\s*conforme/gi, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+(?:caso|e|ou|de|com|para|informe)\s*$/i, "")
        .trim();

      if (description && !found.has(item)) {
        found.set(item, `${item} ${description}`.slice(0, 120).trim());
      }
    }

    match = verdict.exec(section);
  }

  return Array.from(found.values()).slice(0, limit).join(" | ");
}

function rank(level: Confidence): number {
  return { nenhuma: 0, baixa: 1, media: 2, alta: 3 }[level];
}

/**
 * Roda o padrão sobre o texto normalizado (sem acentos, minúsculo) mas devolve
 * o trecho do texto original, preservando a grafia do documento. stripAccents
 * preserva o comprimento, então os índices coincidem.
 */
function matchFirst(raw: string, normalized: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (!match) {
      continue;
    }

    const groupIndex = match.findIndex((group, index) => index > 0 && Boolean(group && group.trim()));
    if (groupIndex <= 0) {
      continue;
    }

    const value = match[groupIndex];
    const withinMatch = match[0].lastIndexOf(value);
    const start = match.index + (withinMatch >= 0 ? withinMatch : 0);
    const original = raw.slice(start, start + value.length);
    const cleaned = tidyValue(original);

    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return null;
}

/** Nome do arquivo costuma carregar OS, endereço e data em PDFs digitalizados. */
function recordFromFileName(fileName: string): Partial<Record<string, string>> {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ");
  const result: Partial<Record<string, string>> = {};

  const date = base.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (date) {
    result.data = `${date[1].padStart(2, "0")}/${date[2].padStart(2, "0")}/${date[3]}`;
  }

  const fromName = deriveNumbersFromFileName(fileName);
  if (fromName.fac) {
    result.fac = fromName.fac;
  }
  if (fromName.os) {
    result.os = fromName.os;
  }

  const address = base.match(
    /\b((?:R\.|RUA|AV\.?|AVENIDA|ALAMEDA|ESTRADA|TRAVESSA|TV\.?)\s[^,;]{3,60}(?:,\s*\d{1,6})?)/i,
  );
  if (address) {
    result.endereco = tidyValue(address[1], 80);
  }

  const polo = base.match(/\b(?:polo)\s*[:-]?\s*([A-Za-zÀ-ÿ ]{3,30})/i);
  if (polo) {
    result.polo = tidyValue(polo[1], 40);
  }

  return result;
}

function detectDocumentType(normalized: string, fileName: string): DocumentType {
  const haystack = `${normalized} ${stripAccents(fileName).toLowerCase()}`;
  if (/devolutiva\s*pos\s*60|pos\s*60/.test(haystack)) {
    if (/passeio|cimentado/.test(haystack)) {
      return "pos_60_passeio";
    }
    if (/\bvia\b|asfaltica|asfalto/.test(haystack)) {
      return "pos_60_via";
    }
  }
  if (/sgz\s*-?\s*156|demanda\s*sgz/.test(haystack)) {
    return "sgz_156";
  }
  return "indefinido";
}

/**
 * "N/A" / "não avaliado" indica que a vistoria não foi avaliada — isso não é
 * não conformidade. O sinal é lido do campo de tipo de NC, de um valor rotulado
 * (status/situação/resultado) e de células isoladas com "N/A".
 */
const NOT_EVALUATED_TOKEN =
  /\bn\s*[./]\s*a\b|\bnao\s*avaliad|\bsem\s*avaliacao\b|\bnao\s*se\s*aplica\b|inspecao\s*impossibilitad|\bnao\s*executad|\bnao\s*localizad|\bnao\s*realizad/;

function hasNotEvaluatedSignal(normalized: string, tipoNc: string): boolean {
  const token = NOT_EVALUATED_TOKEN;

  if (tipoNc && token.test(stripAccents(tipoNc).toLowerCase())) {
    return true;
  }

  const labeled = /(status|situacao|resultado|avaliacao|parecer)\s*[:=]?\s*([^\n|]{0,40})/g;
  let found: RegExpExecArray | null = labeled.exec(normalized);
  while (found) {
    if (token.test(found[2])) {
      return true;
    }
    found = labeled.exec(normalized);
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .some((line) =>
      /^(n\s*[./]\s*a|nao\s*avaliad[oa]?|nao\s*se\s*aplica|sem\s*avaliacao|inspecao\s*impossibilitad[ao]?|nao\s*executad[ao]?|nao\s*localizad[ao]?|nao\s*realizad[ao]?)$/.test(
        line,
      ),
    );
}

/** Lê o veredito de um campo rotulado (STATUS / SITUAÇÃO / RESULTADO / PARECER). */
function readLabeledStatus(normalized: string): QualityStatus | null {
  const labeled = /(?:status|situacao|resultado|parecer|avaliacao)\s*[:=]?\s*([^\n|]{0,48})/g;
  let found: RegExpExecArray | null = labeled.exec(normalized);

  while (found) {
    const value = found[1];
    if (NOT_EVALUATED_TOKEN.test(value)) {
      return "nao_avaliado";
    }
    if (/nao\s*conforme|reprovad|irregular|nao\s*atende/.test(value)) {
      return "nao_conforme";
    }
    if (/\bconforme\b|aprovad|regularizad/.test(value)) {
      return "conforme";
    }
    found = labeled.exec(normalized);
  }

  return null;
}

function detectStatus(
  normalized: string,
  situacao: string,
  documentType: DocumentType,
  tipoNaoConformidade: string,
): QualityStatus {
  const labeled = readLabeledStatus(normalized);

  if (labeled === "nao_avaliado" || hasNotEvaluatedSignal(normalized, tipoNaoConformidade)) {
    return "nao_avaliado";
  }
  if (labeled === "nao_conforme" || labeled === "conforme") {
    return labeled;
  }

  if (situacao) {
    const situacaoNormalized = stripAccents(situacao).toLowerCase();
    if (situacaoNormalized.includes("asfalto definitivo")) {
      return "conforme";
    }
    if (
      situacaoNormalized.includes("em obra") ||
      situacaoNormalized.includes("provisorio") ||
      situacaoNormalized.includes("falta repor")
    ) {
      return "em_andamento";
    }
  }

  if (/nao\s*conforme(?!idade)|reprovad|irregular|nao\s*atende/.test(normalized)) {
    return "nao_conforme";
  }
  if (/aprovad|finalizad|regularizad|concluid/.test(normalized)) {
    return "conforme";
  }
  // Pós 60 com parecer apenas INFORMATIVO não é conformidade: sai do "Conforme".
  // Restrito ao Pós 60 (onde havia o atalho que forçava "conforme") para não
  // afetar SGZ/indefinidos já classificados como Em Andamento.
  if (
    (documentType === "pos_60_passeio" || documentType === "pos_60_via") &&
    /\binformativo\b/.test(normalized) &&
    !/em\s*obra|em\s*andamento|provisorio|falta\s*repor/.test(normalized)
  ) {
    return "informativo";
  }
  if (documentType === "pos_60_passeio" || documentType === "pos_60_via") {
    return "conforme";
  }
  if (/em\s*obra|em\s*andamento|provisorio|pendente/.test(normalized)) {
    return "em_andamento";
  }
  return "pendente";
}

function pageLines(items: unknown[]): TextLine[] {
  const groups: { y: number; parts: TextPart[] }[] = [];

  items.forEach((item) => {
    const candidate = item as unknown as { str?: string; transform?: number[] };
    const text = candidate?.str ?? "";
    if (!text.trim() || !candidate.transform) {
      return;
    }
    const x = candidate.transform[4];
    const y = Math.round(candidate.transform[5] / 3) * 3;
    const group = groups.find((line) => Math.abs(line.y - y) <= 3);
    if (group) {
      group.parts.push({ x, text });
    } else {
      groups.push({ y, parts: [{ x, text }] });
    }
  });

  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => {
      const parts = group.parts
        .filter((part) => part.text.trim().length > 0)
        .sort((a, b) => a.x - b.x);
      return {
        text: parts
          .map((part) => part.text)
          .join(" ")
          .replace(/\s{2,}/g, " ")
          .trim(),
        y: group.y,
        parts,
      };
    })
    .filter((line) => line.text.length > 0);
}
