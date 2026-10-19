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
  { key: "os", label: "OS Nº" },
  { key: "fac", label: "Nº FAC" },
  { key: "protocoloSgz", label: "Protocolo SGZ" },
  { key: "contratada", label: "Contratada" },
  { key: "servicoExda", label: "Serviço EXDA" },
  { key: "origemDemanda", label: "Origem da Demanda" },
  { key: "prazo", label: "Prazo para Conclusão" },
  { key: "situacao", label: "Situação Atual" },
  { key: "polo", label: "Polo" },
  { key: "endereco", label: "Endereço" },
  { key: "data", label: "Data" },
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
