import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { extractAuditorDocument, AUDITOR_FIELDS } from "@/lib/auditor-pdf";
import { confirmAuditorDocument, findDocumentByFingerprint } from "@/lib/auditor-save";
import { CELLS, type CellKey } from "@/lib/auditor";

/**
 * Importação manual direta na célula escolhida.
 * Não existe segunda etapa obrigatória: o documento é registrado na célula.
 * A extração pode ser corrigida depois, na tela da tratativa.
 */
export function AuditorImport({ cell, onSaved }: { cell: CellKey; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [ocr, setOcr] = useState(false);

  const handleFile = useCallback(
    async (selected: File) => {
      if (!/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") {
        toast.error("Selecione um arquivo PDF do formulário de verificação.");
        return;
      }

      setBusy(true);
      setStep("Lendo o PDF...");
      try {
        const extraction = await extractAuditorDocument(selected, {
          ocr,
          onProgress: (page, total) => setStep(`Lendo página ${page} de ${total}...`),
          onOcrProgress: (stage, page, total) => setStep(`OCR (${stage}) ${page}/${total}...`),
        });

        const duplicate = await findDocumentByFingerprint(extraction.fingerprint);
        if (duplicate) {
          toast.warning("Documento já importado", {
            description: `${duplicate.fileName} · ${new Date(duplicate.importedAt).toLocaleString("pt-BR")}. Nada foi duplicado.`,
          });
          return;
        }

        setStep("Gravando...");
        const fields = Object.fromEntries(
          AUDITOR_FIELDS.map(({ key }) => [key, extraction.fields[key].value]),
        );

        const result = await confirmAuditorDocument({
          extraction,
          file: selected,
          fields,
          items: extraction.items,
          cell,
        });

        if (!result.uploadOk) {
          toast.warning("Registrado com pendência de PDF", {
            description: result.uploadError,
          });
        } else {
          toast.success(`Registrado em ${CELLS[cell].label}`, {
            description: `${extraction.fields.fac.value || "sem FV"} · OS ${
              extraction.fields.os.value || "não informada"
            } · ${extraction.items.length} etapa(s)`,
          });
        }
        onSaved();
      } catch (problem) {
        toast.error("Não foi possível importar", {
          description: problem instanceof Error ? problem.message : undefined,
        });
      } finally {
        setBusy(false);
        setStep("");
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [cell, ocr, onSaved],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) void handleFile(selected);
        }}
      />
      <Button type="button" variant="glow" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        Importar PDF
      </Button>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Switch checked={ocr} onCheckedChange={setOcr} />
        OCR se não houver texto
      </label>
      {step && <span className="text-[11px] text-muted-foreground">{step}</span>}
    </div>
  );
}
