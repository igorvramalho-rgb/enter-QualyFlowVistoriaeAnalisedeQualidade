import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchCases,
  fetchReportsQueue,
  type AuditorReport,
  type CaseRow,
} from "@/lib/auditor";
import { formatDateTimeBR } from "@/lib/fields";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado à AlphaGeos",
};

export default function AuditorRelatorios() {
  const [reports, setReports] = useState<AuditorReport[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listaRelatorios, listaCasos] = await Promise.all([fetchReportsQueue(), fetchCases()]);
      setReports(listaRelatorios);
      setCases(listaCasos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const porCaso = useMemo(() => new Map(cases.map((row) => [row.id, row])), [cases]);

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

        {reports.length === 0 && !loading ? (
          <div className="mt-3">
            <AuditorEmpty
              icon={FileText}
              title="Nenhum relatório emitido"
              description="Abra a tratativa de uma FV/OS para montar a resposta com as fotos do fiscal."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">FV / OS</th>
                  <th className="py-2 pr-3 font-medium">Modelo</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Enviado</th>
                  <th className="py-2 pr-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => {
                  const caso = porCaso.get(row.caseId);
                  return (
                    <tr key={row.id} className="border-b border-border/30 align-top">
                      <td className="py-2 pr-3">
                        <Link
                          to={`/auditor/relatorio/${row.caseId}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {caso?.fac || "—"} / {caso?.os || "—"}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.templateId || "—"}</td>
                      <td className="py-2 pr-3 text-foreground">
                        {STATUS_LABELS[row.status] ?? row.status}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {row.sentAt ? formatDateTimeBR(row.sentAt) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {formatDateTimeBR(row.updatedAt)}
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
