import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileWarning,
  Hammer,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { normalizeNcType, type AnalysisRecord } from "@/lib/analysis";
import { percent } from "@/lib/fields";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  analyses: AnalysisRecord[];
}

interface Kpi {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "destructive" | "neutral";
}

const TONES: Record<Kpi["tone"], string> = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export function KpiCards({ analyses }: KpiCardsProps) {
  const total = analyses.length;
  const conformes = analyses.filter((item) => item.status === "conforme").length;
  const naoConformes = analyses.filter((item) => item.status === "nao_conforme").length;
  const emAndamento = analyses.filter((item) => item.status === "em_andamento").length;
  const pendentes = analyses.filter((item) => item.status === "pendente").length;
  const polos = new Set(
    analyses.map((item) => item.fields.polo?.trim()).filter((polo): polo is string => Boolean(polo)),
  ).size;
  const tiposNc = new Set(
    analyses.map((item) => normalizeNcType(item.fields.tipoNaoConformidade)).filter(Boolean),
  ).size;
  const mediaPaginas =
    total > 0 ? (analyses.reduce((sum, item) => sum + item.pages, 0) / total).toFixed(1) : "0";
  const kpis: Kpi[] = [
    {
      label: "Vistorias analisadas",
      value: String(total),
      hint: "PDFs importados no período",
      icon: FileCheck2,
      tone: "primary",
    },
    {
      label: "Concluídas",
      value: `${percent(conformes, total)}%`,
      hint: `${conformes} de ${total} relatórios`,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Não conformidades",
      value: String(naoConformes),
      hint: "Relatórios com pendência crítica",
      icon: AlertTriangle,
      tone: "destructive",
    },
    {
      label: "Tipos de não conformidade",
      value: String(tiposNc),
      hint: "Classificações distintas registradas",
      icon: FileWarning,
      tone: "warning",
    },
    {
      label: "Em andamento",
      value: String(emAndamento),
      hint: "Obra em execução ou asfalto provisório",
      icon: Hammer,
      tone: "warning",
    },
    {
      label: "Pendentes de revisão",
      value: String(pendentes),
      hint: "Sem dados suficientes no PDF",
      icon: Clock,
      tone: "neutral",
    },
    {
      label: "Polos ativos",
      value: String(polos),
      hint: `Média de ${mediaPaginas} página(s) por arquivo`,
      icon: MapPin,
      tone: "primary",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className="panel-interactive animate-slide-up relative overflow-hidden p-4"
        >
          <span className="tech-strip absolute inset-x-0 top-0" />
          <div className="flex items-center gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TONES[kpi.tone])}>
              <kpi.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className="text-xl font-semibold leading-tight text-foreground">{kpi.value}</p>
              <p className="truncate text-xs text-muted-foreground" title={kpi.hint}>
                {kpi.hint}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
