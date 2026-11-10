import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FileUp, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  getQueueState,
  startImport,
  stopImport,
  subscribeQueue,
} from "@/lib/auditor-queue";
import { CELLS, type CellKey } from "@/lib/auditor";
import type { BatchResult } from "@/lib/auditor-save";

/** Limite operacional por importação. */
const MAX_FILES = 420;

const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

/**
 * Importação manual em lote, direto na célula escolhida.
 * A fila vive fora do componente: sair da tela não reinicia o processo.
 */
export function AuditorImport({ cell, onSaved }: { cell: CellKey; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState(false);
  const estado = useSyncExternalStore(subscribeQueue, getQueueState, getQueueState);
  const ultimo = useRef<BatchResult | null>(null);

  useEffect(() => {
    if (!estado.result || estado.result === ultimo.current) {
      return;
    }
    ultimo.current = estado.result;

    const r = estado.result;
    const partes = [`${r.registrados} registrado(s)`];
    if (r.movidos) partes.push(`${r.movidos} movido(s) para esta célula`);
    if (r.duplicados) partes.push(`${r.duplicados} já existente(s)`);
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
        </div>
      )}
    </div>
  );
}
