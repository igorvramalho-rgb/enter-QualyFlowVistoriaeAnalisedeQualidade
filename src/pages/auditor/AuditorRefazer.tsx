import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  daysSince,
  fetchCases,
  fetchRedoQueue,
  REDO_OPEN,
  REDO_STATUS,
  type AuditorRedo,
  type CaseRow,
} from "@/lib/auditor";

export default function AuditorRefazer() {
  const [redo, setRedo] = useState<AuditorRedo[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filtro, setFiltro] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listaRedo, listaCasos] = await Promise.all([fetchRedoQueue(), fetchCases()]);
      setRedo(listaRedo);
      setCases(listaCasos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const porCaso = useMemo(() => new Map(cases.map((row) => [row.id, row])), [cases]);
  const abertos = redo.filter((row) => REDO_OPEN.includes(row.status));
  const lista = filtro ? redo.filter((row) => row.status === filtro) : redo;

  return (
    <AuditorShell>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Refazer</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Serviços confirmados como não conformes que precisam de correção. Os dias são contados
              a partir da data de encaminhamento registrada.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtro}
              onChange={(event) => setFiltro(event.target.value)}
              className="h-9 rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">todas as situações</option>
              {Object.entries(REDO_STATUS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Em aberto</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{abertos.length}</p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Corrigidos</p>
            <p className="auditor-num text-lg font-semibold text-foreground">
              {redo.filter((row) => row.status === "corrigido_fotos").length}
            </p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Encerrados</p>
            <p className="auditor-num text-lg font-semibold text-foreground">
              {redo.filter((row) => row.status === "encerrado").length}
            </p>
          </div>
        </div>

        {lista.length === 0 && !loading ? (
          <div className="mt-3">
            <AuditorEmpty
              icon={Wrench}
              title="Nenhum serviço para refazer"
              description="Quando a análise confirmar a não conformidade, preencha o controle de refazer na tratativa da FV/OS."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">FV / OS</th>
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 pr-3 font-medium">Equipe</th>
                  <th className="py-2 pr-3 font-medium">Encarregado</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Dias</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((row) => {
                  const caso = porCaso.get(row.caseId);
                  const dias = daysSince(row.sentAt);
                  return (
                    <tr key={row.id} className="border-b border-border/30 align-top">
                      <td className="py-2 pr-3">
                        <Link to={`/auditor/caso/${row.caseId}`} className="text-primary underline-offset-2 hover:underline">
                          {caso?.fac || "—"} / {caso?.os || "—"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.itemCode || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.teamType || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.foreman || "—"}</td>
                      <td className="py-2 pr-3 text-foreground">{REDO_STATUS[row.status]}</td>
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
