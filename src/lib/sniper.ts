import { deriveNumbersFromFileName, stripAccents } from "@/lib/fields";

/**
 * SNIPER ANALÍTICO — leitura pura do FV (sem pdf.js) para achar serviços cujo
 * documento traz **todas** as etapas em N/A.
 *
 * Nada aqui conclui avaliação técnica: o veredito de cada item é copiado do
 * documento e o "motivo" é o texto que o próprio PDF registra (bloco "Item não
 * avaliado", tabela de observação ou serviço acatado). Quando o motivo não
 * existe, o resultado diz isso em vez de inventar.
 */

export interface SniperCell {
  x: number;
  text: string;
}

export interface SniperLine {
  cells: SniperCell[];
}

export interface SniperPage {
  page: number;
  lines: SniperLine[];
}

export type SniperVerdict = "nao_executado" | "tudo_na" | "na_parcial" | "avaliado" | "sem_itens";

export type SniperMotivoOrigem =
  | "documento"
  | "observacao"
  | "servico_acatado"
  | "servico_executado"
  | "nao_execucao"
  | "ausente";

export interface SniperItem {
  code: string;
  description: string;
  /** Veredito copiado do documento: N/A · Conforme · Não Conforme · Informativo */
  result: string;
  section: string;
  page: number;
}

export interface SniperSectionSummary {
  key: string;
  label: string;
  total: number;
  na: number;
}

export interface SniperMotivo {
  code: string;
  text: string;
}

export interface SniperDocument {
  fileName: string;
  pages: number;
  hasText: boolean;
  fac: string;
  os: string;
  data: string;
  municipio: string;
  endereco: string;
  polo: string;
  unidade: string;
  categoria: string;
  contratada: string;
  servicoExecutado: string;
  servicoAcatado: string;
  auditor: string;
  conceito: string;
  items: SniperItem[];
  total: number;
  na: number;
  conforme: number;
  naoConforme: number;
  informativo: number;
  semResultado: number;
  sections: SniperSectionSummary[];
  motivos: SniperMotivo[];
  observacoes: SniperMotivo[];
  motivo: string;
  motivoOrigem: SniperMotivoOrigem;
  /** Serviço declarado como não executado — fora do N/A. */
  naoExecutado: boolean;
  verdict: SniperVerdict;
}

export const SNIPER_VERDICT_LABEL: Record<SniperVerdict, string> = {
  nao_executado: "Não executado",
  tudo_na: "100% N/A",
  na_parcial: "N/A parcial",
  avaliado: "Avaliado",
  sem_itens: "Sem itens",
};

export const SNIPER_MOTIVO_LABEL: Record<SniperMotivoOrigem, string> = {
  nao_execucao: "Serviço não executado no documento",
  documento: "Motivo registrado no documento",
  observacao: "Observação do documento",
  servico_acatado: "Motivo vem do serviço acatado",
  servico_executado: "Motivo vem do serviço executado",
  ausente: "Motivo não declarado no documento",
};

/** Seções do FCR Pós 60, na ordem do formulário. */
export const SNIPER_SECTION_LABEL: Record<string, string> = {
  "1": "Leito carroçável",
  "2": "Passeio / piso especial",
  "3": "Sinalização viária",
};

const CODE = /^\d{1,2}\.\d{1,2}$/;

const BOILERPLATE =
  /^(pagina\s*\d|formulario\s*de\s*verificacao|fcr\b|po-so|anexo\b|dados\s*da\s*fiscalizacao|foto\s*n|item$|descritivo$|avaliacao$|complemento$|observacao$)/i;

type HeaderKey =
  | "fac"
  | "os"
  | "data"
  | "municipio"
  | "endereco"
  | "polo"
  | "unidade"
  | "categoria"
  | "contratada"
  | "servicoExecutado"
  | "servicoAcatado"
  | "auditor"
  | "conceito";

const HEADER_FIELDS: { key: HeaderKey; test: RegExp }[] = [
  { key: "fac", test: /^(n[º°.]?\s*fac|fv)$/ },
  { key: "os", test: /^(os\s*n?[º°.]?|ordem\s*de\s*servico)$/ },
  { key: "data", test: /^data\s*(avaliacao|vistoria|fiscalizacao)?$/ },
  { key: "municipio", test: /^municipio$/ },
  { key: "endereco", test: /^endereco$/ },
  { key: "polo", test: /^polo$/ },
  { key: "unidade", test: /^unidade(\s*\/?\s*area)?\/?$/ },
  { key: "categoria", test: /^categoria$/ },
  { key: "contratada", test: /^contratada(\s*auditada)?$/ },
  { key: "servicoExecutado", test: /^servico\s*(executado|exda)$/ },
  { key: "servicoAcatado", test: /^servico\s*acatado$/ },
  { key: "auditor", test: /^auditor$/ },
  { key: "conceito", test: /^conceito$/ },
];

function norm(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function clean(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s|:;.,–—-]+/, "")
    .replace(/[\s|:;–—-]+$/, "")
    .trim();
}

function clip(value: string, max = 160): string {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function isBoilerplate(value: string): boolean {
  return BOILERPLATE.test(norm(value));
}

/** Veredito dentro de uma célula da coluna AVALIAÇÃO. */
export function readSniperResult(value: string): string {
  const text = norm(value);
  if (!text) {
    return "";
  }
  if (/\bnao\s*conforme\b/.test(text)) {
    return "Não Conforme";
  }
  if (/(^|\s)n\s*[/.]\s*a(\s|$)/.test(text) || /\bnao\s*avaliad/.test(text)) {
    return "N/A";
  }
  if (/\bconforme\b/.test(text)) {
    return "Conforme";
  }
  if (/\binformativo\b/.test(text)) {
    return "Informativo";
  }
  return "";
}

function headerKey(value: string): HeaderKey | null {
  const text = norm(value);
  if (!text) {
    return null;
  }
  return HEADER_FIELDS.find((field) => field.test.test(text))?.key ?? null;
}

/** Cabeçalho "rótulo | valor | rótulo | valor" das fichas FV/FCR. */
function readHeader(pages: SniperPage[]): Partial<Record<HeaderKey, string>> {
  const found: Partial<Record<HeaderKey, string>> = {};

  for (const page of pages.slice(0, 3)) {
    for (const line of page.lines) {
      const cells = line.cells.map((cell) => clean(cell.text));

      cells.forEach((text, index) => {
        if (!text) {
          return;
        }
        const direct = headerKey(text);
        if (direct) {
          const next = cells[index + 1];
          if (next && next.length > 0 && !headerKey(next) && !found[direct]) {
            found[direct] = clip(next, 110);
          }
          return;
        }

        const colon = text.indexOf(":");
        if (colon > 2) {
          const key = headerKey(text.slice(0, colon));
          const value = clean(text.slice(colon + 1));
          if (key && value && !found[key]) {
            found[key] = clip(value, 110);
          }
        }
      });
    }
  }

  return found;
}

interface ItemsReading {
  items: SniperItem[];
  motivos: SniperMotivo[];
  observacoes: SniperMotivo[];
  avaliacaoX: number | null;
}

const RAZAO_N_A =
  /\bservico\s*(nao\s*executado|nao\s*realizado)|nao\s*executad|nao\s*localizad|sem\s*acesso|inspecao\s*impossibilitad|nao\s*se\s*aplica|sem\s*avaliacao/;

/**
 * "Serviço não executado" é uma classificação própria: não entra no N/A.
 * A leitura olha o serviço executado/acatado e, quando todas as etapas estão
 * N/A, também o motivo registrado no documento.
 */
const NAO_EXECUTADO =
  /\bservico\s*nao\s*executado|\bnao\s*(?:foi\s*)?executad[oa]\b|\bsem\s*execucao\b|\bnao\s*houve\s*execucao\b|\bservico\s*nao\s*realizado\b/;

export function isServicoNaoExecutado(texto: string): boolean {
  return NAO_EXECUTADO.test(norm(texto));
}

function readItems(pages: SniperPage[]): ItemsReading {
  const items: SniperItem[] = [];
  const motivos: SniperMotivo[] = [];
  const observacoes: SniperMotivo[] = [];
  const vistos = new Set<string>();
  let avaliacaoX: number | null = null;

  for (const page of pages) {
    let modoObservacao = false;
    let buffer = "";
    const colunasMotivo: { x: number; motivo: SniperMotivo }[] = [];

    for (const line of page.lines) {
      const cells = line.cells.map((cell) => ({ x: cell.x, text: clean(cell.text) }));
      const texts = cells.map((cell) => cell.text).filter(Boolean);
      if (texts.length === 0) {
        continue;
      }
      const joined = texts.join(" ");

      // Cabeçalho da tabela de itens: guarda o x da coluna AVALIAÇÃO.
      if (/\bitem\b/i.test(joined) && /\bdescritivo\b/i.test(joined) && /avalia/i.test(joined)) {
        const avaliacao = cells.find((cell) => /^avalia/i.test(norm(cell.text)));
        if (avaliacao) {
          avaliacaoX = avaliacao.x;
        }
        continue;
      }

      // Tabela de observações: encerra a leitura de itens desta página.
      if (texts.some((text) => /^observa/i.test(norm(text)))) {
        modoObservacao = true;
        continue;
      }

      // Bloco "Item não avaliado 3.1 - motivo": o próprio PDF explica o N/A.
      let marcouMotivo = false;
      cells.forEach((cell) => {
        const match = /item\s*nao\s*avaliado\s*(\d{1,2}\.\d{1,2})\s*[-–—:]\s*(.*)/i.exec(norm(cell.text));
        if (!match) {
          return;
        }
        const motivo: SniperMotivo = {
          code: match[1],
          text: clip(cell.text.replace(/.*?[-–—:]\s*/, ""), 220),
        };
        motivos.push(motivo);
        colunasMotivo.push({ x: cell.x, motivo });
        marcouMotivo = true;
      });

      if (marcouMotivo) {
        continue;
      }

      if (colunasMotivo.length > 0) {
        const continuacao = cells.filter(
          (cell) =>
            cell.text.length > 2 && !CODE.test(cell.text) && !isBoilerplate(cell.text) && !readSniperResult(cell.text),
        );
        continuacao.forEach((cell) => {
          const proximo = colunasMotivo.reduce((best, current) =>
            Math.abs(current.x - cell.x) < Math.abs(best.x - cell.x) ? current : best,
          );
          if (Math.abs(proximo.x - cell.x) <= 45) {
            proximo.motivo.text = clip(`${proximo.motivo.text} ${cell.text}`, 260);
          }
        });
      }

      if (modoObservacao) {
        const codeCell = cells.find((cell) => CODE.test(cell.text));
        if (codeCell) {
          const resto = cells
            .filter((cell) => cell !== codeCell && !CODE.test(cell.text))
            .map((cell) => cell.text)
            .join(" ");
          if (resto.trim().length > 0) {
            observacoes.push({ code: codeCell.text, text: clip(resto, 220) });
          }
        }
        continue;
      }

      const codeCell = cells.find((cell) => CODE.test(cell.text));
      if (!codeCell) {
        if (joined.length >= 24 && !isBoilerplate(joined) && !readSniperResult(joined)) {
          buffer = joined;
        }
        continue;
      }

      const resultCells =
        avaliacaoX === null
          ? [cells[cells.length - 1]]
          : cells.filter((cell) => cell.x >= avaliacaoX - 14);
      const result =
        resultCells.map((cell) => readSniperResult(cell.text)).find((value) => value.length > 0) ??
        (avaliacaoX === null ? "" : readSniperResult(texts[texts.length - 1]));

      const descriptionCells = (
        avaliacaoX === null
          ? cells.slice(cells.indexOf(codeCell) + 1, cells.length - 1)
          : cells.filter((cell) => cell.x > codeCell.x && cell.x < avaliacaoX - 14)
      ).map((cell) => cell.text);

      const inline = clean(descriptionCells.join(" "));
      const prefixo = inline.length > 0 && inline.length < 45 && buffer ? buffer : "";
      const description = clean(`${prefixo} ${inline}`) || clean(buffer) || "(sem descritivo legível)";
      buffer = "";

      const section = SNIPER_SECTION_LABEL[codeCell.text.split(".")[0]] ?? `Seção ${codeCell.text.split(".")[0]}`;

      if (vistos.has(codeCell.text)) {
        continue;
      }
      vistos.add(codeCell.text);

      items.push({
        code: codeCell.text,
        description: clip(description, 200),
        result,
        section,
        page: page.page,
      });
    }
  }

  return { items, motivos, observacoes, avaliacaoX };
}

function buildSections(items: SniperItem[]): SniperSectionSummary[] {
  const map = new Map<string, SniperSectionSummary>();

  items.forEach((item) => {
    const key = item.code.split(".")[0];
    const entry = map.get(key) ?? { key, label: item.section, total: 0, na: 0 };
    entry.total += 1;
    if (item.result === "N/A") {
      entry.na += 1;
    }
    map.set(key, entry);
  });

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key, "pt-BR"));
}

/** Monta o parecer do Sniper para um documento já lido por colunas. */
export function parseSniperDocument(
  pages: SniperPage[],
  meta: { fileName: string; totalPages?: number; hasText?: boolean },
): SniperDocument {
  const header = readHeader(pages);
  const { items, motivos, observacoes } = readItems(pages);
  const doNome = deriveNumbersFromFileName(meta.fileName);

  const total = items.length;
  const na = items.filter((item) => item.result === "N/A").length;
  const conforme = items.filter((item) => item.result === "Conforme").length;
  const naoConforme = items.filter((item) => item.result === "Não Conforme").length;
  const informativo = items.filter((item) => item.result === "Informativo").length;
  const semResultado = total - na - conforme - naoConforme - informativo;

  const servicoExecutado = header.servicoExecutado ?? "";
  const servicoAcatado = header.servicoAcatado ?? "";

  let motivo = "";
  let motivoOrigem: SniperMotivoOrigem = "ausente";

  if (motivos.length > 0) {
    motivo = motivos.map((item) => `${item.code} — ${item.text}`).join(" • ");
    motivoOrigem = "documento";
  } else if (observacoes.length > 0) {
    motivo = observacoes.map((item) => `${item.code} — ${item.text}`).join(" • ");
    motivoOrigem = "observacao";
  } else if (RAZAO_N_A.test(norm(servicoAcatado))) {
    motivo = servicoAcatado;
    motivoOrigem = "servico_acatado";
  } else if (RAZAO_N_A.test(norm(servicoExecutado))) {
    motivo = servicoExecutado;
    motivoOrigem = "servico_executado";
  }

  // Serviço não executado tem precedência: a ficha pode estar toda N/A porque
  // nada foi executado, e isso não é "não avaliação".
  const textoExecucao = norm(`${servicoExecutado} ${servicoAcatado}`);
  const naoServico = NAO_EXECUTADO.test(textoExecucao);
  const naoPeloMotivo = total > 0 && na === total && NAO_EXECUTADO.test(norm(motivo));
  const naoExecutado = naoServico || naoPeloMotivo;

  if (naoExecutado && naoServico) {
    motivoOrigem = "nao_execucao";
    motivo = `Serviço não executado — ${servicoExecutado || servicoAcatado}`;
  }

  const verdict: SniperVerdict = naoExecutado
    ? "nao_executado"
    : total === 0
      ? "sem_itens"
      : na === total
        ? "tudo_na"
        : na > 0
          ? "na_parcial"
          : "avaliado";

  return {
    fileName: meta.fileName,
    pages: meta.totalPages ?? pages.length,
    hasText: meta.hasText ?? pages.some((page) => page.lines.length > 0),
    fac: header.fac ?? doNome.fac ?? "",
    os: header.os ?? doNome.os ?? "",
    data: header.data ?? "",
    municipio: header.municipio ?? "",
    endereco: header.endereco ?? "",
    polo: header.polo ?? "",
    unidade: header.unidade ?? "",
    categoria: header.categoria ?? "",
    contratada: header.contratada ?? "",
    servicoExecutado,
    servicoAcatado,
    auditor: header.auditor ?? "",
    conceito: header.conceito ?? "",
    items,
    total,
    na,
    conforme,
    naoConforme,
    informativo,
    semResultado,
    sections: buildSections(items),
    motivos,
    observacoes,
    motivo: clip(motivo, 460),
    motivoOrigem,
    naoExecutado,
    verdict,
  };
}

export const SNIPER_ORDER: Record<SniperVerdict, number> = {
  nao_executado: 0,
  tudo_na: 1,
  na_parcial: 2,
  avaliado: 3,
  sem_itens: 4,
};
