import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  FileStack,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuditorCounts } from "@/hooks/use-auditor";
import { ANALYSIS_STATUS, type AnalysisStatus } from "@/lib/auditor";

const TILES = [
  { key: "documents", label: "FV/OS recebidas", icon: FileStack },
  { key: "awaiting", label: "Aguardando análise", icon: ClipboardList },
  { key: "forwarded", label: "Encaminhadas à fiscalização", icon: ShieldCheck },
  { key: "conforme", label: "Consideradas conformes", icon: ShieldCheck },
  { key: "naoConforme", label: "Consideradas não conformes", icon: TriangleAlert },
  { key: "redoOpen", label: "Serviços a refazer", icon: Wrench },
] as const;

export default function AuditorHome() {
  const { counts, loading, error, refresh } = useAuditorCounts();

  const valores: Record<(typeof TILES)[number]["key"], number> = {
    documents: counts?.documents ?? 0,
    awaiting: counts?.byStatus.aguardando_analise ?? 0,
    forwarded: counts?.byStatus.encaminhado_fiscalizacao ?? 0,
    conforme: counts?.conforme ?? 0,
    naoConforme: counts?.naoConforme ?? 0,
    redoOpen: counts?.redoOpen ?? 0,
  };

  const fila = (Object.keys(ANALYSIS_STATUS) as AnalysisStatus[]).map((status) => ({
    status,
    label: ANALYSIS_STATUS[status],
    total: counts?.byStatus[status] ?? 0,
  }));

  return (
    <AuditorShell>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Visão geral</h2>
        <Button type="button" variant="glass" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
          Não foi possível carregar os indicadores: {error}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <div key={tile.key} className="auditor-tile rounded-xl px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </p>
              <tile.icon className="h-3.5 w-3.5 text-[hsl(var(--auditor-steel))]" />
            </div>
            <p className="auditor-num mt-1 text-2xl font-semibold text-foreground">{valores[tile.key]}</p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Fila de trabalho</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          A situação da análise é independente da classificação original da AlphaGeos.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fila.map((item) => (
            <div
              key={item.status}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <span className="text-xs text-foreground">{item.label}</span>
              <span className="auditor-num text-sm font-semibold text-foreground">{item.total}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Por onde começar</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A importação manual dos PDFs de FV é o primeiro passo da rotina. Cada documento entra
          apenas aqui, sem distribuição automática para outros módulos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="glow" size="sm" asChild>
            <Link to="/auditor/recebimento">
              Abrir recebimento
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button type="button" variant="glass" size="sm" asChild>
            <Link to="/auditor/bi">Ver painel BI</Link>
          </Button>
        </div>
        {counts?.documents === 0 && (
          <p className="mt-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Ainda não há FV/OS recebida. A leitura assistida dos documentos entra na próxima etapa
            do módulo.
          </p>
        )}
      </Card>
    </AuditorShell>
  );
}
