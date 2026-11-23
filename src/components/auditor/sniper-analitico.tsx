import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Crosshair,
  Download,
  Eraser,
  FileSearch,
  FileUp,
  Info,
  Loader2,
  MapPin,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  parseSniperDocument,
  SNIPER_MOTIVO_LABEL,
  SNIPER_ORDER,
  SNIPER_VERDICT_LABEL,
  type SniperDocument,
  type SniperVerdict,
} from "@/lib/sniper";

const MAX_FILES = 300;

type Filtro = "todos" | SniperVerdict;

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "tudo_na", label: "100% N/A" },
  { key: "na_parcial", label: "N/A parcial" },
  { key: "avaliado", label: "Avaliados" },
];

const VERDICT_CLASS: Record<SniperVerdict, string> = {
  tudo_na: "border-destructive/45 bg-destructive/10 text-destructive",
  na_parcial: "border-warning/45 bg-warning/10 text-warning",
  avaliado: "border-success/45 bg-success/10 text-success",
  sem_itens: "border-glass-border/60 bg-muted text-muted-foreground",
};

const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

/**
 * Sniper Analítico — varre os FVs importados e sinaliza os serviços em que
 * todas as etapas foram avaliadas como N/A, mostrando o serviço acatado e o
 * motivo que o próprio documento registra. Leitura 100% local (pdf.js).
 */
export function SniperAnalitico() {
  const [docs, setDocs] = useState<SniperDocument[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busy, setBusy] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number; arquivo: string } | null>(null);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const analisar = async (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }

    const arquivos = Array.from(list).filter(isPdf).slice(0, MAX_FILES);
    if (arquivos.length === 0) {
      toast.error("Selecione arquivos PDF", { description: "O Sniper lê apenas FVs em .pdf." });
      return;
    }

    setBusy(true);
    let semTexto = 0;
    let falhas = 0;
    const novos: SniperDocument[] = [];

    try {
      const { readPdfLayout } = await import("@/lib/pdf-extract");

      for (let index = 0; index < arquivos.length; index += 1) {
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
          novos.push(doc);
        } catch {
          falhas += 1;
        }
      }
    } finally {
      setBusy(false);
      setProgresso(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }

    if (novos.length === 0) {
      toast.error("Nenhum PDF foi lido", { description: "Os arquivos podem estar corrompidos ou protegidos." });
      return;
    }

    setDocs((anteriores) => {
      const nomes = new Set(novos.map((doc) => doc.fileName));
      return [...novos, ...anteriores.filter((doc) => !nomes.has(doc.fileName))];
    });

    const tudoNa = novos.filter((doc) => doc.verdict === "tudo_na").length;
    toast.success(
      tudoNa > 0 ? `${tudoNa} serviço(s) marcados como 100% N/A` : "Leitura concluída",
      {
        description: [
          `${novos.length} PDF(s) lidos`,
          tudoNa > 0 ? `${tudoNa} com todas as etapas em N/A` : null,
          semTexto > 0 ? `${semTexto} sem camada de texto` : null,
          falhas > 0 ? `${falhas} com falha` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    );
  };

  const ordenados = useMemo(
    () =>
      [...docs].sort(
        (a, b) => SNIPER_ORDER[a.verdict] - SNIPER_ORDER[b.verdict] || a.fileName.localeCompare(b.fileName, "pt-BR"),
      ),
    [docs],
  );

  const contagem = useMemo(() => {
    const base: Record<SniperVerdict, number> = { tudo_na: 0, na_parcial: 0, avaliado: 0, sem_itens: 0 };
    docs.forEach((doc) => {
      base[doc.verdict] += 1;
    });
    return base;
  }, [docs]);

  const visiveis = filtro === "todos" ? ordenados : ordenados.filter((doc) => doc.verdict === filtro);

  const exportar = () => {
    const alvos = ordenados.filter((doc) => doc.verdict === "tudo_na" || doc.verdict === "na_parcial");
    if (alvos.length === 0) {
      toast.info("Nada para exportar", { description: "Nenhum documento com etapa N/A foi localizado." });
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
        doc.fileName,
      ]),
    );

    toast.success("Planilha gerada", { description: `${alvos.length} documento(s) com N/A.` });
  };

  const limpar = () => {
    setDocs([]);
    setAbertos({});
    setFiltro("todos");
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
              <h2 className="text-sm font-semibold text-foreground">Sniper Analítico</h2>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                Localiza os serviços em que <strong className="text-foreground">todas as etapas</strong> do FV
                importado estão em N/A. Cada documento é lido no seu navegador, sem gastar créditos, e o cartão
                mostra o serviço executado, o serviço acatado e o motivo registrado no próprio PDF.
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
            {docs.length > 0 && (
              <>
                <Button type="button" variant="glass" size="sm" onClick={exportar} disabled={busy}>
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={limpar} disabled={busy}>
                  <Eraser className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              </>
            )}
            <Button type="button" variant="glow" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {busy ? "Analisando..." : "Selecionar PDFs"}
            </Button>
          </div>
        </div>

        {progresso && (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Lendo {progresso.feito}/{progresso.total} — {progresso.arquivo}
          </p>
        )}
      </Card>

      {docs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed border-glass-border/60 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileSearch className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nenhum documento varrido</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Selecione os FVs (por exemplo, o FV-23282-2619857339) para o Sniper apontar os serviços com
              avaliação inteira em N/A e o motivo declarado.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo
              label="Documentos lidos"
              valor={docs.length}
              icon={ScanLine}
              className="text-foreground"
              rodape={`${docs.reduce((soma, doc) => soma + doc.total, 0)} etapas lidas`}
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

          <div className="flex flex-wrap items-center gap-1.5">
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
                  onClick={() => setFiltro(item.key)}
                >
                  {item.label}
                  <span className={cn("auditor-num text-[10px]", ativo ? "opacity-80" : "text-muted-foreground")}>
                    {total}
                  </span>
                </Button>
              );
            })}
          </div>

          {visiveis.length === 0 ? (
            <Card className="px-4 py-8 text-center text-xs text-muted-foreground">
              Nenhum documento neste filtro.
            </Card>
          ) : (
            <div className="space-y-3">
              {visiveis.map((doc) => {
                const aberto = Boolean(abertos[doc.fileName]);
                const naAbertos = doc.items.filter((item) => item.result === "N/A" || item.result === "");
                return (
                  <Card
                    key={doc.fileName}
                    className={cn(
                      "overflow-hidden p-0",
                      doc.verdict === "tudo_na" && "border-destructive/50",
                      doc.verdict === "na_parcial" && "border-warning/45",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                            doc.verdict === "tudo_na"
                              ? "bg-destructive/10 text-destructive ring-destructive/30"
                              : doc.verdict === "na_parcial"
                                ? "bg-warning/10 text-warning ring-warning/30"
                                : "bg-muted text-muted-foreground ring-glass-border/50",
                          )}
                        >
                          {doc.verdict === "tudo_na" ? (
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
                        {doc.semResultado > 0 && (
                          <span className="rounded-full border border-glass-border/55 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {doc.semResultado} sem leitura
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
                      </p>
                      {doc.items.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() =>
                            setAbertos((anteriores) => ({ ...anteriores, [doc.fileName]: !aberto }))
                          }
                        >
                          {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {aberto ? "Ocultar etapas" : `Ver ${naAbertos.length} etapa(s) em N/A`}
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
            </div>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        O Sniper sinaliza, não conclui: a decisão continua sendo do analista. PDFs digitalizados sem camada de
        texto precisam de OCR no Analista BI antes de entrar aqui.
      </p>
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
