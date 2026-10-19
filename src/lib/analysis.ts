/**
 * Tipos, rótulos e limites da análise de vistorias. Este módulo é leve (sem
 * pdfjs) para que o leitor de PDF só seja baixado quando o usuário importar
 * um arquivo.
 */

export const MAX_PAGES = 15;

export type DocumentType = "sgz_156" | "pos_60_passeio" | "pos_60_via" | "indefinido";

export type QualityStatus = "conforme" | "nao_conforme" | "em_andamento" | "pendente";

export type Confidence = "alta" | "media" | "baixa" | "nenhuma";

export type AnalysisSource = "texto" | "nome-do-arquivo" | "manual" | "sem-texto";

export interface AnalysisFieldDefinition {
  key: string;
  label: string;
}

export const ANALYSIS_FIELDS: AnalysisFieldDefinition[] = [
  { key: "os", label: "Ordem de Serviço" },
  { key: "fv", label: "FV" },
  { key: "protocoloSgz", label: "Protocolo SGZ" },
  { key: "contratada", label: "Contratada" },
  { key: "servicoExda", label: "Serviço EXDA" },
  { key: "equipeExecutante", label: "Equipe Executante" },
  { key: "tipoNaoConformidade", label: "Tipo de Não Conformidade" },
  { key: "origemDemanda", label: "Origem da Demanda" },
  { key: "prazo", label: "Prazo para Conclusão" },
  { key: "situacao", label: "Situação Atual" },
  { key: "polo", label: "Polo" },
  { key: "endereco", label: "Endereço" },
  { key: "data", label: "Data de Vistoria" },
];

/**
 * Colunas da planilha (Excel e CSV), na ordem pedida: Endereço, FV, Ordem de
 * Serviço, Data de Vistoria, Equipe Executante e Tipo de Não Conformidade.
 */
export const EXPORT_FIELDS: AnalysisFieldDefinition[] = [
  { key: "endereco", label: "Endereço" },
  { key: "fv", label: "FV" },
  { key: "os", label: "Ordem de Serviço" },
  { key: "data", label: "Data de Vistoria" },
  { key: "equipeExecutante", label: "Equipe Executante" },
  { key: "tipoNaoConformidade", label: "Tipo de Não Conformidade" },
  { key: "polo", label: "Polo" },
  { key: "protocoloSgz", label: "Protocolo SGZ" },
  { key: "contratada", label: "Contratada" },
  { key: "servicoExda", label: "Serviço EXDA" },
  { key: "situacao", label: "Situação Atual" },
  { key: "prazo", label: "Prazo para Conclusão" },
];

export interface AnalysisRecord {
  id: string;
  fingerprint: string;
  fileName: string;
  pages: number;
  analyzedAt: string;
  documentType: DocumentType;
  textAvailable: boolean;
  source: AnalysisSource;
  fields: Record<string, string>;
  confidence: Record<string, Confidence>;
  status: QualityStatus;
  snippet: string;
  /** Marcado quando o vistoriador revisou/ajustou os campos manualmente. */
  reviewed?: boolean;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  sgz_156: "Demanda SGZ - 156",
  pos_60_passeio: "Devolutiva Pós 60 - Passeio",
  pos_60_via: "Devolutiva Pós 60 - Via",
  indefinido: "Indefinido",
};

export const STATUS_LABELS: Record<QualityStatus, string> = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  em_andamento: "Em Andamento",
  pendente: "Pendente de revisão",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  nenhuma: "Não encontrado",
};

export class PdfExtractionError extends Error {}

/** Nome do campo usado nos agrupamentos por tipo de não conformidade. */
export function normalizeNcType(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}
