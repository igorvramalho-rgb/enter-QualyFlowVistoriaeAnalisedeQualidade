/**
 * Cabeçalho institucional e logos do relatório SGZ-156, extraídos do modelo
 * oficial enviado pelo usuário. Podem ser ajustados em "Cabeçalho institucional"
 * e ficam salvos no armazenamento local deste navegador.
 */
export interface InstitutionalHeader {
  title: string;
  division: string;
  addressLine: string;
  phoneLine1: string;
  phoneLine2: string;
}

export interface LogoSettings {
  sabesp: string;
  consortium: string;
}

export const DEFAULT_INSTITUTIONAL_HEADER: InstitutionalHeader = {
  title: "Companhia de Saneamento Básico do Estado de São Paulo",
  division: "Divisão de Manutenção e Serviços Operacionais Santana - ONMS",
  addressLine: "Rua Antônio Pereira de Sousa, 110 Santana | 02404-060 | São Paulo - SP",
  phoneLine1: "Tel. (11) 2971-8015 | Cel. (11) 93443-9339 - andreamartins@sabesp.com.br",
  phoneLine2: "Cel. (11) 97237-8937 - jfgois@sabesp.com.br",
};

export const DEFAULT_LOGOS: LogoSettings = {
  sabesp: "/assets/report/sabesp.png",
  consortium: "/assets/report/consorcio-nova-norte.png",
};
