import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  Images,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import { downloadCsv } from "@/lib/csv";
import { formatBytes, formatDateTimeBR } from "@/lib/fields";
import {
  buildInventory,
  CATEGORY_LABELS,
  DEFAULT_GRACE_DAYS,
  fetchReportPhotoSources,
  INVENTORY_CSV_HEADERS,
  inventoryCsvRows,
  listBucketFiles,
  type PhotoCategory,
  type PhotoInventory,
} from "@/lib/photo-inventory";

const GRACE_OPTIONS = [0, 7, 15, 30, 60];
const ROW_LIMIT = 200;

const CATEGORY_TONES: Partial<Record<PhotoCategory, string>> = {
  orfao_candidato: "border-warning/50 bg-warning/10 text-foreground",
  orfao_carencia: "border-border/60 bg-muted/40 text-muted-foreground",
  referencia_sem_arquivo: "border-destructive/50 bg-destructive/10 text-foreground",
  referenciado_atual: "border-success/40 bg-success/10 text-foreground",
  referenciado_original: "border-success/30 bg-success/5 text-foreground",
  referenciado_historico: "border-primary/30 bg-primary/5 text-foreground",
};

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "text-foreground";

  return (
    <div className="rounded-xl border border-glass-border/40 bg-glass/30 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Inventário de fotos — **somente leitura**, exclusivo do gestor. */
export default function InventarioFotos() {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<PhotoInventory | null>(null);
  const [graceDays, setGraceDays] = useState(DEFAULT_GRACE_DAYS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todas" | PhotoCategory>("todas");
  const [search, setSearch] = useState("");

  const isGestor = profile?.role === "gestor" && profile?.status === "ativo";

  const gerar = useCallback(
    async (dias: number) => {
      setLoading(true);
      try {
        const [files, reports] = await Promise.all([listBucketFiles(), fetchReportPhotoSources()]);
        const result = buildInventory({ files, reports, graceDays: dias });
        setInventory(result);
        toast.success("Inventário gerado (somente leitura)", {
          description: `${result.summary.files} arquivos • nenhum arquivo foi alterado`,
        });
      } catch (error) {
        toast.error("Não foi possível gerar o inventário", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (isGestor) {
      void gerar(DEFAULT_GRACE_DAYS);
    }
  }, [isGestor, gerar]);

  const rows = useMemo(() => {
    if (!inventory) {
      return [];
    }
    const term = search.trim().toLowerCase();
    return inventory.rows.filter((row) => {
      const matchesCategory = filter === "todas" || row.category === filter;
      const matchesTerm = term.length === 0 || row.path.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [inventory, filter, search]);

  if (!isGestor) {
    return <Navigate to="/emissor" replace />;
  }

  const baixarCsv = () => {
    if (!inventory) {
      return;
    }
    const stamp = inventory.generatedAt.slice(0, 10);
    downloadCsv(
      `qualyflow-inventario-fotos-${stamp}-carencia-${inventory.graceDays}d.csv`,
      INVENTORY_CSV_HEADERS,
      inventoryCsvRows(inventory),
    );
  };

  const summary = inventory?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Images}
        title="Inventário de fotos"
        description="Conferência somente leitura entre o armazenamento privado e as referências dos relatórios. Nenhum arquivo é apagado, movido ou alterado."
        chips={[
          { icon: ShieldCheck, label: "Somente leitura" },
          ...(summary
            ? [{ icon: HardDrive, label: `${summary.files} arquivos • ${formatBytes(summary.bytes)}` }]
            : []),
        ]}
        actions={
          <>
            <Button
              type="button"
              variant="glass"
              onClick={() => void gerar(graceDays)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regerar
            </Button>
            <Button type="button" variant="glow" onClick={baixarCsv} disabled={!inventory || loading}>
              <Download className="h-4 w-4" />
              Baixar CSV
            </Button>
          </>
        }
      />

      <Card className="border-primary/30 bg-primary/5 p-4">
        <p className="flex items-start gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Esta tela não exclui nada.
        </p>
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          O inventário apenas compara os arquivos do bucket com os caminhos citados em
          <span className="font-mono"> path</span>, <span className="font-mono">originalPath</span> e
          <span className="font-mono"> history</span> de todos os relatórios. A limpeza (E5) continua
          não autorizada e não é executada por aqui.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Carência antes de considerar candidato
            <select
              value={graceDays}
              onChange={(event) => setGraceDays(Number(event.target.value))}
              className="mt-1 block h-9 rounded-md border border-input bg-background/70 px-2 text-sm text-foreground"
            >
              {GRACE_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? "sem carência" : `${days} dias`}
                </option>
              ))}
            </select>
          </label>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Mudar a carência só recalcula a classificação em memória. Regenere após alterar.
          </p>
        </div>
      </Card>

      {summary && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Arquivos no bucket"
              value={String(summary.files)}
              hint={formatBytes(summary.bytes)}
            />
            <StatCard
              label="Referenciados"
              value={String(summary.referencedFiles)}
              hint={`${formatBytes(summary.referencedBytes)} • preservar`}
              tone="success"
            />
            <StatCard
              label="Sem referência · carência"
              value={String(summary.orphanGraceFiles)}
              hint={formatBytes(summary.orphanGraceBytes)}
              tone="warning"
            />
            <StatCard
              label="Candidatos à limpeza"
              value={String(summary.orphanCandidateFiles)}
              hint={`${formatBytes(summary.recoverableBytes)} recuperáveis`}
              tone="warning"
            />
            <StatCard
              label="Referências sem arquivo"
              value={String(summary.missingFiles)}
              hint={summary.missingFiles === 0 ? "nenhuma divergência" : "requer conferência"}
              tone={summary.missingFiles === 0 ? "success" : "danger"}
            />
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {summary.missingFiles === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                Conferência de referências
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Gerado em {formatDateTimeBR(inventory.generatedAt)} • carência de{" "}
                {inventory.graceDays} dia(s)
              </p>
            </div>

            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                • {summary.referencedFiles} caminho(s) citados por relatórios foram encontrados no
                armazenamento e estão classificados como <strong className="text-foreground">preservar</strong>.
              </li>
              <li>
                • {summary.sharedFiles} arquivo(s) são compartilhados por mais de um relatório
                (duplicação ou reaproveitamento) e por isso nunca entram como candidatos.
              </li>
              <li>
                • {summary.missingFiles} referência(s) sem arquivo correspondente no bucket.
              </li>
              <li>
                • Arquivos mais antigos:{" "}
                {summary.oldestFileAt ? formatDateTimeBR(summary.oldestFileAt) : "—"} • mais recentes:{" "}
                {summary.newestFileAt ? formatDateTimeBR(summary.newestFileAt) : "—"}
              </li>
            </ul>

            {inventory.graceDays > 0 && summary.orphanGraceFiles > 0 && (
              <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
                {summary.orphanGraceFiles} arquivo(s) estão sem referência, mas dentro da carência de{" "}
                {inventory.graceDays} dias. Com a carência atual, <strong>nenhum deles</strong> seria
                apagado — são apenas monitorados.
              </p>
            )}
          </Card>
        </>
      )}

      {inventory && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Arquivos ({rows.length}
              {rows.length !== inventory.rows.length ? ` de ${inventory.rows.length}` : ""})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as "todas" | PhotoCategory)}
                className="h-9 rounded-md border border-input bg-background/70 px-2 text-sm text-foreground"
              >
                <option value="todas">Todas as categorias</option>
                {(Object.keys(CATEGORY_LABELS) as PhotoCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrar por caminho"
                className="h-9 w-56 rounded-md border border-input bg-background/70 px-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Caminho</th>
                  <th className="py-2 pr-3 font-medium">Categoria</th>
                  <th className="py-2 pr-3 font-medium">Ação</th>
                  <th className="py-2 pr-3 font-medium">Tamanho</th>
                  <th className="py-2 pr-3 font-medium">Idade</th>
                  <th className="py-2 pr-3 font-medium">Relatórios</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, ROW_LIMIT).map((row) => (
                  <tr key={row.path} className="border-b border-border/30 align-top">
                    <td className="max-w-[260px] truncate py-2 pr-3 font-mono text-[11px] text-foreground">
                      {row.path.replace("qualyflow/fotos/", "")}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          CATEGORY_TONES[row.category] ?? "border-border/60"
                        }`}
                      >
                        {CATEGORY_LABELS[row.category]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.action}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.category === "referencia_sem_arquivo" ? "—" : formatBytes(row.bytes)}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.category === "referencia_sem_arquivo" ? "—" : `${row.ageDays}d`}
                    </td>
                    <td className="max-w-[220px] py-2 pr-3 text-muted-foreground">
                      {row.references.length === 0 ? (
                        <span className="text-muted-foreground/70">—</span>
                      ) : (
                        <span className="line-clamp-2">
                          {Array.from(new Set(row.references.map((ref) => ref.reportName))).join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > ROW_LIMIT && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Exibindo os primeiros {ROW_LIMIT} de {rows.length}. O CSV traz a lista completa.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">CSV completo</Badge>
            <span className="text-[11px] text-muted-foreground">
              O arquivo inclui caminho, categoria, ação sugerida, tamanho, idade e os relatórios que
              citam cada foto.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
