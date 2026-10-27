export type ReportTemplateId = "sgz_156" | "pos_60_passeio" | "pos_60_via";

export type ReportFieldType = "text" | "date" | "textarea" | "select";

export interface ReportField {
  id: string;
  label: string;
  type?: ReportFieldType;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  /** Campo largo: a legenda ocupa a coluna e o valor a linha inteira */
  wide?: boolean;
  /** Campo exibido fora da tabela principal (ex.: "Contratada" no Pós 60) */
  outsideTable?: boolean;
}

export interface ReportPhotoSlot {
  id: string;
  /** Legenda exata exigida no modelo impresso */
  caption: string;
  hint?: string;
  includeByDefault: boolean;
}

export interface ReportTemplate {
  id: ReportTemplateId;
  title: string;
  shortTitle: string;
  description: string;
  layout: "sgz" | "pos60";
  documentTitle: string;
  /** Título do relatório na pré-visualização/página do analista */
  objeto?: string;
  fields: ReportField[];
  photoSlots: ReportPhotoSlot[];
  consortiumLogo: boolean;
}

/** Opções fixas de "Situação Atual" do modelo SGZ-156 */
export const SGZ_SITUACOES = [
  "Em Obra",
  "Asfalto provisório",
  "Asfalto definitivo",
  "Falta Repor Sinalização",
] as const;

export const SGZ_OBJETO =
  "O presente relatório fotográfico destina-se a comprovar a vistoria realizada em atendimento à demanda SGZ - 156, registrando as condições do local e a situação atual do serviço.";

export const POS60_OBJETO =
  "O presente relatório fotográfico de devolutiva destina-se a comprovar documentalmente a regularização das não conformidades apontadas nos relatórios de fiscalização anteriores referentes aos serviços de reposição de pavimento. A evidência visual detalhada atesta que as etapas de reparo executadas atendem às especificações técnicas.";

const POS60_FIELDS: ReportField[] = [
  { id: "contratada", label: "Contratada", placeholder: "Ex.: NOVA NORTE", outsideTable: true },
  { id: "os", label: "OS Nº:", placeholder: "Ex.: 2639236311" },
  { id: "fac", label: "Nº FAC:", placeholder: "Ex.: 69730" },
  { id: "servicoExda", label: "SERVIÇO EXDA:", placeholder: "Ex.: VIA – REPOSIÇÃO ASFÁLTICA" },
  { id: "polo", label: "POLO:", placeholder: "Ex.: Santana" },
  { id: "endereco", label: "ENDEREÇO:", placeholder: "Ex.: RUA SERVILHA, 108" },
  { id: "data", label: "DATA:", type: "date" },
];

const POS60_SLOTS: ReportPhotoSlot[] = [
  { id: "perpendicular", caption: "REPOSIÇÃO PERPENDICULAR A FACHADA DO IMÓVEL", includeByDefault: true },
  { id: "pavimento", caption: "QUALIDADE DO PAVIMENTO EXISTENTE", includeByDefault: true },
  { id: "panorama", caption: "PANORAMA DA REPOSIÇÃO", includeByDefault: true },
  { id: "regua", caption: "REPOSIÇÃO COM A RÉGUA POSICIONADA", includeByDefault: true },
  { id: "trena", caption: "TRENA INDICANDO DESNÍVEL", includeByDefault: true },
  { id: "junta", caption: "JUNTA", includeByDefault: true },
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "sgz_156",
    title: "Demanda SGZ - 156",
    shortTitle: "SGZ-156",
    description:
      "Relatório de vistoria fotográfica com cabeçalho institucional e uma foto por página (4 páginas).",
    layout: "sgz",
    documentTitle: "Relatório de Vistoria Fotográfica",
    objeto: SGZ_OBJETO,
    consortiumLogo: false,
    fields: [
      {
        id: "endereco",
        label: "Endereço",
        placeholder: "Ex.: R. SEMYON KIRLIAN 85",
        wide: true,
      },
      { id: "dataVistoria", label: "Data da Vistoria", type: "date" },
      { id: "protocoloSgz", label: "Protocolo SGZ", placeholder: "Ex.: 11970611" },
      { id: "os", label: "Nº O.S.", placeholder: "Ex.: 2641328919" },
      { id: "origemDemanda", label: "Origem da Demanda", defaultValue: "DEMANDA SGZ - 156" },
      { id: "prazo", label: "Prazo para Conclusão", defaultValue: "FINALIZADA" },
      { id: "situacao", label: "Situação Atual", type: "select", options: [...SGZ_SITUACOES], defaultValue: "Em Obra" },
    ],
    photoSlots: [
      { id: "notificacao", caption: "NOTIFICAÇÃO (ANTES)", hint: "Foto da notificação no local", includeByDefault: true },
      { id: "fachada", caption: "FACHADA", hint: "Fachada do imóvel", includeByDefault: true },
      {
        id: "visaoGeral",
        caption: "VISÃO GERAL/POSIÇÃO RÉGUA",
        hint: "Visão geral do trecho com a régua posicionada",
        includeByDefault: true,
      },
      { id: "reguaTrena", caption: "RÉGUA/TRENA", hint: "Régua e trena medindo o desnível", includeByDefault: true },
    ],
  },
  {
    id: "pos_60_passeio",
    title: "Devolutiva Pós 60 - Passeio",
    shortTitle: "Pós 60 Passeio",
    description: "Devolutiva de reposição de passeio com 6 fotos em uma única página A4.",
    layout: "pos60",
    documentTitle: "RELATÓRIO FOTOGRÁFICO - DEVOLUTIVA PÓS 60",
    objeto: POS60_OBJETO,
    consortiumLogo: true,
    fields: POS60_FIELDS.map((field) =>
      field.id === "servicoExda" ? { ...field, defaultValue: "PASSEIO – REPOSIÇÃO DE CIMENTADO" } : field,
    ),
    photoSlots: POS60_SLOTS,
  },
  {
    id: "pos_60_via",
    title: "Devolutiva Pós 60 - Via",
    shortTitle: "Pós 60 Via",
    description: "Devolutiva de reposição asfáltica de via com 6 fotos em uma única página A4.",
    layout: "pos60",
    documentTitle: "RELATÓRIO FOTOGRÁFICO - DEVOLUTIVA PÓS 60",
    objeto: POS60_OBJETO,
    consortiumLogo: true,
    fields: POS60_FIELDS.map((field) =>
      field.id === "servicoExda" ? { ...field, defaultValue: "VIA – REPOSIÇÃO ASFÁLTICA" } : field,
    ),
    photoSlots: POS60_SLOTS,
  },
];

export function getTemplate(templateId: string): ReportTemplate {
  return REPORT_TEMPLATES.find((template) => template.id === templateId) ?? REPORT_TEMPLATES[0];
}

export function getDefaultValues(template: ReportTemplate): Record<string, string> {
  return template.fields.reduce<Record<string, string>>((values, field) => {
    values[field.id] = field.defaultValue ?? "";
    return values;
  }, {});
}

/**
 * Ao trocar de modelo preserva os valores dos campos que compartilham o mesmo
 * label (OS, FAC, Polo, Endereço, Data...), evitando redigitação.
 */
export function mergeValuesForTemplate(
  template: ReportTemplate,
  previousTemplate: ReportTemplate | null,
  previousValues: Record<string, string>,
): Record<string, string> {
  const values = getDefaultValues(template);
  if (!previousTemplate) {
    return values;
  }

  template.fields.forEach((field) => {
    const match = previousTemplate.fields.find((candidate) => candidate.label === field.label);
    if (!match) {
      return;
    }
    const previous = previousValues[match.id];
    if (previous && previous.trim().length > 0) {
      values[field.id] = previous;
    }
  });

  return values;
}
