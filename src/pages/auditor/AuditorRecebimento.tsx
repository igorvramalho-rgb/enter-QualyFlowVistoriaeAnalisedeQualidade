import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileStack, Info, Loader2, RefreshCw } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorImport } from "@/components/auditor/auditor-import";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchDocuments, type AuditorDocument } from "@/lib/auditor";
import { signedPdfUrl } from "@/lib/auditor-save";
import { formatDateTimeBR } from "@/lib/fields";

export default function AuditorRecebimento() {
  const [rows, setRows] = useState<AuditorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchDocuments());
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Falha ao carregar os documentos");
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
            <h2 className="text-sm font-semibold text-foreground">Recebimento de FV/OS</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Documentos da AlphaGeos importados manualmente para o Qualy Auditor.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditorImport onSaved={() => void load()} />
            <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--auditor-steel))]" />
          <p>
            Cada PDF entra apenas neste módulo. Não há distribuição automática de documentos entre
            Analista, Emissor ou qualquer outro campo.
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] text-foreground">
            {error}
          </p>
        )}

        {rows.length === 0 && !loading ? (
          <div className="mt-3">
            <AuditorEmpty
              icon={FileStack}
              title="Nenhum documento recebido"
              description="Use “Importar PDF” para ler um formulário de verificação da AlphaGeos. O documento original fica guardado em área privada."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Arquivo</th>
                  <th className="py-2 pr-3 font-medium">FV</th>
                  <th className="py-2 pr-3 font-medium">OS</th>
                  <th className="py-2 pr-3 font-medium">Endereço</th>
                  <th className="py-2 pr-3 font-medium">Págs.</th>
                  <th className="py-2 pr-3 font-medium">Origem</th>
                  <th className="py-2 pr-3 font-medium">Recebido</th>
                  <th className="py-2 pr-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 align-top">
                    <td className="max-w-[220px] truncate py-2 pr-3 font-mono text-[11px] text-foreground">
                      {row.fileName}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.fac || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.os || "—"}</td>
                    <td className="max-w-[240px] truncate py-2 pr-3 text-muted-foreground">
                      {row.address || "—"}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.pages}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.textAvailable ? row.source : `${row.source} · revisar`}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatDateTimeBR(row.importedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      {row.pdfPath ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                          onClick={() => {
                            void signedPdfUrl(row.pdfPath).then((link) => {
                              if (link) {
                                window.open(link, "_blank", "noopener");
                              }
                            });
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          abrir
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
