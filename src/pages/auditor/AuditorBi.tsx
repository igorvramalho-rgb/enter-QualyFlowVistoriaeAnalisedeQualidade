import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { PrintPortal } from "@/components/report/print-portal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  ANALYSIS_ORDER,
  ANALYSIS_STATUS,
  AUDITOR_SIGNATURE,
  CELLS,
  CELL_KEYS,
  REDO_STATUS,
  fetchAuditorCounts,
  type AuditorCounts,
  fetchCases,
  fetchRedoQueue,
  fetchReportsQueue,
  type AnalysisStatus,
  type AuditorRedo,
  type AuditorReport,
  type CaseRow,
} from "@/lib/auditor";
import { saveReportPdfFile } from "@/lib/report-export";
import { downloadCsv } from "@/lib/csv";
import { formatDateBR } from "@/lib/fields";

interface Filters {
  from: string;
  to: string;
  locality: string;
  service: string;
  status: string;
}

const EMPTY: Filters = { from: "", to: "", locality: "", service: "", status: "" };

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function AuditorBi() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [redo, setRedo] = useState<AuditorRedo[]>([]);
  const [reports, setReports] = useState<AuditorReport[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [totais, setTotais] = useState<AuditorCounts | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listaCasos, listaRedo, listaRelatorios, contagens] = await Promise.all([
        fetchCases(),
        fetchRedoQueue(),
        fetchReportsQueue(),
        fetchAuditorCounts(),
      ]);
      setCases(listaCasos);
      setRedo(listaRedo);
      setReports(listaRelatorios);
      setTotais(contagens);
    } catch (problem) {
      toast.error("Falha ao carregar o painel", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtrados = useMemo(() => {
    const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;

    return cases.filter((row) => {
      const created = new Date(row.updatedAt).getTime();
      if (from && created < from) return false;
      if (to && created > to) return false;
      if (filters.locality && row.locality !== filters.locality) return false;
      if (filters.service && row.serviceType !== filters.service) return false;
      if (filters.status && row.status !== filters.status) return false;
      return true;
    });
  }, [cases, filters]);

  const ids = useMemo(() => new Set(filtrados.map((row) => row.id)), [filtrados]);
  const redoFiltrado = useMemo(() => redo.filter((row) => ids.has(row.caseId)), [redo, ids]);
  const reportsFiltrados = useMemo(
    () => reports.filter((row) => ids.has(row.caseId)),
    [reports, ids],
  );

  const kpis = useMemo(() => {
    const porStatus = (status: AnalysisStatus) => filtrados.filter((row) => row.status === status).length;
    const pendentes = redoFiltrado.filter((row) => row.status !== "encerrado");
    return {
      recebidas: filtrados.length,
      analisadas: filtrados.filter((row) => row.status !== "aguardando_analise").length,
      aguardando: porStatus("aguardando_analise"),
      fiscalizacao: porStatus("encaminhado_fiscalizacao") + porStatus("aguardando_retorno_fiscal"),
      conforme: filtrados.filter((row) => row.outcome === "conforme").length,
      naoConforme: filtrados.filter((row) => row.outcome === "nao_conforme").length,
      relatorios: reportsFiltrados.filter((row) => row.status === "enviado").length,
      refazerTotal: redoFiltrado.length,
      refazerPendentes: pendentes.length,
      corrigidos: redoFiltrado.filter((row) => row.status === "corrigido_fotos" || row.status === "encerrado").length,
      devolucoes: filtrados.reduce((total, row) => total + row.returnedCount, 0),
      encerradas: porStatus("encerrado"),
    };
  }, [filtrados, redoFiltrado, reportsFiltrados]);

  const evolucao = useMemo(() => {
    const map = new Map<string, number>();
    filtrados.forEach((row) => {
      const key = monthKey(row.updatedAt);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes, total }));
  }, [filtrados]);

  const conformidade = [
    { nome: "Conforme", total: kpis.conforme, cor: "hsl(var(--success))" },
    { nome: "Não conforme", total: kpis.naoConforme, cor: "hsl(var(--destructive))" },
    { nome: "Pendente", total: kpis.recebidas - kpis.conforme - kpis.naoConforme, cor: "hsl(var(--muted-foreground))" },
  ];

  const pendentesVsConcluidos = [
    { nome: "Pendentes", total: kpis.refazerPendentes },
    { nome: "Corrigidos", total: kpis.corrigidos },
  ];

  const porServico = useMemo(() => {
    const map = new Map<string, number>();
    filtrados.forEach((row) => {
      const key = row.serviceType || "Não informado";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nome, total]) => ({ nome: nome.slice(0, 22), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [filtrados]);

  const porCelula = CELL_KEYS.map((key) => ({
    nome: CELLS[key].short,
    total: filtrados.filter((row) => row.cell === key).length,
  }));

  const unicas = new Set(filtrados.map((row) => `${row.fac}|${row.os}`)).size;
  const temDados = filtrados.length > 0;

  const exportarCsv = () => {
    downloadCsv(
      `qualy-auditor-bi-${new Date().toISOString().slice(0, 10)}.csv`,
      ["FV", "OS", "Endereço", "Município", "Localidade", "Serviço", "Célula", "Situação", "Resultado", "Devoluções"],
      filtrados.map((row) => [
        row.fac,
        row.os,
        row.address,
        row.municipality,
        row.locality,
        row.serviceType,
        CELLS[row.cell]?.label ?? row.cell,
        ANALYSIS_STATUS[row.status],
        row.outcome,
        String(row.returnedCount),
      ]),
    );
  };

  const exportarExcel = async () => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.utils.book_new();

      const resumo = [
        ["Indicador", "Valor"],
        ["FV/OS recebidas", kpis.recebidas],
        ["FV/OS analisadas", kpis.analisadas],
        ["Aguardando análise", kpis.aguardando],
        ["Em fiscalização", kpis.fiscalizacao],
        ["Conforme após verificação", kpis.conforme],
        ["Não conforme confirmado", kpis.naoConforme],
        ["Relatórios enviados", kpis.relatorios],
        ["Serviços a refazer", kpis.refazerTotal],
        ["Pendentes de refazer", kpis.refazerPendentes],
        ["Corrigidos", kpis.corrigidos],
        ["Devoluções AlphaGeos", kpis.devolucoes],
        ["Encerradas", kpis.encerradas],
        ["Período", `${filters.from || "início"} a ${filters.to || "hoje"}`],
      ];
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

      const base = [
        ["FV", "OS", "Endereço", "Município", "Localidade", "Serviço", "Situação", "Resultado", "Devoluções"],
        ...filtrados.map((row) => [
          row.fac,
          row.os,
          row.address,
          row.municipality,
          row.locality,
          row.serviceType,
          ANALYSIS_STATUS[row.status],
          row.outcome,
          row.returnedCount,
        ]),
      ];
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(base), "Base FV-OS");

      const relatorios = [
        ["FV", "OS", "Status", "Enviado em"],
        ...reportsFiltrados.map((row) => {
          const caso = cases.find((item) => item.id === row.caseId);
          return [caso?.fac ?? "", caso?.os ?? "", row.status, row.sentAt ?? ""];
        }),
      ];
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(relatorios), "Relatórios");

      const refazer = [
        ["FV", "OS", "Item", "Equipe", "Encarregado", "Situação", "Encaminhado", "Programado", "Concluído"],
        ...redoFiltrado.map((row) => {
          const caso = cases.find((item) => item.id === row.caseId);
          return [
            caso?.fac ?? "",
            caso?.os ?? "",
            row.itemCode,
            row.teamType,
            row.foreman,
            REDO_STATUS[row.status],
            row.sentAt ?? "",
            row.scheduledAt ?? "",
            row.finishedAt ?? "",
          ];
        }),
      ];
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(refazer), "Refazer");

      XLSX.writeFile(
        book,
        `qualy-auditor-bi-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("Excel gerado");
    } catch (problem) {
      toast.error("Falha ao gerar o Excel", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const gerarPdf = async () => {
    setBusy(true);
    try {
      const result = await saveReportPdfFile(`qualy-auditor-bi-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(result === "unconfirmed" ? "PDF gerado (download sem confirmação)" : "PDF gerado");
    } catch (problem) {
      toast.error("Falha ao gerar o PDF", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const locais = Array.from(new Set(cases.map((row) => row.locality).filter(Boolean)));
  const servicos = Array.from(new Set(cases.map((row) => row.serviceType).filter(Boolean)));

  return (
    <AuditorShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Painel gerencial</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="glass" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </Button>
          <Button type="button" variant="glass" size="sm" onClick={exportarCsv} disabled={busy || filtrados.length === 0}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button type="button" variant="glass" size="sm" onClick={() => void exportarExcel()} disabled={busy}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
          <Button type="button" variant="glow" size="sm" onClick={() => void gerarPdf()} disabled={busy}>
            <Download className="h-3.5 w-3.5" />
            Relatório PDF
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            De
            <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-0.5 h-8 text-xs" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Até
            <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-0.5 h-8 text-xs" />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Localidade
            <select value={filters.locality} onChange={(event) => setFilters({ ...filters, locality: event.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs">
              <option value="">todas</option>
              {locais.map((local) => (
                <option key={local} value={local}>{local}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Serviço
            <select value={filters.service} onChange={(event) => setFilters({ ...filters, service: event.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs">
              <option value="">todos</option>
              {servicos.map((servico) => (
                <option key={servico} value={servico}>{servico}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Situação
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs">
              <option value="">todas</option>
              {ANALYSIS_ORDER.map((status) => (
                <option key={status} value={status}>{ANALYSIS_STATUS[status]}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["FV/OS recebidas", kpis.recebidas],
          ["Analisadas", kpis.analisadas],
          ["Aguardando análise", kpis.aguardando],
          ["Em fiscalização", kpis.fiscalizacao],
          ["Conforme", kpis.conforme],
          ["Não conforme", kpis.naoConforme],
          ["Relatórios enviados", kpis.relatorios],
          ["Devoluções", kpis.devolucoes],
          ["FV/OS únicas", unicas],
          ["Documentos", totais?.documents ?? 0],
          ["Movimentações", totais?.events ?? 0],
        ].map(([label, valor]) => (
          <div key={String(label)} className="auditor-tile rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="auditor-num text-xl font-semibold text-foreground">{valor}</p>
          </div>
        ))}
      </div>

      {!temDados ? (
        <Card className="p-6 text-center text-xs text-muted-foreground">
          Nenhuma FV/OS no período selecionado. Os indicadores aparecem quando houver registros —
          nada é preenchido com número fictício.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-3">
            <h3 className="text-xs font-semibold text-foreground">Distribuição por célula</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCelula}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--auditor-navy-mid))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-foreground">Evolução mensal</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-foreground">Conforme × não conforme</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conformidade}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total">
                    {conformidade.map((item) => (
                      <Cell key={item.nome} fill={item.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-foreground">Serviços a refazer</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pendentesVsConcluidos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <h3 className="text-xs font-semibold text-foreground">Tipos de serviço</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porServico} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="nome" type="category" width={110} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <PrintPortal>
        <article className="print-sheet mx-auto flex flex-col px-[12mm] py-[10mm] font-sheet">
          <header className="border-b-2 border-slate-800 pb-2">
            <p className="text-[9px] uppercase tracking-widest">Qualy Auditor — Inteligência de Fiscalização</p>
            <h1 className="text-[17px] font-bold">RELATÓRIO GERENCIAL</h1>
            <p className="text-[9px]">
              Período: {filters.from ? formatDateBR(filters.from) : "início"} a{" "}
              {filters.to ? formatDateBR(filters.to) : formatDateBR(new Date())} · Vila Maria e Santana
            </p>
          </header>

          <section className="mt-3 grid grid-cols-4 gap-2 text-[9px]">
            {[
              ["FV/OS recebidas", kpis.recebidas],
              ["Analisadas", kpis.analisadas],
              ["Conforme", kpis.conforme],
              ["Não conforme", kpis.naoConforme],
              ["Relatórios enviados", kpis.relatorios],
              ["A refazer", kpis.refazerTotal],
              ["Pendentes", kpis.refazerPendentes],
              ["Devoluções", kpis.devolucoes],
            ].map(([label, valor]) => (
              <div key={String(label)} className="border border-slate-300 px-1.5 py-1">
                <p className="text-[7px] uppercase text-slate-500">{label}</p>
                <p className="text-[13px] font-bold">{valor}</p>
              </div>
            ))}
          </section>

          <section className="mt-4">
            <h2 className="text-[10px] font-bold uppercase">Situação das tratativas</h2>
            <table className="mt-1 w-full border-collapse text-[8px]">
              <tbody>
                {ANALYSIS_ORDER.map((status) => (
                  <tr key={status}>
                    <td className="border border-slate-300 px-1 py-0.5">{ANALYSIS_STATUS[status]}</td>
                    <td className="border border-slate-300 px-1 py-0.5 text-right">
                      {filtrados.filter((row) => row.status === status).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-4">
            <h2 className="text-[10px] font-bold uppercase">Resumo executivo</h2>
            <p className="mt-1 text-[9px] leading-snug">
              No período, {kpis.recebidas} FV/OS foram tratadas, sendo {kpis.conforme} consideradas
              conformes e {kpis.naoConforme} confirmadas como não conformes. Foram emitidos{" "}
              {kpis.relatorios} relatórios de resposta e {kpis.devolucoes} devolução(ões) da AlphaGeos
              foram registradas. Existem {kpis.refazerPendentes} serviço(s) pendentes de correção,
              com {kpis.corrigidos} corrigido(s).
            </p>
          </section>

          <footer className="mt-auto border-t border-slate-300 pt-1 text-[8px]">
            <p>{AUDITOR_SIGNATURE} · Qualy Auditor</p>
            <p>Emitido em {formatDateBR(new Date())}</p>
          </footer>
        </article>
      </PrintPortal>
    </AuditorShell>
  );
}
