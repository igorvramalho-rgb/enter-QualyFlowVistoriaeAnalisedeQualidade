import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleSlash,
  Crosshair,
  Download,
  Eraser,
  FileSearch,
  FileUp,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  Search,
  Square,
  SquareCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { CELLS, CELL_KEYS, cellLabel, type CellKey } from "@/lib/auditor";
import { downloadCsv } from "@/lib/csv";
import {
  clearSniperBase,
  countSniperDocuments,
  fetchSniperDocuments,
  importSniperDocuments,
  migrateSniperToCell,
  type SniperImportEntry,
  type SniperSavedDocument,
} from "@/lib/sniper-store";
import {
  parseSniperDocument,
  SNIPER_MOTIVO_LABEL,
  SNIPER_ORDER,
  SNIPER_VERDICT_LABEL,
  type SniperVerdict,
} from "@/lib/sniper";
import { cn } from "@/lib/utils";

/** Limite operacional da importação em lote. */
const MAX_FILES = 1000;
const PAGINA = 40;

type Filtro = "todos" | SniperVerdict;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "nao_executado", label: "Não executado" },
  { key: "tudo_na", label: "100% N/A" },
  { key: "na_parcial", label: "N/A parcial" },
  { key: "avaliado", label: "Avaliados" },
];

const VERDICT_CLASS: Record<SniperVerdict, string> = {
  nao_executado: "border-chart-5/45 bg-chart-5/10 text-chart-5",
  tudo_na: "border-destructive/45 bg-destructive/10 text-destructive",
  na_parcial: "border-warning/45 bg-warning/10 text-warning",
  avaliado: "border-success/45 bg-success/10 text-success",
  sem_itens: "border-glass-border/60 bg-muted text-muted-foreground",
};

const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

const dataBR = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
};

/**
 * Sniper Analítico — base própria (`qa_sniper_documents`), independente das
 * células do Qualy Auditor. Importa em lote, deixa selecionar os arquivos e
 * migra os escolhidos para a célula desejada (N/A por padrão).
 */
export function SniperAnalitico() {
  const [docs, setDocs] = useState<SniperSavedDocument[]>([]);
  const [totalBase, setTotalBase] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erroBase, setErroBase] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<CellKey>("nao_avaliado");
  const [migrarOpen, setMigrarOpen] = useState(false);
  const [removerAposMigrar, setRemoverAposMigrar] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [limpandoOpen, setLimpandoOpen] = useState(false);
  const [copiaBaixada, setCopiaBaixada] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [limpando, setLimpando] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number; arquivo: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelarRef = useRef(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [linhas, total] = await Promise.all([fetchSniperDocuments(), countSniperDocuments()]);
      setDocs(linhas);
      setTotalBase(total);
      setErroBase(null);
    } catch (error) {
      setErroBase(error instanceof Error ? error.message : "Falha ao carregar a base do Sniper");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const analisar = async (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }

    const pdfs = Array.from(list).filter(isPdf);
    if (pdfs.length === 0) {
      toast.error("Selecione arquivos PDF", { description: "O Sniper lê apenas FVs em .pdf." });
      return;
    }

    const arquivos = pdfs.slice(0, MAX_FILES);
    if (pdfs.length > arquivos.length) {
      toast.info("Seleção ajustada", {
        description: `${pdfs.length} PDFs enviados; ${arquivos.length} entram nesta rodada (limite de ${MAX_FILES}).`,
      });
    }

    setBusy(true);
    cancelarRef.current = false;
    let semTexto = 0;
    let falhas = 0;
    let gravados = 0;
    let naoGravados = 0;
    let tudoNa = 0;
    let pendentes: SniperImportEntry[] = [];

    // Uma oscilação de nuvem não pode derrubar o lote inteiro: tenta de novo.
    const gravarLote = async (lote: SniperImportEntry[]) => {
      for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
        try {
          return await importSniperDocuments(lote);
        } catch (erro) {
          if (tentativa === 3) {
            throw erro;
          }
          await new Promise((resolver) => setTimeout(resolver, 600 * tentativa));
        }
      }
      return 0;
    };

    try {
      const { readPdfLayout } = await import("@/lib/pdf-extract");

      for (let index = 0; index < arquivos.length; index += 1) {
        if (cancelarRef.current) {
          break;
        }
        const arquivo = arquivos[index];
        setProgresso({ feito: index + 1, total: arquivos.length, arquivo: arquivo.name });

        try {
          const layout = await readPdfLayout(arquivo);
          const doc = parseSniperDocument(layout.pages, {
            fileName: arquivo.name,
            totalPages: layout.total,
            hasText: layout.hasText,
          });
          if (!layout.hasText) {
            semTexto += 1;
          }
          if (doc.verdict === "tudo_na") {
            tudoNa += 1;
          }
          pendentes.push({ doc, fingerprint: `${arquivo.name}::${arquivo.size}` });
        } catch {
          falhas += 1;
        }

        if (pendentes.length >= 40) {
          try {
            gravados += await gravarLote(pendentes);
          } catch {
            naoGravados += pendentes.length;
          }
          pendentes = [];
        }
      }

      if (pendentes.length > 0) {
        try {
          gravados += await gravarLote(pendentes);
        } catch {
          naoGravados += pendentes.length;
        }
      }
    } catch (error) {
      toast.error("Falha ao gravar a base do Sniper", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setProgresso(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }

    if (gravados > 0) {
      toast.success(`${gravados} documento(s) na base do Sniper`, {
        description: [
          `${tudoNa} com todas as etapas em N/A`,
          semTexto > 0 ? `${semTexto} sem camada de texto` : null,
          falhas > 0 ? `${falhas} com falha de leitura` : null,
          naoGravados > 0 ? `${naoGravados} não gravado(s) na base` : null,
          cancelarRef.current ? "importação interrompida" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } else if (falhas > 0) {
      toast.error("Nenhum PDF foi lido", { description: "Os arquivos podem estar corrompidos ou protegidos." });
    }

    await recarregar();
  };

  const ordenados = useMemo(
    () =>
      [...docs].sort(
        (a, b) => SNIPER_ORDER[a.verdict] - SNIPER_ORDER[b.verdict] || a.fileName.localeCompare(b.fileName, "pt-BR"),
      ),
    [docs],
  );

  const contagem = useMemo(() => {
    const base: Record<SniperVerdict, number> = {
      nao_executado: 0,
      tudo_na: 0,
      na_parcial: 0,
      avaliado: 0,
      sem_itens: 0,
    };
    docs.forEach((doc) => {
      base[doc.verdict] += 1;
    });
    return base;
  }, [docs]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ordenados.filter((doc) => {
      if (filtro !== "todos" && doc.verdict !== filtro) {
        return false;
      }
      if (!termo) {
        return true;
      }
      return [doc.fac, doc.os, doc.endereco, doc.municipio, doc.fileName, doc.servicoAcatado]
        .join(" ")
        .toLowerCase()
        .includes(termo);
    });
  }, [ordenados, filtro, busca]);

  const visiveis = filtrados.slice(0, limite);
  const selecionadas = useMemo(() => docs.filter((doc) => selecionados.has(doc.id)), [docs, selecionados]);

  // Serviço não executado não vai para o N/A: a célula indicada é a própria.
  useEffect(() => {
    if (selecionadas.length === 0) {
      return;
    }
    const todosNaoExecutados = selecionadas.every((doc) => doc.verdict === "nao_executado");
    setDestino((atual) =>
      todosNaoExecutados ? "nao_executado" : atual === "nao_executado" ? "nao_avaliado" : atual,
    );
  }, [selecionadas]);

  const alternar = (id: string) => {
    setSelecionados((anteriores) => {
      const proximo = new Set(anteriores);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const selecionarVisiveis = () => {
    setSelecionados((anteriores) => {
      const proximo = new Set(anteriores);
      const todosMarcados = visiveis.every((doc) => proximo.has(doc.id));
      visiveis.forEach((doc) => {
        if (todosMarcados) {
          proximo.delete(doc.id);
        } else {
          proximo.add(doc.id);
        }
      });
      return proximo;
    });
  };

  const exportar = (escopo?: SniperSavedDocument[]) => {
    const alvos = escopo ?? (filtrados.length > 0 ? filtrados : docs);
    if (alvos.length === 0) {
      toast.info("Base vazia", { description: "Importe os FVs para gerar a planilha." });
      return;
    }

    downloadCsv(
      `sniper-analitico-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "FV",
        "OS",
        "Endereço",
        "Município",
        "Data de avaliação",
        "Serviço executado",
        "Serviço acatado",
        "Itens",
        "Itens em N/A",
        "Veredito",
        "Motivo",
        "Migrado para",
        "Arquivo",
      ],
      alvos.map((doc) => [
        doc.fac,
        doc.os,
        doc.endereco,
        doc.municipio,
        doc.data,
        doc.servicoExecutado,
        doc.servicoAcatado,
        String(doc.total),
        String(doc.na),
        SNIPER_VERDICT_LABEL[doc.verdict],
        doc.motivo,
        doc.migratedCell ? cellLabel(doc.migratedCell) : "",
        doc.fileName,
      ]),
    );

    setCopiaBaixada(true);
    toast.success("Planilha gerada", { description: `${alvos.length} documento(s) exportado(s).` });
  };

  const migrar = async () => {
    if (selecionadas.length === 0) {
      return;
    }

    setMigrando(true);
    try {
      const resultado = await migrateSniperToCell(selecionadas, destino);

      if (resultado.criados + resultado.movidos === 0) {
        toast.warning("Nada migrado", {
          description: "Os documentos selecionados não têm FV/OS para gerar a tratativa.",
        });
        return;
      }

      if (removerAposMigrar) {
        await clearSniperBase(selecionadas.map((doc) => doc.id));
      }

      toast.success(`${resultado.criados + resultado.movidos} documento(s) em ${cellLabel(destino)}`, {
        description: [
          resultado.movidos > 0 ? `${resultado.movidos} tratativa(s) movida(s)` : null,
          resultado.criados > 0 ? `${resultado.criados} nova(s)` : null,
          resultado.semIdentificacao > 0 ? `${resultado.semIdentificacao} sem FV/OS` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      setSelecionados(new Set());
      setMigrarOpen(false);
      setRemoverAposMigrar(false);
      await recarregar();
    } catch (error) {
      toast.error("Falha ao migrar", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setMigrando(false);
    }
  };

  const limparBase = async () => {
    setLimpando(true);
    try {
      const removidos = await clearSniperBase();
      toast.success("Base do Sniper limpa", { description: `${removidos} documento(s) removido(s).` });
      setSelecionados(new Set());
      setLimpandoOpen(false);
      setPalavra("");
      setCopiaBaixada(false);
      await recarregar();
    } catch (error) {
      toast.error("Falha ao limpar a base", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setLimpando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Crosshair className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Sniper Analítico</h2>
                <span className="rounded-full border border-glass-border/55 bg-glass/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Base própria · {totalBase} documento(s)
                </span>
              </div>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                Importa até {MAX_FILES} FVs por vez e sinaliza os serviços com todas as etapas em N/A. Serviço
                declarado como <strong className="text-foreground">não executado</strong> não entra no N/A: recebe a
                classificação própria e a célula Não executado. A base do Sniper é separada do Analista BI.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(event) => void analisar(event.target.files)}
            />
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => void recarregar()}
              disabled={busy || carregando}
            >
              {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Atualizar
            </Button>
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => exportar()}
              disabled={busy || docs.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                setCopiaBaixada(false);
                setPalavra("");
                setLimpandoOpen(true);
              }}
              disabled={busy || docs.length === 0}
            >
              <Eraser className="h-3.5 w-3.5" />
              Limpar base
            </Button>
            {busy ? (
              <Button type="button" variant="destructive" size="sm" onClick={() => (cancelarRef.current = true)}>
                <X className="h-3.5 w-3.5" />
                Parar
              </Button>
            ) : (
              <Button type="button" variant="glow" size="sm" onClick={() => inputRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" />
                Importar PDFs
              </Button>
            )}
          </div>
        </div>

        {progresso && (
          <div className="mt-3 space-y-1">
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Lendo {progresso.feito}/{progresso.total} — {progresso.arquivo}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((progresso.feito / Math.max(progresso.total, 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {erroBase && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
          Não foi possível carregar a base do Sniper: {erroBase}
        </Card>
      )}

      {docs.length === 0 && carregando ? (
        <Card className="flex items-center justify-center gap-2 border-dashed border-glass-border/60 px-6 py-12 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando a base do Sniper...
        </Card>
      ) : docs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed border-glass-border/60 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileSearch className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Base do Sniper vazia</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Importe até {MAX_FILES} FVs de uma vez (por exemplo, o FV-23282-2619857339). Os documentos ficam na base
              própria do Sniper e só entram nas células quando você selecionar e migrar.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Resumo
              label="Documentos na base"
              valor={totalBase}
              icon={ScanLine}
              className="text-foreground"
              rodape={`${docs.reduce((soma, doc) => soma + doc.total, 0)} etapas lidas${
                totalBase > docs.length ? ` (últimos ${docs.length})` : ""
              }`}
            />
            <Resumo
              label="Não executado"
              valor={contagem.nao_executado}
              icon={CircleSlash}
              className="text-chart-5"
              rodape="Fora do N/A"
            />
            <Resumo
              label="100% N/A"
              valor={contagem.tudo_na}
              icon={TriangleAlert}
              className="text-destructive"
              rodape="Todas as etapas sem avaliação"
            />
            <Resumo
              label="N/A parcial"
              valor={contagem.na_parcial}
              icon={Info}
              className="text-warning"
              rodape="Parte das etapas em N/A"
            />
            <Resumo
              label="Avaliados"
              valor={contagem.avaliado}
              icon={CircleCheck}
              className="text-success"
              rodape={`${contagem.sem_itens} sem itens localizados`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value);
                  setLimite(PAGINA);
                }}
                placeholder="Buscar FV, OS, endereço ou arquivo"
                className="h-8 w-[260px] pl-8 text-xs"
              />
            </div>
            {FILTROS.map((item) => {
              const total = item.key === "todos" ? docs.length : contagem[item.key];
              const ativo = filtro === item.key;
              return (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={ativo ? "default" : "glass"}
                  className="h-8 rounded-full px-3 text-[11px]"
                  onClick={() => {
                    setFiltro(item.key);
                    setLimite(PAGINA);
                  }}
                >
                  {item.label}
                  <span className={cn("auditor-num text-[10px]", ativo ? "opacity-80" : "text-muted-foreground")}>
                    {total}
                  </span>
                </Button>
              );
            })}
          </div>

          {visiveis.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-glass-border/55 bg-glass/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={selecionarVisiveis}>
                  {visiveis.every((doc) => selecionados.has(doc.id)) ? (
                    <SquareCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Selecionar os {visiveis.length} visíveis
                </Button>
                {selecionados.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setSelecionados(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar seleção
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Exibindo {visiveis.length} de {filtrados.length} documento(s)
                {totalBase > docs.length ? ` · ${docs.length} dos ${totalBase} mais recentes nesta tela` : ""}
              </p>
            </div>
          )}

          {selecionados.size > 0 && (
            <Card className="sticky top-2 z-20 border-primary/40 bg-card/95 p-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">
                  {selecionados.size} documento(s) selecionado(s)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Migrar para</span>
                  <Select value={destino} onValueChange={(valor) => setDestino(valor as CellKey)}>
                    <SelectTrigger className="h-8 w-[230px] bg-card text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CELL_KEYS.map((key) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {CELLS[key].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="glow" size="sm" onClick={() => setMigrarOpen(true)} disabled={migrando}>
                    {migrando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                    Migrar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {filtrados.length === 0 ? (
            <Card className="px-4 py-8 text-center text-xs text-muted-foreground">
              Nenhum documento neste filtro.
            </Card>
          ) : (
            <div className="space-y-3">
              {visiveis.map((doc) => {
                const aberto = Boolean(abertos[doc.id]);
                const etapasNa = doc.items.filter((item) => item.result === "N/A" || item.result === "");
                const marcado = selecionados.has(doc.id);
                return (
                  <Card
                    key={doc.id}
                    className={cn(
                      "overflow-hidden p-0",
                      marcado && "ring-1 ring-primary/45",
                      doc.verdict === "nao_executado" && "border-chart-5/50",
                      doc.verdict === "tudo_na" && "border-destructive/50",
                      doc.verdict === "na_parcial" && "border-warning/45",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => alternar(doc.id)}
                          aria-label={`Selecionar ${doc.fileName}`}
                          className="mt-1"
                        />
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                            doc.verdict === "nao_executado"
                              ? "bg-chart-5/10 text-chart-5 ring-chart-5/30"
                              : doc.verdict === "tudo_na"
                                ? "bg-destructive/10 text-destructive ring-destructive/30"
                                : doc.verdict === "na_parcial"
                                  ? "bg-warning/10 text-warning ring-warning/30"
                                  : "bg-muted text-muted-foreground ring-glass-border/50",
                          )}
                        >
                          {doc.verdict === "nao_executado" ? (
                            <CircleSlash className="h-4 w-4" />
                          ) : doc.verdict === "tudo_na" ? (
                            <TriangleAlert className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {doc.endereco || doc.fileName}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {[doc.municipio, doc.polo ? `Polo ${doc.polo}` : "", doc.unidade]
                              .filter(Boolean)
                              .join(" · ") || "Localidade não informada"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            VERDICT_CLASS[doc.verdict],
                          )}
                        >
                          {SNIPER_VERDICT_LABEL[doc.verdict]}
                        </span>
                        {doc.total > 0 && (
                          <span className="auditor-num rounded-full border border-glass-border/55 bg-glass/40 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                            {doc.na}/{doc.total} em N/A
                          </span>
                        )}
                        {doc.migratedCell && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Migrado para {cellLabel(doc.migratedCell)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 px-4">
                      <Chip rotulo="FV" valor={doc.fac || "—"} />
                      <Chip rotulo="OS" valor={doc.os || "—"} />
                      <Chip rotulo="Data" valor={doc.data || "—"} />
                      <Chip rotulo="Categoria" valor={doc.categoria || "—"} />
                    </div>

                    <div className="mt-3 grid gap-2 px-4 sm:grid-cols-2">
                      <Campo rotulo="Serviço executado" valor={doc.servicoExecutado} />
                      <Campo rotulo="Serviço acatado" valor={doc.servicoAcatado} destaque />
                    </div>

                    {doc.verdict === "nao_executado" && (
                      <p className="mt-2 flex items-start gap-2 px-4 text-[11px] text-chart-5">
                        <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Serviço não executado — classificado fora do N/A. A célula indicada é Não executado.
                      </p>
                    )}

                    {doc.verdict === "tudo_na" && doc.servicoAcatado && (
                      <p className="mt-2 flex items-start gap-2 px-4 text-[11px] text-destructive">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Serviço acatado declarado, porém nenhuma etapa do FV foi avaliada.
                      </p>
                    )}

                    <div className="mt-3 px-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {SNIPER_MOTIVO_LABEL[doc.motivoOrigem]}
                      </p>
                      <p
                        className={cn(
                          "mt-1 rounded-lg border px-3 py-2 text-[11px] leading-relaxed",
                          doc.motivo
                            ? "border-glass-border/55 bg-glass/40 text-foreground"
                            : "border-dashed border-glass-border/60 text-muted-foreground",
                        )}
                      >
                        {doc.motivo || "O documento não declara o motivo da não avaliação."}
                      </p>
                    </div>

                    {doc.sections.length > 0 && (
                      <div className="mt-3 grid gap-2 px-4 sm:grid-cols-3">
                        {doc.sections.map((secao) => {
                          const percentual = secao.total > 0 ? Math.round((secao.na / secao.total) * 100) : 0;
                          return (
                            <div
                              key={secao.key}
                              className="rounded-lg border border-glass-border/50 bg-glass/30 px-3 py-2"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-[11px] font-medium text-foreground">{secao.label}</p>
                                <p className="auditor-num shrink-0 text-[10px] text-muted-foreground">
                                  {secao.na}/{secao.total} N/A
                                </p>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    percentual === 100 ? "bg-destructive" : "bg-warning",
                                  )}
                                  style={{ width: `${percentual}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-glass-border/50 px-4 py-2">
                      <p className="truncate text-[10px] text-muted-foreground">
                        {doc.fileName} · {doc.pages} página(s)
                        {doc.auditor ? ` · ${doc.auditor}` : ""}
                        {doc.conceito ? ` · Conceito ${doc.conceito}` : ""}
                        {doc.importedAt ? ` · importado em ${dataBR(doc.importedAt)}` : ""}
                      </p>
                      {doc.items.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setAbertos((anteriores) => ({ ...anteriores, [doc.id]: !aberto }))}
                        >
                          {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {aberto ? "Ocultar etapas" : `Ver ${etapasNa.length} etapa(s) em N/A`}
                        </Button>
                      )}
                    </div>

                    {aberto && (
                      <div className="space-y-1 border-t border-glass-border/50 px-4 py-3">
                        {doc.items.map((item) => (
                          <div
                            key={`${item.code}-${item.page}`}
                            className="flex items-start gap-2 rounded-md px-1 py-0.5 text-[11px]"
                          >
                            <span className="auditor-num w-9 shrink-0 text-muted-foreground">{item.code}</span>
                            <span className="min-w-0 flex-1 text-foreground">{item.description}</span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                item.result === "N/A"
                                  ? "bg-destructive/10 text-destructive"
                                  : item.result === "Conforme"
                                    ? "bg-success/10 text-success"
                                    : item.result === "Não Conforme"
                                      ? "bg-warning/10 text-warning"
                                      : "bg-muted text-muted-foreground",
                              )}
                            >
                              {item.result || "sem leitura"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}

              {filtrados.length > visiveis.length && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    onClick={() => setLimite((atual) => atual + PAGINA)}
                  >
                    Mostrar mais ({filtrados.length - visiveis.length} restantes)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        O Sniper sinaliza, não conclui: a decisão continua sendo do analista. PDFs digitalizados sem camada de texto
        precisam de OCR no Analista BI antes de entrar aqui.
      </p>

      <Dialog
        open={migrarOpen}
        onOpenChange={(open) => {
          setMigrarOpen(open);
          if (!open) {
            setRemoverAposMigrar(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrar {selecionadas.length} documento(s)</DialogTitle>
            <DialogDescription>
              Os arquivos selecionados passam a existir na célula escolhida do Qualy Auditor. A tratativa é
              reaproveitada quando a FV/OS já existe e criada quando ainda não existe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block text-[11px] text-muted-foreground">
              Célula de destino
              <Select value={destino} onValueChange={(valor) => setDestino(valor as CellKey)}>
                <SelectTrigger className="mt-1 h-9 bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CELL_KEYS.map((key) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {CELLS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <p className="rounded-lg border border-glass-border/55 bg-glass/40 px-3 py-2 text-[11px] text-muted-foreground">
              Ciclo ativo aplicado à tratativa. {CELLS[destino].description}
            </p>

            {destino !== "nao_executado" && selecionadas.some((doc) => doc.naoExecutado) && (
              <p className="flex items-start gap-2 rounded-lg border border-chart-5/40 bg-chart-5/10 px-3 py-2 text-[11px] text-chart-5">
                <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {selecionadas.filter((doc) => doc.naoExecutado).length} documento(s) foram lidos como NÃO
                EXECUTADO. Migrar para N/A contraria essa classificação.
              </p>
            )}

            <label className="flex items-start gap-2 text-[11px] text-foreground">
              <Checkbox
                checked={removerAposMigrar}
                onCheckedChange={(valor) => setRemoverAposMigrar(valor === true)}
              />
              <span>Remover da base do Sniper depois de migrar (a tratativa na célula é mantida).</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMigrarOpen(false)} disabled={migrando}>
              Cancelar
            </Button>
            <Button type="button" variant="glow" onClick={() => void migrar()} disabled={migrando}>
              {migrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Migrar para {CELLS[destino].short}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={limpandoOpen}
        onOpenChange={(open) => {
          setLimpandoOpen(open);
          if (!open) {
            setCopiaBaixada(false);
            setPalavra("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar base do Sniper</DialogTitle>
            <DialogDescription>
              Apaga {totalBase} documento(s) da base própria do Sniper. As células do Qualy Auditor, o Analista BI e
              os relatórios não são afetados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-glass-border/60 bg-glass/30 p-3">
              <p className="text-xs font-medium text-foreground">1. Baixe uma cópia antes de apagar</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                O download libera a confirmação do passo 2 nesta sessão.
              </p>
              <Button
                type="button"
                size="sm"
                variant={copiaBaixada ? "secondary" : "glow"}
                className="mt-2"
                onClick={() => exportar(docs)}
              >
                {copiaBaixada ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {copiaBaixada ? "Cópia baixada" : "Baixar CSV do Sniper"}
              </Button>
            </div>

            <label className="block text-[11px] text-muted-foreground">
              2. Digite <strong className="text-foreground">APAGAR</strong> para liberar a exclusão
              <Input
                value={palavra}
                onChange={(event) => setPalavra(event.target.value)}
                placeholder="APAGAR"
                className="mt-0.5 h-8 text-xs"
                disabled={!copiaBaixada}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLimpandoOpen(false)} disabled={limpando}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!copiaBaixada || palavra.trim().toUpperCase() !== "APAGAR" || limpando}
              onClick={() => void limparBase()}
            >
              {limpando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              Apagar {totalBase} documento(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({
  label,
  valor,
  icon: Icon,
  className,
  rodape,
}: {
  label: string;
  valor: number;
  icon: typeof ScanLine;
  className?: string;
  rodape?: string;
}) {
  return (
    <Card className="auditor-tile rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn("h-3.5 w-3.5", className)} />
      </div>
      <p className={cn("auditor-num mt-0.5 text-2xl font-semibold", className)}>{valor}</p>
      {rodape && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{rodape}</p>}
    </Card>
  );
}

function Chip({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-glass-border/55 bg-glass/40 px-2 py-0.5 text-[10px]">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <span className="auditor-num text-foreground">{valor}</span>
    </span>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        destaque ? "border-primary/30 bg-primary/5" : "border-glass-border/50 bg-glass/30",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 text-[11px] font-medium text-foreground">{valor || "Não informado no documento"}</p>
    </div>
  );
}
