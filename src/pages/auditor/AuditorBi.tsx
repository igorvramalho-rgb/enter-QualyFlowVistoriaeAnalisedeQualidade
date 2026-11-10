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
import { savePdfBlob } from "@/lib/report-export";
import { buildBiPdf } from "@/lib/auditor-bi-pdf";
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

  const motivos = useMemo(() => {
    const mapa = new Map<string, number>();
    filtrados
      .filter((row) => row.cell === "nao_avaliado")
      .forEach((row) => {
        const motivo = (row.motive || "Não informado").trim();
        mapa.set(motivo, (mapa.get(motivo) ?? 0) + 1);
      });
    return Array.from(mapa.entries())
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);

  const unicas = new Set(filtrados.map((row) => `${row.fac}|${row.os}`)).size;
  const temDados = filtrados.length > 0;

  const conclusao = useMemo(() => {
    if (kpis.recebidas === 0) {
      return "Não há dados suficientes no período para conclusão gerencial.";
    }
    const fiscalizacao = porCelula.find((item) => item.key === "fiscalizacao")?.total ?? 0;
    const refazer = porCelula.find((item) => item.key === "refazer")?.total ?? 0;
    const naoAvaliados = porCelula.find((item) => item.key === "nao_avaliado")?.total ?? 0;
    const motivoTop = motivos[0];

    return `Foram tratadas ${unicas} FV/OS no período, com ${kpis.conforme} conformidade(s) confirmada(s) e ${kpis.naoConforme} não conformidade(s). As células Em fiscalização (${fiscalizacao}) e Refazer (${refazer}) concentram as ações em andamento.${
      naoAvaliados > 0
        ? ` Há ${naoAvaliados} serviço(s) não avaliado(s)${motivoTop ? `, sendo o motivo mais frequente "${motivoTop.motivo}" (${motivoTop.total})` : ""}.`
        : ""
    } Restam ${kpis.refazerPendentes} pendência(s) de correção e ${kpis.devolucoes} devolução(ões) da AlphaGeos a tratar. Recomenda-se acompanhamento semanal até a zeragem das pendências.`;
  }, [kpis, porCelula, motivos, unicas]);

  const periodoLabel = `${filters.from ? formatDateBR(filters.from) : "início"} a ${
    filters.to ? formatDateBR(filters.to) : formatDateBR(new Date())
  }`;

  const analise = useMemo(() => {
    if (filtrados.length === 0) {
      return "Não há registros no período selecionado.";
    }

    const valor = (key: string) => porCelula.find((item) => item.key === key)?.total ?? 0;

    return `Foram avaliadas ${unicas} FV/OS: ${valor("fiscalizacao")} em fiscalização, ${valor(
      "refazer",
    )} em refazer, ${valor("respondidos")} respondidos à AlphaGeos, ${valor("rpa")} em RPA e ${valor(
      "nao_avaliado",
    )} em análise (não avaliados).`;
  }, [filtrados.length, unicas, porCelula]);

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
      const doc = buildBiPdf({
        periodo: periodoLabel,
        totalUnicas: unicas,
        conformes: kpis.conforme,
        naoConformes: kpis.naoConforme,
        pendentes: kpis.refazerPendentes,
        cells: porCelula.map((item) => ({
          label: item.nome,
          total: item.total,
          conformes: item.conformes,
          naoConformes: item.naoConformes,
          devolucoes: item.devolucoes,
          pct: item.pct,
          servicos: item.topServicos.map((servico) => servico.nome),
          analise: item.frase,
        })),
        motivos,
        resumo: analise,
        conclusao,
        emitidoEm: new Date().toLocaleString("pt-BR"),
      });

      const blob = doc.output("blob");
      const nome = `qualy-auditor-bi-${new Date().toISOString().slice(0, 10)}.pdf`;
      const resultado = await savePdfBlob(blob, nome);

      if (resultado === "cancelled") {
        toast.info("Geração cancelada");
      } else {
        toast.success("Relatório gerado", { description: nome });
      }
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


    </AuditorShell>
  );
}
