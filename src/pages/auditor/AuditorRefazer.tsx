import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  daysSince,
  fetchRedoQueue,
  REDO_STATUS,
  type AuditorRedoRow,
} from "@/lib/auditor";
import { formatDateTimeBR } from "@/lib/fields";

export default function AuditorRefazer() {
  const [rows, setRows] = useState<AuditorRedoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchRedoQueue());
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Falha ao carregar as pendências");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const abertos = rows.filter((row) => row.status !== "encerrado");

  return (
    <AuditorShell>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Refazer</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Serviços confirmados como não conformes que precisam de correção.
            </p>
          </div>
          <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Em aberto</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{abertos.length}</p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Encerrados</p>
            <p className="auditor-num text-lg font-semibold text-foreground">
              {rows.length - abertos.length}
            </p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{rows.length}</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] text-foreground">
            {error}
          </p>
        )}

        {rows.length === 0 && !loading ? (
          <div className="mt-3">
            <AuditorEmpty
              icon={Wrench}
              title="Nenhum serviço para refazer"
              description="Quando uma verificação em campo confirmar a não conformidade, o serviço entra nesta fila com equipe, encarregado e datas."
              nextStage="Fluxo de fiscalização e correção — Etapa 5"
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Equipe</th>
                  <th className="py-2 pr-3 font-medium">Encarregado</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Encaminhado</th>
                  <th className="py-2 pr-3 font-medium">Dias</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dias = daysSince(row.sentAt ?? row.createdAt);
                  return (
                    <tr key={row.id} className="border-b border-border/30 align-top">
                      <td className="py-2 pr-3 text-muted-foreground">{row.itemCode || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.teamType || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.foreman || "—"}</td>
                      <td className="py-2 pr-3 text-foreground">{REDO_STATUS[row.status] ?? row.status}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.sentAt ? formatDateTimeBR(row.sentAt) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {dias === null ? "—" : `${dias}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AuditorShell>
  );
}
