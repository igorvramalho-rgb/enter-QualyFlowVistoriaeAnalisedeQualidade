import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { AuditorEmpty } from "@/components/auditor/auditor-empty";
import { AuditorImport } from "@/components/auditor/auditor-import";
import { AuditorReset } from "@/components/auditor/auditor-reset";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import {
  ANALYSIS_ORDER,
  ANALYSIS_STATUS,
  updateCasesBulk,
  updateCasesCellBulk,
  CELLS,
  CELL_KEYS,
  cellLabel,
  cachedCases,
  type AnalysisStatus,
  invalidateAuditorCache,
  fetchCases,
  type CaseRow,
  type CellKey,
} from "@/lib/auditor";
import { downloadCsv } from "@/lib/csv";
import { formatDateBR } from "@/lib/fields";

export default function AuditorCelula() {
  const { cell = "fiscalizacao" } = useParams();
  const cellKey = (CELL_KEYS.includes(cell as CellKey) ? cell : "fiscalizacao") as CellKey;
  const meta = CELLS[cellKey];

  const [rows, setRows] = useState<CaseRow[]>(() => cachedCases() ?? []);
  const [loading, setLoading] = useState(() => cachedCases() === null);
  const [search, setSearch] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [servico, setServico] = useState("");
  const [situacao, setSituacao] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState("50");
  const [page, setPage] = useState(1);
  const [loteStatus, setLoteStatus] = useState("");
  const [loteCell, setLoteCell] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const load = useCallback(async () => {
    setLoading(cachedCases() === null);
    try {
      setRows(await fetchCases(true));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const daCelula = useMemo(() => rows.filter((row) => row.cell === cellKey), [rows, cellKey]);

  const termos = useMemo(
    () => search.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean),
    [search],
  );

  const filtrados = useMemo(() => {
    const de = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const ate = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return daCelula.filter((row) => {
      const atualizado = new Date(row.updatedAt).getTime();
      if (de && atualizado < de) return false;
      if (ate && atualizado > ate) return false;
      if (municipio && row.municipality !== municipio) return false;
      if (servico && row.serviceType !== servico) return false;
      if (situacao && row.status !== situacao) return false;
      if (termos.length === 0) return true;
      const alvo = [row.fac, row.os, row.address, row.fileName].join(" ").toLowerCase();
      // Vários termos = várias FVs/OS de uma vez (basta um corresponder).
      return termos.some((termo) => alvo.includes(termo));
    });
  }, [daCelula, termos, municipio, servico, situacao, from, to]);

  const municipios = Array.from(new Set(daCelula.map((row) => row.municipality).filter(Boolean)));
  const servicos = Array.from(new Set(daCelula.map((row) => row.serviceType).filter(Boolean)));
  const casos = useMemo(() => new Set(filtrados.map((row) => `${row.fac}|${row.os}`)).size, [filtrados]);

  const porPagina = Number(pageSize) || 50;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(page, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  useEffect(() => {
    setPage(1);
  }, [search, municipio, servico, situacao, from, to, pageSize]);

  const naoEncontrados = useMemo(() => {
    if (termos.length < 2) return [] as string[];
    const base = daCelula.map((row) =>
      [row.fac, row.os, row.address, row.fileName].join(" ").toLowerCase(),
    );
    return termos.filter((termo) => !base.some((alvo) => alvo.includes(termo)));
  }, [termos, daCelula]);

  const todosSelecionados = filtrados.length > 0 && filtrados.every((row) => selected.has(row.id));

  const alternar = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const alternarTodos = () => {
    setSelected((previous) => {
      if (todosSelecionados) {
        const next = new Set(previous);
        filtrados.forEach((row) => next.delete(row.id));
        return next;
      }
      return new Set([...previous, ...filtrados.map((row) => row.id)]);
    });
  };

  const aplicarLote = async () => {
    if (!loteStatus || selected.size === 0) return;
    setAplicando(true);
    try {
      const total = await updateCasesBulk([...selected], loteStatus as AnalysisStatus);
      toast.success("Situação atualizada em lote", {
        description: `${total} FV/OS · ${ANALYSIS_STATUS[loteStatus as AnalysisStatus]}`,
      });
      setSelected(new Set());
      setLoteStatus("");
      await load();
    } catch (problem) {
      toast.error("Falha ao atualizar em lote", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setAplicando(false);
    }
  };

  const moverLote = async () => {
    if (!loteCell || selected.size === 0) return;
    setAplicando(true);
    try {
      const total = await updateCasesCellBulk([...selected], loteCell as never);
      toast.success("Movidas de célula", {
        description: `${total} FV/OS · ${CELLS[loteCell as keyof typeof CELLS].label}`,
      });
      setSelected(new Set());
      setLoteCell("");
      await load();
    } catch (problem) {
      toast.error("Falha ao mover", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setAplicando(false);
    }
  };

  const exportar = () => {
    downloadCsv(
      `qualy-auditor-${cellKey}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["FV", "OS", "Endereço", "Município", "Localidade", "Serviço", "Situação", "Resultado", "Atualizado"],
      filtrados.map((row) => [
        row.fac,
        row.os,
        row.address,
        row.municipality,
        row.locality,
        row.serviceType,
        ANALYSIS_STATUS[row.status],
        row.outcome,
        row.updatedAt,
      ]),
    );
  };

  return (
    <AuditorShell>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Célula {CELL_KEYS.indexOf(cellKey) + 1} de {CELL_KEYS.length}
            </p>
            <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
            <p className="mt-0.5 max-w-xl text-[11px] text-muted-foreground">{meta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditorImport
              cell={cellKey}
              onSaved={() => {
                invalidateAuditorCache();
                void load();
              }}
            />
            <AuditorReset
              cell={cellKey}
              onCleared={() => {
                invalidateAuditorCache();
                void load();
              }}
            />
            <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">FV/OS na célula</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{daCelula.length}</p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Filtradas</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{filtrados.length}</p>
          </div>
          <div className="auditor-tile rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">FV/OS distintas</p>
            <p className="auditor-num text-lg font-semibold text-foreground">{casos}</p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground lg:col-span-2">
            Buscar
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cole várias FVs/OS separadas por vírgula"
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            De
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-0.5 h-8 text-xs" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Até
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-0.5 h-8 text-xs" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Município
            <select
              value={municipio}
              onChange={(event) => setMunicipio(event.target.value)}
              className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">todos</option>
              {municipios.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Situação
            <select
              value={situacao}
              onChange={(event) => setSituacao(event.target.value)}
              className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">todas</option>
              {ANALYSIS_ORDER.map((status) => (
                <option key={status} value={status}>{ANALYSIS_STATUS[status]}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Serviço
            <select
              value={servico}
              onChange={(event) => setServico(event.target.value)}
              className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">todos</option>
              {servicos.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            {termos.length > 1
              ? `${termos.length} termo(s) pesquisado(s) · ${filtrados.length} FV/OS encontrada(s)` +
                (naoEncontrados.length > 0 ? ` · não encontradas: ${naoEncontrados.join(", ")}` : "")
              : `${filtrados.length} FV/OS listada(s)`}
          </p>
          <Button type="button" variant="glass" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-medium text-foreground">
            {selected.size} FV/OS selecionada(s)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={loteStatus}
              onChange={(event) => setLoteStatus(event.target.value)}
              className="h-8 rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">Mudar situação para...</option>
              {ANALYSIS_ORDER.map((status) => (
                <option key={status} value={status}>{ANALYSIS_STATUS[status]}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="glow"
              size="sm"
              disabled={!loteStatus || aplicando}
              onClick={() => void aplicarLote()}
            >
              {aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Aplicar
            </Button>
            <select
              value={loteCell}
              onChange={(event) => setLoteCell(event.target.value)}
              className="h-8 rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              <option value="">Mover para célula...</option>
              {CELL_KEYS.filter((key) => key !== cellKey).map((key) => (
                <option key={key} value={key}>{CELLS[key].label}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="glass"
              size="sm"
              disabled={!loteCell || aplicando}
              onClick={() => void moverLote()}
            >
              Mover
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        {filtrados.length === 0 && !loading ? (
          <AuditorEmpty
            icon={Download}
            title="Nenhuma FV/OS nesta célula"
            description={`Use “Importar PDF” para registrar um documento em ${meta.label}. A destinação é sempre definida por você.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-8 py-2 pr-2 font-medium">
                    <Checkbox checked={todosSelecionados} onCheckedChange={alternarTodos} />
                  </th>
                  <th className="py-2 pr-3 font-medium">FV / OS</th>
                  <th className="py-2 pr-3 font-medium">Endereço</th>
                  <th className="py-2 pr-3 font-medium">Município</th>
                  <th className="py-2 pr-3 font-medium">Serviço</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 align-top">
                    <td className="py-2 pr-2">
                      <Checkbox checked={selected.has(row.id)} onCheckedChange={() => alternar(row.id)} />
                    </td>
                    <td className="py-2 pr-3">
                      <Link to={`/auditor/caso/${row.id}`} className="text-primary underline-offset-2 hover:underline">
                        {row.fac || row.fileName || "sem FV/OS"}
                        {row.fac || row.os ? ` / ${row.os || "—"}` : ""}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{cellLabel(row.cell)}</p>
                    </td>
                    <td className="max-w-[260px] truncate py-2 pr-3 text-muted-foreground">{row.address || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.municipality || "—"}</td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-muted-foreground">{row.serviceType || "—"}</td>
                    <td className="py-2 pr-3 text-foreground">{ANALYSIS_STATUS[row.status]}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {row.updatedAt ? formatDateBR(row.updatedAt.slice(0, 10)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtrados.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {filtrados.length} registro(s) · página {paginaAtual} de {totalPaginas}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                className="h-7 rounded-md border border-input bg-background/70 px-1 text-[11px]"
              >
                {["50", "100", "200"].map((valor) => (
                  <option key={valor} value={valor}>{valor} por página</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={paginaAtual <= 1}
                onClick={() => setPage((valor) => Math.max(1, valor - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPage((valor) => Math.min(totalPaginas, valor + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AuditorShell>
  );
}
