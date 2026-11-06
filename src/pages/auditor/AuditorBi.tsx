import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuditorCounts } from "@/hooks/use-auditor";

export default function AuditorBi() {
  const { counts, loading, error, refresh } = useAuditorCounts();

  const linhas = [
    { label: "FV/OS recebidas", valor: counts?.documents ?? 0 },
    { label: "Tratativas abertas", valor: counts?.cases ?? 0 },
    { label: "Consideradas conformes", valor: counts?.conforme ?? 0 },
    { label: "Consideradas não conformes", valor: counts?.naoConforme ?? 0 },
    { label: "Serviços a refazer (em aberto)", valor: counts?.redoOpen ?? 0 },
    { label: "Correções encerradas", valor: counts?.redoDone ?? 0 },
    { label: "Relatórios enviados", valor: counts?.reportsSent ?? 0 },
    { label: "Devoluções da AlphaGeos", valor: counts?.returns ?? 0 },
  ];

  return (
    <AuditorShell>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Painel BI</h2>
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

      <Card className="p-4">
        <p className="text-[11px] text-muted-foreground">
          Contagens reais, sem somar etapas diferentes: documento, item, serviço a refazer,
          relatório e devolução são contados separadamente.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {linhas.map((linha) => (
            <div key={linha.label} className="auditor-tile rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{linha.label}</p>
              <p className="auditor-num text-xl font-semibold text-foreground">{linha.valor}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex items-start gap-2 p-4">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--auditor-steel))]" />
        <div>
          <p className="text-sm font-semibold text-foreground">Gráficos e relatório gerencial</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Evolução semanal e mensal, conformidade, devoluções, pendências por tempo e principais
            motivos entram junto com os filtros por período, município, localidade e tipo de
            serviço — Etapa 7 do módulo. Nenhum número será exibido sem dados que o sustentem.
          </p>
        </div>
      </Card>
    </AuditorShell>
  );
}
