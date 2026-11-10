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
  cachedCases,
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

function kpisBase(total: number, parte: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function AuditorBi() {
  const [cases, setCases] = useState<CaseRow[]>(() => cachedCases() ?? []);
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

  const porCelula = CELL_KEYS.map((key) => {
    const daCelula = filtrados.filter((row) => row.cell === key);
    const conformes = daCelula.filter((row) => row.outcome === "conforme").length;
    const naoConformes = daCelula.filter((row) => row.outcome === "nao_conforme").length;
    const devolucoes = daCelula.reduce((total, row) => total + row.returnedCount, 0);
    const pct = kpisBase(filtrados.length, daCelula.length);

    const servicos = new Map<string, number>();
    daCelula.forEach((row) => {
      const nome = row.serviceType || "Não informado";
      servicos.set(nome, (servicos.get(nome) ?? 0) + 1);
    });
    const topServicos = Array.from(servicos.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const frase =
      daCelula.length === 0
        ? `Sem registros nesta célula no período.`
        : `${daCelula.length} FV/OS (${pct}% do total), com ${conformes} conformidade(s) e ${naoConformes} não conformidade(s) confirmada(s)${
            devolucoes > 0 ? ` e ${devolucoes} devolução(ões) da AlphaGeos` : ""
          }. Serviço predominante: ${topServicos[0]?.nome ?? "não informado"}.`;

    return {
      key,
      nome: CELLS[key].label,
      short: CELLS[key].short,
      total: daCelula.length,
      conformes,
      naoConformes,
      devolucoes,
      pct,
      topServicos,
      frase,
      pctConforme: kpisBase(daCelula.length, conformes),
      pctNaoConforme: kpisBase(daCelula.length, naoConformes),
    };
  });

  const unicas = new Set(filtrados.map((row) => `${row.fac}|${row.os}`)).size;
  const temDados = filtrados.length > 0;

  const periodoLabel = `${filters.from ? formatDateBR(filters.from) : "início"} a ${
    filters.to ? formatDateBR(filters.to) : formatDateBR(new Date())
  }`;

  const analise = useMemo(() => {
    if (filtrados.length === 0) {
      return "Não há registros no período selecionado. Os indicadores serão preenchidos assim que houver FV/OS importadas nas células.";
    }

    const maior = [...porCelula].sort((a, b) => b.total - a.total)[0];
    const servicoTop = [...porServico].sort((a, b) => b.total - a.total)[0];
    const emFiscalizacao = porCelula.find((item) => item.key === "fiscalizacao")?.total ?? 0;
    const emRefazer = porCelula.find((item) => item.key === "refazer")?.total ?? 0;
    const respondidos = porCelula.find((item) => item.key === "respondidos")?.total ?? 0;
    const naoAvaliados = porCelula.find((item) => item.key === "nao_avaliado")?.total ?? 0;

    const partes = [
      `No período de ${periodoLabel}, a Célula da Qualidade tratou ${unicas} FV/OS, distribuídas em ${filtrados.length} registro(s) nas células de trabalho.`,
    ];

    if (maior && maior.total > 0) {
      partes.push(
        `O maior volume está em "${maior.nome}" (${maior.total} — ${maior.pct}% do total).`,
      );
    }
    partes.push(
      `Em fiscalização: ${emFiscalizacao}. Em refazer: ${emRefazer}. Respondidos à AlphaGeos: ${respondidos}. Não avaliados: ${naoAvaliados}.`,
    );
    if (servicoTop && servicoTop.total > 0) {
      partes.push(`O tipo de serviço mais frequente é "${servicoTop.nome}" (${servicoTop.total}).`);
    }
    partes.push(
      `Foram registradas ${kpis.devolucoes} devolução(ões) da AlphaGeos e ${kpis.corrigidos} correção(ões) concluída(s) no período.`,
    );

    return partes.join(" ");
  }, [filtrados.length, unicas, porCelula, porServico, kpis.devolucoes, kpis.corrigidos, periodoLabel]);

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

      <Card className="p-3">
        <h3 className="text-xs font-semibold text-foreground">Análise por célula</h3>
        <div className="mt-2 space-y-1.5">
          {porCelula.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span className="w-44 shrink-0 truncate text-[11px] text-foreground">{item.nome}</span>
              <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-success" style={{ width: `${item.pctConforme}%` }} />
                <div className="h-full bg-destructive" style={{ width: `${item.pctNaoConforme}%` }} />
                <div
                  className="h-full bg-[hsl(var(--auditor-navy-mid))]"
                  style={{ width: `${Math.max(0, 100 - item.pctConforme - item.pctNaoConforme)}%` }}
                />
              </div>
              <span className="auditor-num w-10 text-right text-[11px] font-semibold text-foreground">
                {item.total}
              </span>
              <span className="w-10 text-right text-[10px] text-muted-foreground">{item.pct}%</span>
            </div>
          ))}
        </div>
      </Card>

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
        <article className="print-sheet mx-auto flex flex-col px-[14mm] py-[12mm] font-sheet">
          <header className="rounded-sm bg-slate-900 px-4 py-3 text-white">
            <p className="text-[7.5px] uppercase tracking-[0.3em] text-slate-300">
              Qualy Auditor · Inteligência de Fiscalização
            </p>
            <h1 className="mt-1 text-[19px] font-bold leading-tight">
              RELATÓRIO GERENCIAL DA FISCALIZAÇÃO
            </h1>
            <p className="mt-0.5 text-[8.5px] text-slate-300">
              Período: {periodoLabel} · Regiões: Vila Maria e Santana
            </p>
          </header>

          <section className="mt-4 grid grid-cols-4 gap-2">
            {[
              ["FV/OS únicas", unicas, "#0F172A"],
              ["Conformes", kpis.conforme, "#047857"],
              ["Não conformes", kpis.naoConforme, "#B91C1C"],
              ["Pendências abertas", kpis.refazerPendentes, "#B45309"],
            ].map(([label, valor, cor]) => (
              <div key={String(label)} className="rounded-sm border border-slate-200 px-2 py-2">
                <p className="text-[6.5px] uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-[22px] font-bold leading-none" style={{ color: String(cor) }}>
                  {valor}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-4">
            <h2 className="border-b border-slate-300 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide">
              Resumo executivo
            </h2>
            <p className="mt-1.5 text-[8.5px] leading-relaxed text-slate-800">{analise}</p>
          </section>

          <section className="mt-4">
            <h2 className="border-b border-slate-300 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide">
              Distribuição das FV/OS por célula
            </h2>
            <div className="mt-1.5 space-y-1.5">
              {porCelula.map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-[8px]">
                  <span className="w-44 truncate">{item.nome}</span>
                  <div className="flex h-3 flex-1 overflow-hidden bg-slate-200">
                    <div style={{ width: `${item.pct}%`, background: "#0F2A4A" }} />
                  </div>
                  <span className="w-8 text-right font-bold">{item.total}</span>
                  <span className="w-8 text-right text-slate-500">{item.pct}%</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <h2 className="border-b border-slate-300 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                Indicadores gerais
              </h2>
              <div className="mt-1 text-[8px]">
                {[
                  ["Aguardando análise", kpis.aguardando],
                  ["Em fiscalização", kpis.fiscalizacao],
                  ["Relatórios enviados", kpis.relatorios],
                  ["Serviços a refazer", kpis.refazerTotal],
                  ["Correções concluídas", kpis.corrigidos],
                  ["Devoluções AlphaGeos", kpis.devolucoes],
                  ["Tratativas encerradas", kpis.encerradas],
                  ["Documentos importados", totais?.documents ?? 0],
                ].map(([label, valor]) => (
                  <div key={String(label)} className="flex justify-between border-b border-slate-100 py-0.5">
                    <span className="text-slate-600">{label}</span>
                    <strong>{valor}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="border-b border-slate-300 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                Legenda das cores
              </h2>
              <div className="mt-1 space-y-1 text-[8px]">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3" style={{ background: "#10B981" }} />
                  Conforme confirmado
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3" style={{ background: "#DC2626" }} />
                  Não conforme confirmado
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3" style={{ background: "#0F2A4A" }} />
                  Em andamento / pendente
                </div>
                <p className="mt-2 text-[7px] leading-snug text-slate-500">
                  N/A e serviços não avaliados nunca são contabilizados como conformidade.
                  Cada FV/OS é contada uma única vez, independentemente do número de etapas.
                </p>
              </div>
            </div>
          </section>

          <footer className="mt-auto border-t border-slate-300 pt-1 text-[7px] text-slate-500">
            <p>{AUDITOR_SIGNATURE} · Qualy Auditor</p>
          </footer>
        </article>

        <article className="print-sheet mx-auto flex flex-col px-[14mm] py-[12mm] font-sheet">
          <header className="border-b-2 border-slate-800 pb-1">
            <p className="text-[7.5px] uppercase tracking-[0.3em] text-slate-500">
              Qualy Auditor · Inteligência de Fiscalização
            </p>
            <h1 className="text-[15px] font-bold">ANÁLISE POR CÉLULA DE TRABALHO</h1>
            <p className="text-[8px] text-slate-600">Período: {periodoLabel}</p>
          </header>

          <div className="mt-2 space-y-2.5">
            {porCelula.map((item, index) => (
              <section key={item.key} className="rounded-sm border border-slate-200 px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[10px] font-bold uppercase tracking-wide">
                    {String(index + 1).padStart(2, "0")} · {item.nome}
                  </h2>
                  <p className="text-[8px] text-slate-500">
                    {item.total} FV/OS · {item.pct}% do total
                  </p>
                </div>

                <div className="mt-1 flex h-2.5 w-full overflow-hidden bg-slate-200">
                  <div style={{ width: `${item.pctConforme}%`, background: "#10B981" }} />
                  <div style={{ width: `${item.pctNaoConforme}%`, background: "#DC2626" }} />
                  <div
                    style={{
                      width: `${Math.max(0, 100 - item.pctConforme - item.pctNaoConforme)}%`,
                      background: "#0F2A4A",
                    }}
                  />
                </div>

                <div className="mt-1 grid grid-cols-4 gap-2 text-[7.5px]">
                  <p>
                    <span className="text-slate-500">Conforme:</span> <strong>{item.conformes}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Não conforme:</span> <strong>{item.naoConformes}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Em aberto:</span>{" "}
                    <strong>{Math.max(0, item.total - item.conformes - item.naoConformes)}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Devoluções:</span> <strong>{item.devolucoes}</strong>
                  </p>
                </div>

                <p className="mt-1 text-[8px] leading-snug text-slate-700">{item.frase}</p>

                {item.topServicos.length > 0 && (
                  <p className="mt-0.5 text-[7.5px] text-slate-500">
                    Serviços:{" "}
                    {item.topServicos.map((servico) => `${servico.nome} (${servico.total})`).join(" · ")}
                  </p>
                )}
              </section>
            ))}
          </div>

          <footer className="mt-auto border-t border-slate-300 pt-1 text-[7px] text-slate-500">
            <p>{AUDITOR_SIGNATURE} · Qualy Auditor</p>
            <p>Emitido em {formatDateBR(new Date())}</p>
          </footer>
        </article>

        <article className="print-sheet mx-auto flex flex-col px-[14mm] py-[12mm] font-sheet">
          <header className="border-b-2 border-slate-800 pb-1">
            <p className="text-[7.5px] uppercase tracking-[0.3em] text-slate-500">
              Qualy Auditor · Inteligência de Fiscalização
            </p>
            <h1 className="text-[15px] font-bold">INDICADORES E CONCLUSÃO</h1>
            <p className="text-[8px] text-slate-600">Período: {periodoLabel}</p>
          </header>

          <section className="mt-2">
            <h2 className="text-[9.5px] font-bold uppercase tracking-wide">Situação das tratativas</h2>
            <div className="mt-1 space-y-0.5">
              {ANALYSIS_ORDER.map((status) => {
                const total = filtrados.filter((row) => row.status === status).length;
                const pct = kpisBase(filtrados.length, total);
                return (
                  <div key={status} className="flex items-center gap-2 text-[8px]">
                    <span className="w-44 truncate">{ANALYSIS_STATUS[status]}</span>
                    <div className="h-2 flex-1 bg-slate-200">
                      <div style={{ width: `${pct}%`, background: "#0F2A4A" }} />
                    </div>
                    <span className="w-6 text-right font-bold">{total}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-3">
            <h2 className="text-[9.5px] font-bold uppercase tracking-wide">Tipos de serviço</h2>
            <div className="mt-1 space-y-0.5">
              {porServico.length === 0 ? (
                <p className="text-[8px] text-slate-500">Sem registros no período.</p>
              ) : (
                porServico.map((item) => {
                  const pct = kpisBase(filtrados.length, item.total);
                  return (
                    <div key={item.nome} className="flex items-center gap-2 text-[8px]">
                      <span className="w-44 truncate">{item.nome}</span>
                      <div className="h-2 flex-1 bg-slate-200">
                        <div style={{ width: `${pct}%`, background: "#334155" }} />
                      </div>
                      <span className="w-6 text-right font-bold">{item.total}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="mt-3">
            <h2 className="text-[9.5px] font-bold uppercase tracking-wide">Evolução mensal</h2>
            <div className="mt-1 space-y-0.5">
              {evolucao.length === 0 ? (
                <p className="text-[8px] text-slate-500">Sem registros no período.</p>
              ) : (
                evolucao.map((item) => {
                  const maximo = Math.max(...evolucao.map((linha) => linha.total), 1);
                  return (
                    <div key={item.mes} className="flex items-center gap-2 text-[8px]">
                      <span className="w-16">{item.mes}</span>
                      <div className="h-2 flex-1 bg-slate-200">
                        <div
                          style={{ width: `${Math.round((item.total / maximo) * 100)}%`, background: "#64748B" }}
                        />
                      </div>
                      <span className="w-6 text-right font-bold">{item.total}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="mt-3">
            <h2 className="text-[9.5px] font-bold uppercase tracking-wide">Serviços a refazer</h2>
            <div className="mt-1 grid grid-cols-3 gap-1.5 text-[8px]">
              <div className="border border-slate-300 px-1.5 py-1">
                <p className="text-[6.5px] uppercase text-slate-500">Encaminhados</p>
                <p className="text-[12px] font-bold">{kpis.refazerTotal}</p>
              </div>
              <div className="border border-slate-300 px-1.5 py-1">
                <p className="text-[6.5px] uppercase text-slate-500">Pendentes</p>
                <p className="text-[12px] font-bold">{kpis.refazerPendentes}</p>
              </div>
              <div className="border border-slate-300 px-1.5 py-1">
                <p className="text-[6.5px] uppercase text-slate-500">Corrigidos</p>
                <p className="text-[12px] font-bold">{kpis.corrigidos}</p>
              </div>
            </div>
          </section>

          <section className="mt-3">
            <h2 className="text-[9.5px] font-bold uppercase tracking-wide">Conclusão gerencial</h2>
            <p className="mt-1 text-[8.5px] leading-relaxed text-slate-800">
              {kpis.recebidas === 0
                ? "Não há dados suficientes no período para conclusão gerencial."
                : `Foram tratadas ${unicas} FV/OS, com ${kpis.conforme} conformidade(s) confirmada(s) e ${kpis.naoConforme} não conformidade(s). As células de fiscalização e refazer concentram ${(porCelula.find((c) => c.key === "fiscalizacao")?.total ?? 0) + (porCelula.find((c) => c.key === "refazer")?.total ?? 0)} FV/OS, ou seja, a maior parte das ações em andamento. Restam ${kpis.refazerPendentes} pendência(s) de correção e ${kpis.devolucoes} devolução(ões) da AlphaGeos a tratar. Recomenda-se acompanhamento semanal das células Refazer e Em fiscalização até a zeragem das pendências.`}
            </p>
          </section>

          <footer className="mt-auto border-t border-slate-300 pt-1 text-[7px] text-slate-500">
            <p>{AUDITOR_SIGNATURE} · Qualy Auditor — Inteligência de Fiscalização</p>
            <p>Documento de uso interno — Célula da Qualidade · Vila Maria e Santana</p>
          </footer>
        </article>
      </PrintPortal>
    </AuditorShell>
  );
}
