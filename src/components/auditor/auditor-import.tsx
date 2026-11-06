import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { extractAuditorDocument, AUDITOR_FIELDS } from "@/lib/auditor-pdf";
import {
  confirmAuditorDocument,
  fetchAllFingerprints,
} from "@/lib/auditor-save";
import { CELLS, type CellKey } from "@/lib/auditor";

/** Limite operacional por importação. */
const MAX_FILES = 400;

const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";

/**
 * Importação manual em lote, diretamente na célula escolhida.
 * Cada arquivo é registrado individualmente; duplicados e falhas não interrompem
 * o lote. Não há segunda etapa obrigatória de aprovação.
 */
export function AuditorImport({ cell, onSaved }: { cell: CellKey; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;

      const todos = Array.from(list);
      const pdfs = todos.filter(isPdf);
      const ignorados = todos.length - pdfs.length;
      const arquivos = pdfs.slice(0, MAX_FILES);
      const excedentes = pdfs.length - arquivos.length;

      if (arquivos.length === 0) {
        toast.error("Nenhum PDF selecionado", {
          description: "A importação aceita apenas arquivos .pdf.",
        });
        return;
      }

      setBusy(true);
      cancelRef.current = false;
      let ok = 0;
      let pendentes = 0;
      let duplicados = 0;
      let falhas = 0;
      let primeiroErro = "";

      try {
        const existentes = await fetchAllFingerprints();
        const vistos = new Set(existentes);

        for (let index = 0; index < arquivos.length; index += 1) {
          if (cancelRef.current) break;
          const file = arquivos[index];
          setProgress({ done: index, total: arquivos.length, name: file.name });

          try {
            const extraction = await extractAuditorDocument(file, { ocr });

            if (vistos.has(extraction.fingerprint)) {
              duplicados += 1;
              continue;
            }
            vistos.add(extraction.fingerprint);

            const result = await confirmAuditorDocument({
              extraction,
              file,
              fields: Object.fromEntries(
                AUDITOR_FIELDS.map(({ key }) => [key, extraction.fields[key].value]),
              ),
              items: extraction.items,
              cell,
            });

            ok += 1;
            if (!result.uploadOk) pendentes += 1;
          } catch (problem) {
            falhas += 1;
            if (!primeiroErro) {
              primeiroErro = `${file.name}: ${
                problem instanceof Error ? problem.message : "erro desconhecido"
              }`;
            }
          }
        }

        setProgress({ done: arquivos.length, total: arquivos.length, name: "" });

        const partes = [`${ok} registrado(s)`];
        if (duplicados) partes.push(`${duplicados} já existente(s)`);
        if (pendentes) partes.push(`${pendentes} com PDF pendente`);
        if (falhas) partes.push(`${falhas} falha(s)`);
        if (ignorados) partes.push(`${ignorados} ignorado(s) (não PDF)`);
        if (excedentes) partes.push(`${excedentes} acima do limite de ${MAX_FILES}`);

        const descricao = primeiroErro ? `${partes.join(" · ")} — ${primeiroErro}` : partes.join(" · ");

        if (ok > 0) {
          toast.success(`Importação em ${CELLS[cell].label}`, { description: descricao });
        } else {
          toast.warning("Nenhum documento novo foi registrado", { description: descricao });
        }

        onSaved();
      } finally {
        setBusy(false);
        setProgress(null);
        cancelRef.current = false;
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [cell, ocr, onSaved],
  );

  const percentual = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="glow"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Importar PDFs
        </Button>

        {busy && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            <StopCircle className="h-3.5 w-3.5" />
            Parar
          </Button>
        )}

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch checked={ocr} onCheckedChange={setOcr} disabled={busy} />
          OCR se não houver texto
        </label>

        <span className="text-[11px] text-muted-foreground">até {MAX_FILES} arquivos por vez</span>
      </div>

      {progress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate">
              {progress.name || "concluído"} · {progress.done}/{progress.total}
            </span>
            <span>{percentual}%</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percentual}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
