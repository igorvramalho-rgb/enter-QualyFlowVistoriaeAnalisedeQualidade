import type { QualityStatus } from "@/lib/analysis";

/**
 * Classificação geral do serviço a partir das **etapas avaliadas** do FV
 * (bloco "ITENS AVALIADOS", coluna AVALIAÇÃO).
 *
 * É a única função que decide o resultado pelo conteúdo das etapas. O texto
 * chega normalizado (sem acentos e em minúsculas).
 *
 * Regras (pedido do usuário):
 * 1. Nenhuma etapa avaliada (tudo N/A) → **Não avaliado** — nunca Conforme.
 * 2. Nenhuma etapa preenchida → **Não avaliado**.
 * 3. Pelo menos uma etapa Conforme e nenhuma Não Conforme → **Conforme**.
 * 4. Qualquer etapa Não Conforme → **Não Conforme** (regra de prioridade).
 * 5. Conforme + N/A → **Conforme** (o N/A não conta como avaliação positiva).
 * 6. Etapas apenas informativas → **Informativo**.
 *
 * Devolve `null` quando o documento não tem bloco de etapas: nesse caso o
 * chamador mantém as regras antigas de leitura do FV.
 */

export interface ItemEvaluations {
  conforme: number;
  naoConforme: number;
  naoAvaliado: number;
  informativo: number;
  total: number;
}

const ITEM_BLOCK = /itens\s*avaliados/;
const NAO_CONFORME = /nao\s*conforme(?!idade)/g;
const CONFORME = /\bconforme\b/g;
const NAO_AVALIADO = /\bn\s*[./]\s*a\b/g;
const INFORMATIVO = /\binformativo\b/g;

function count(value: string, pattern: RegExp): number {
  return (value.match(pattern) ?? []).length;
}

/** Trecho do documento que contém as etapas avaliadas (ou null se não houver). */
export function itemEvaluationSection(normalized: string): string | null {
  const start = normalized.search(ITEM_BLOCK);
  return start >= 0 ? normalized.slice(start) : null;
}

/** Conta cada tipo de avaliação dentro do bloco de etapas. */
export function readItemEvaluations(normalized: string): ItemEvaluations | null {
  const section = itemEvaluationSection(normalized);
  if (!section) {
    return null;
  }

  const naoConforme = count(section, NAO_CONFORME);
  // "Não Conforme" não pode ser contado também como "Conforme".
  const semNegativas = section.replace(NAO_CONFORME, " ");
  const conforme = count(semNegativas, CONFORME);
  const naoAvaliado = count(section, NAO_AVALIADO);
  const informativo = count(section, INFORMATIVO);

  return {
    conforme,
    naoConforme,
    naoAvaliado,
    informativo,
    total: conforme + naoConforme + naoAvaliado + informativo,
  };
}

export function classifyFromEvaluations(normalized: string): QualityStatus | null {
  const itens = readItemEvaluations(normalized);
  if (!itens) {
    return null;
  }

  if (itens.naoConforme > 0) {
    return "nao_conforme";
  }
  if (itens.conforme > 0) {
    return "conforme";
  }
  if (itens.naoAvaliado > 0) {
    return "nao_avaliado";
  }
  if (itens.informativo > 0) {
    return "informativo";
  }
  return "nao_avaliado";
}
