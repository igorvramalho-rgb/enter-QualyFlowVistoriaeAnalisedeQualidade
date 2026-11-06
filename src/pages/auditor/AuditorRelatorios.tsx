import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchReportsQueue, type AuditorReportRow } from "@/lib/auditor";
import { formatDateTimeBR } from "@/lib/fields";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado à AlphaGeos",
};

export default function AuditorRelatorios() {
  const [rows, setRows] = useState<AuditorReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchReportsQueue());
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Falha ao carregar os relatórios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AuditorShell>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Relatórios de resposta</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Um relatório por FV/OS. Nenhuma FV/OS diferente é agrupada no mesmo documento.
            </p>
          </div>
          <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] text-foreground">
            {error}
          </p>
        )}

        {rows.length === 0 && !loading ? (
          <div className="mt-3">
            <AuditorEmpty
              icon={FileText}
              title="Nenhum relatório emitido"
              description="Cada resposta usa o mesmo padrão fotográfico do módulo de Relatórios, com as fotos do fiscal organizadas por item."
              nextStage="Relatório individual por FV/OS — Etapa 5"
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Modelo</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Justificativa</th>
                  <th className="py-2 pr-3 font-medium">Enviado</th>
                  <th className="py-2 pr-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 align-top">
                    <td className="py-2 pr-3 text-muted-foreground">{row.templateId || "—"}</td>
                    <td className="py-2 pr-3 text-foreground">
                      {STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="max-w-[320px] truncate py-2 pr-3 text-muted-foreground">
                      {row.justification || "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.sentAt ? formatDateTimeBR(row.sentAt) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatDateTimeBR(row.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AuditorShell>
  );
}
