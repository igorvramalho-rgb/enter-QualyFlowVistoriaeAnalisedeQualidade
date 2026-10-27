import { Archive, BarChart3, FileText, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Somente o gestor enxerga este item. */
  gestorOnly?: boolean;
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
  {
    to: "/usuarios",
    label: "Usuários",
    description: "Liberar e cadastrar acessos",
    icon: Users,
    gestorOnly: true,
  },
  {
    to: "/backup",
    label: "Backup",
    description: "Exportar e recuperar dados",
    icon: Archive,
    gestorOnly: true,
  },
];
