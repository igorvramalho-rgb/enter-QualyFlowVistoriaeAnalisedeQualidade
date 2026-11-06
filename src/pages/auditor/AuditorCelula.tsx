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
import {
  ANALYSIS_ORDER,
  ANALYSIS_STATUS,
  CELLS,
  CELL_KEYS,
  cellLabel,
  cachedCases,
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

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const de = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const ate = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return daCelula.filter((row) => {
      const atualizado = new Date(row.updatedAt).getTime();
      if (de && atualizado < de) return false;
      if (ate && atualizado > ate) return false;
      if (municipio && row.municipality !== municipio) return false;
      if (servico && row.serviceType !== servico) return false;
      if (situacao && row.status !== situacao) return false;
      if (!term) return true;
      return [row.fac, row.os, row.address, row.municipality, row.locality]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [daCelula, search, municipio, servico, situacao, from, to]);

  const municipios = Array.from(new Set(daCelula.map((row) => row.municipality).filter(Boolean)));
  const servicos = Array.from(new Set(daCelula.map((row) => row.serviceType).filter(Boolean)));
  const casos = useMemo(() => new Set(filtrados.map((row) => `${row.fac}|${row.os}`)).size, [filtrados]);

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
              placeholder="FV, OS ou endereço"
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
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="glass" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </Card>

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
                  <th className="py-2 pr-3 font-medium">FV / OS</th>
                  <th className="py-2 pr-3 font-medium">Endereço</th>
                  <th className="py-2 pr-3 font-medium">Município</th>
                  <th className="py-2 pr-3 font-medium">Serviço</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 align-top">
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
      </Card>
    </AuditorShell>
  );
}
