import { BarChart3, FileText, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/emissor",
    label: "Emissor de Relatórios",
    description: "Relatórios fotográficos",
    icon: FileText,
  },
  {
    to: "/analista",
    label: "Analista BI",
    description: "Análise de PDFs e indicadores",
    icon: BarChart3,
  },
];
