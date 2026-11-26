import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Download, FileUp, FileWarning, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  getQueueState,
  startImport,
  stopImport,
  subscribeQueue,
} from "@/lib/auditor-queue";
import { CELLS, type CellKey } from "@/lib/auditor";
import { downloadCsv } from "@/lib/csv";
import type { BatchResult } from "@/lib/auditor-save";

/** Limite operacional por importação. */
const MAX_FILES = 1000;

const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

/**
 * Importação manual em lote, direto na célula escolhida.
 * A fila vive fora do componente: sair da tela não reinicia o processo.
 */
export function AuditorImport({ cell, onSaved }: { cell: CellKey; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState(false);
  const [abrirFalhas, setAbrirFalhas] = useState(false);
  const estado = useSyncExternalStore(subscribeQueue, getQueueState, getQueueState);
  const ultimo = useRef<BatchResult | null>(null);

  useEffect(() => {
    if (!estado.result || estado.result === ultimo.current) {
      return;
    }
    ultimo.current = estado.result;

    const r = estado.result;
    const partes = [`${r.registrados} registrado(s)`];
    if (r.duplicados) partes.push(`${r.duplicados} duplicado(s) — ver aba Duplicados`);
    if (r.pendentes) partes.push(`${r.pendentes} com PDF pendente`);
    if (r.falhas) partes.push(`${r.falhas} falha(s)`);
    const descricao = r.primeiroErro ? `${partes.join(" · ")} — ${r.primeiroErro}` : partes.join(" · ");

    if (r.registrados > 0 || r.movidos > 0) {
      toast.success("Importação concluída", { description: descricao });
    } else {
      toast.warning("Nenhum documento novo foi registrado", { description: descricao });
    }
    onSaved();
  }, [estado.result, onSaved]);

  useEffect(() => {
    if (estado.error) {
      toast.error("Falha na importação", { description: estado.error });
    }
  }, [estado.error]);

  // Lote grande (até 1000 PDFs): evita perder o progresso por um F5 acidental.
  useEffect(() => {
    if (!estado.running) {
      return;
    }
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      evento.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado.running]);

  const enviar = async (list: FileList | null) => {
    if (!list || list.length === 0) return;

    const todos = Array.from(list);
    const pdfs = todos.filter(isPdf);
    const ignorados = todos.length - pdfs.length;
    const arquivos = pdfs.slice(0, MAX_FILES);
    const excedentes = pdfs.length - arquivos.length;

    if (arquivos.length === 0) {
      toast.error("Nenhum PDF selecionado", { description: "A importação aceita apenas .pdf." });
      return;
    }
    if (ignorados > 0 || excedentes > 0) {
      toast.info("Seleção ajustada", {
        description: `${arquivos.length} PDF(s) na fila${ignorados ? ` · ${ignorados} ignorado(s)` : ""}${
          excedentes ? ` · ${excedentes} acima do limite de ${MAX_FILES}` : ""
        }`,
      });
    }

    await startImport(arquivos, cell, ocr);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const percentual = estado.total > 0 ? Math.round((estado.done / estado.total) * 100) : 0;
  const nestaCelula = estado.running && estado.cell === cell;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          disabled={estado.running}
          onChange={(event) => void enviar(event.target.files)}
        />
        <Button
          type="button"
          variant="glow"
          size="sm"
          disabled={estado.running}
          onClick={() => inputRef.current?.click()}
        >
          {estado.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          {estado.running ? "Importando..." : "Importar PDFs"}
        </Button>

        {estado.running && (
          <Button type="button" variant="outline" size="sm" onClick={stopImport}>
            <StopCircle className="h-3.5 w-3.5" />
            Parar
          </Button>
        )}

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch checked={ocr} onCheckedChange={setOcr} disabled={estado.running} />
          OCR se não houver texto
        </label>

        <span className="text-[11px] text-muted-foreground">até {MAX_FILES} arquivos</span>
      </div>

      {estado.running && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate">
              {nestaCelula ? "nesta célula" : `em ${estado.cell ? CELLS[estado.cell].label : "outra célula"}`} ·{" "}
              {estado.name || "preparando"} · {estado.done}/{estado.total}
            </span>
            <span>{percentual}%</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentual}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Falhas de rede são repetidas automaticamente. Mantenha esta aba aberta até concluir.
          </p>
        </div>
      )}

      {!estado.running && estado.result && (
        <Card className="mt-2 space-y-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Última importação</p>
                <p className="text-[11px] text-muted-foreground">
                  {[
                    `${estado.result.registrados} novo(s)`,
                    estado.result.duplicados > 0 ? `${estado.result.duplicados} duplicado(s) — ver aba Duplicados` : null,
                    estado.result.pendentes > 0 ? `${estado.result.pendentes} com PDF pendente` : null,
                    estado.result.falhas > 0 ? `${estado.result.falhas} com falha` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {estado.result.duplicados > 0 && (
                <Button asChild size="sm" variant="glass">
                  <Link to="/auditor/duplicados">Ver aba Duplicados</Link>
                </Button>
              )}
              {estado.result.falhasDetalhe.length > 0 && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="glass"
                    onClick={() =>
                      downloadCsv(
                        `falhas-importacao-${new Date().toISOString().slice(0, 10)}.csv`,
                        ["Arquivo", "Motivo"],
                        estado.result!.falhasDetalhe.map((item) => [item.fileName, item.error]),
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Falhas (CSV)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAbrirFalhas((anterior) => !anterior)}
                  >
                    {abrirFalhas ? "Ocultar motivos" : "Ver motivos"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {abrirFalhas && estado.result.falhasDetalhe.length > 0 && (
            <ul className="max-h-44 space-y-1 overflow-auto rounded-md border border-glass-border/50 bg-glass/30 p-2 text-[11px]">
              {estado.result.falhasDetalhe.map((item) => (
                <li key={`${item.fileName}-${item.error.slice(0, 20)}`} className="flex gap-1">
                  <span className="font-medium text-foreground">{item.fileName}</span>
                  <span className="text-muted-foreground">— {item.error}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
