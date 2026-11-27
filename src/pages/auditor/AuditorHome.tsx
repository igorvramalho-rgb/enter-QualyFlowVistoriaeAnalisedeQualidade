import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  FileStack,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuditorCounts } from "@/hooks/use-auditor";
import { AuditorReset } from "@/components/auditor/auditor-reset";
import { cachedCases, fetchCases, type CaseRow } from "@/lib/auditor";
import { useActiveCycle, useCycles } from "@/lib/cycles";
import { useEffect, useMemo, useRef, useState } from "react";
import { ANALYSIS_STATUS, CELLS, CELL_KEYS, cellLabel } from "@/lib/auditor";

const TILES = [
  { key: "documents", label: "FV/OS recebidas", icon: FileStack },
  { key: "awaiting", label: "Aguardando análise", icon: ClipboardList },
  { key: "forwarded", label: "Encaminhadas à fiscalização", icon: ShieldCheck },
  { key: "conforme", label: "Consideradas conformes", icon: ShieldCheck },
  { key: "naoConforme", label: "Consideradas não conformes", icon: TriangleAlert },
  { key: "redoOpen", label: "Serviços a refazer", icon: Wrench },
] as const;

const SEM_ACENTO = /[\u0300-\u036f]/g;

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(SEM_ACENTO, "").toLowerCase();
}

function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

const LIMITE_RESULTADOS = 60;

export default function AuditorHome() {
  const { counts, loading, error, refresh } = useAuditorCounts();
  const cicloAtivo = useActiveCycle();
  const ciclos = useCycles();
  const [casos, setCasos] = useState<CaseRow[]>(() => cachedCases({ limit: 15 }) ?? []);
  const [busca, setBusca] = useState("");
  const [baseBusca, setBaseBusca] = useState<CaseRow[] | null>(null);
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const cicloBaseRef = useRef(cicloAtivo);
  const carregandoBaseRef = useRef(false);

  const cicloNome = ciclos.find((ciclo) => ciclo.id === cicloAtivo)?.name ?? "";

  useEffect(() => {
    void fetchCases({ limit: 15, cycleId: cicloAtivo })
      .then((rows) => setCasos(rows))
      .catch(() => setCasos([]));
  }, [counts, cicloAtivo]);

  // Troca de ciclo: a busca recomeça na base do ciclo novo.
  useEffect(() => {
    cicloBaseRef.current = cicloAtivo;
    carregandoBaseRef.current = false;
    setBaseBusca(null);
    setCarregandoBusca(false);
  }, [cicloAtivo]);

  const carregarBase = async (forcar = false) => {
    if (carregandoBaseRef.current) {
      return;
    }
    if (!forcar && baseBusca !== null) {
      return;
    }
    const token = cicloAtivo;
    carregandoBaseRef.current = true;
    setCarregandoBusca(true);
    try {
      const rows = await fetchCases({ cycleId: token, force: true });
      if (cicloBaseRef.current === token) {
        setBaseBusca(rows);
      }
    } catch {
      if (cicloBaseRef.current === token) {
        setBaseBusca([]);
      }
    } finally {
      carregandoBaseRef.current = false;
      setCarregandoBusca(false);
    }
  };

  const termo = busca.trim();
  const termoNormalizado = normalizar(termo);
  const termoDigitos = somenteDigitos(termo);

  const resultados = useMemo(() => {
    if (!termoNormalizado) {
      return [];
    }
    return (baseBusca ?? []).filter((caso) => {
      const campos = [
        caso.fac,
        caso.os,
        caso.address,
        caso.municipality,
        caso.locality,
        caso.serviceType,
        caso.fileName,
        caso.motive,
        cellLabel(caso.cell),
        ANALYSIS_STATUS[caso.status] ?? "",
        CELLS[caso.cell]?.short ?? "",
      ];
      if (campos.some((campo) => normalizar(campo).includes(termoNormalizado))) {
        return true;
      }
      if (termoDigitos.length >= 2) {
        return (
          somenteDigitos(caso.fac).includes(termoDigitos) ||
          somenteDigitos(caso.os).includes(termoDigitos)
        );
      }
      return false;
    });
  }, [baseBusca, termoNormalizado, termoDigitos]);

  const visiveis = resultados.slice(0, LIMITE_RESULTADOS);

  const valores: Record<(typeof TILES)[number]["key"], number> = {
    documents: counts?.documents ?? 0,
    awaiting: counts?.byStatus.aguardando_analise ?? 0,
    forwarded: counts?.byStatus.encaminhado_fiscalizacao ?? 0,
    conforme: counts?.conforme ?? 0,
    naoConforme: counts?.naoConforme ?? 0,
    redoOpen: counts?.redoOpen ?? 0,
  };

  return (
    <AuditorShell>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Visão geral</h2>
        <div className="flex flex-wrap items-center gap-2">
          <AuditorReset onCleared={() => void refresh()} />
          <Button
            type="button"
            variant="glass"
            size="sm"
            onClick={() => {
              if (busca.trim() || baseBusca !== null) {
                setBaseBusca(null);
                void carregarBase(true);
              }
              void refresh();
            }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
          Não foi possível carregar os indicadores: {error}
        </Card>
      )}

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="auditor-busca"
              type="text"
              value={busca}
              onFocus={() => {
                if (baseBusca === null) {
                  void carregarBase();
                }
              }}
              onChange={(event) => {
                setBusca(event.target.value);
                if (baseBusca === null) {
                  void carregarBase();
                }
              }}
              placeholder="Pesquisar FV, OS, endereço, serviço, célula ou arquivo…"
              aria-label="Pesquisar arquivos em todas as células"
              className="h-10 border-glass-border/60 bg-background/60 pl-9 pr-9 text-xs"
            />
            {busca && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {carregandoBusca && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Busca em todas as células
          {cicloNome ? ` do ciclo ${cicloNome}` : " do ciclo selecionado"} — FV, OS, endereço,
          serviço, situação e nome do arquivo.
        </p>

        {termo.length > 0 && (
          <div className="mt-2">
            {carregandoBusca && baseBusca === null ? (
              <p className="py-3 text-center text-[11px] text-muted-foreground">
                Carregando a base do ciclo…
              </p>
            ) : resultados.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-muted-foreground">
                Nenhum arquivo encontrado para “{termo}” neste ciclo.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{resultados.length} resultado(s)</span>
                  {resultados.length > LIMITE_RESULTADOS && (
                    <span>mostrando os {LIMITE_RESULTADOS} primeiros</span>
                  )}
                </div>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-2 font-medium">FV / OS</th>
                        <th className="py-1.5 pr-2 font-medium">Endereço</th>
                        <th className="py-1.5 pr-2 font-medium">Serviço</th>
                        <th className="py-1.5 pr-2 font-medium">Arquivo</th>
                        <th className="py-1.5 pr-2 font-medium">Célula</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((caso) => (
                        <tr key={caso.id} className="border-b border-border/30 align-top">
                          <td className="whitespace-nowrap py-1.5 pr-2">
                            <Link
                              to={`/auditor/caso/${caso.id}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {caso.fac || caso.fileName || "sem FV/OS"}
                              {caso.fac || caso.os ? ` / ${caso.os || "—"}` : ""}
                            </Link>
                          </td>
                          <td
                            className="max-w-[260px] truncate py-1.5 pr-2 text-muted-foreground"
                            title={caso.address}
                          >
                            {caso.address || "—"}
                          </td>
                          <td
                            className="max-w-[220px] truncate py-1.5 pr-2 text-muted-foreground"
                            title={caso.serviceType}
                          >
                            {caso.serviceType || "—"}
                          </td>
                          <td
                            className="max-w-[220px] truncate py-1.5 pr-2 text-muted-foreground"
                            title={caso.fileName}
                          >
                            {caso.fileName || "—"}
                          </td>
                          <td className="whitespace-nowrap py-1.5 pr-2 text-foreground">
                            {cellLabel(caso.cell)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CELL_KEYS.map((key, index) => (
          <Link
            key={key}
            to={`/auditor/celula/${key}`}
            className="auditor-tile group rounded-xl px-4 py-3 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Célula {String(index + 1).padStart(2, "0")}
              </p>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{CELLS[key].label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground auditor-num">
              {counts?.byCell[key] ?? 0}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
              {CELLS[key].description}
            </p>
          </Link>
        ))}
      </div>

      <Link
        to="/auditor/analises"
        className="auditor-tile group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:border-primary/40"
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Área de trabalho
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">Análises (Analista BI)</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
            Importação de PDFs e planilhas, extração, indicadores e base de vistorias.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["FV/OS únicas", counts?.cases ?? 0],
          ["Documentos importados", counts?.documents ?? 0],
          ["Devoluções", counts?.returns ?? 0],
          ["Movimentações", counts?.events ?? 0],
        ].map(([label, valor]) => (
          <div key={String(label)} className="auditor-tile rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="auditor-num text-xl font-semibold text-foreground">{valor}</p>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Tratativas</h3>
        {casos.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Nenhuma FV/OS recebida. Use “Recebimento” para importar o primeiro PDF.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">FV / OS</th>
                  <th className="py-1.5 pr-2 font-medium">Endereço</th>
                  <th className="py-1.5 pr-2 font-medium">Célula</th>
                </tr>
              </thead>
              <tbody>
                {casos.slice(0, 12).map((caso) => (
                  <tr key={caso.id} className="border-b border-border/30">
                    <td className="py-1.5 pr-2">
                      <Link to={`/auditor/caso/${caso.id}`} className="text-primary underline-offset-2 hover:underline">
                        {caso.fac || caso.fileName || "sem FV/OS"}
                        {caso.fac || caso.os ? ` / ${caso.os || "—"}` : ""}
                      </Link>
                    </td>
                    <td className="max-w-[320px] truncate py-1.5 pr-2 text-muted-foreground">
                      {caso.address || "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-foreground">{cellLabel(caso.cell)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
