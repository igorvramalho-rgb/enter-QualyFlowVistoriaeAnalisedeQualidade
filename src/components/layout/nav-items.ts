import { Archive, FileText, Images, ShieldCheck, Users, type LucideIcon } from "lucide-react";

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
    to: "/auditor",
    label: "Qualy Auditor",
    description: "Inteligência de fiscalização",
    icon: ShieldCheck,
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
  {
    to: "/inventario",
    label: "Inventário de fotos",
    description: "Conferir arquivos e órfãos",
    icon: Images,
    gestorOnly: true,
  },
];
