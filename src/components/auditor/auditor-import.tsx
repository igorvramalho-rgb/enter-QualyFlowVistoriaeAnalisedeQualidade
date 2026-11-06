import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  AUDITOR_FIELDS,
  extractAuditorDocument,
  type AuditorExtraction,
  type AuditorItem,
} from "@/lib/auditor-pdf";
import {
  confirmAuditorDocument,
  findDocumentByFingerprint,
  type ExistingDocument,
} from "@/lib/auditor-save";

const LEVEL_STYLE: Record<string, string> = {
  divergencia: "border-destructive/50 bg-destructive/10 text-foreground",
  atencao: "border-warning/50 bg-warning/10 text-foreground",
  informacao: "border-border/60 bg-muted/40 text-muted-foreground",
};

/**
 * Importação manual do FV: leitura assistida, conferência humana e confirmação.
 * Nada é gravado antes do clique em "Confirmar cadastro".
 */
export function AuditorImport({ onSaved }: { onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [ocr, setOcr] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<AuditorExtraction | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [items, setItems] = useState<AuditorItem[]>([]);
  const [duplicate, setDuplicate] = useState<ExistingDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  const reset = useCallback(() => {
    setFile(null);
    setExtraction(null);
    setFields({});
    setItems([]);
    setDuplicate(null);
    setStep("");
    setOpen(false);
    if (url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
  }, [url]);

  const handleFile = useCallback(
    async (selected: File) => {
      if (!/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") {
        toast.error("Selecione um arquivo PDF do formulário de verificação.");
        return;
      }

      setBusy(true);
      setStep("Lendo o PDF...");
      try {
        const result = await extractAuditorDocument(selected, {
          ocr,
          onProgress: (page, total) => setStep(`Lendo página ${page} de ${total}...`),
          onOcrProgress: (stage, page, total) => setStep(`OCR (${stage}) ${page}/${total}...`),
        });

        const existing = await findDocumentByFingerprint(result.fingerprint);

        setFile(selected);
        setExtraction(result);
        setFields(
          Object.fromEntries(AUDITOR_FIELDS.map(({ key }) => [key, result.fields[key].value])),
        );
        setItems(result.items);
        setDuplicate(existing);
        setUrl(URL.createObjectURL(selected));
        setStep("");
        setOpen(true);
      } catch (problem) {
        toast.error("Não foi possível ler o documento", {
          description: problem instanceof Error ? problem.message : undefined,
        });
        setStep("");
      } finally {
        setBusy(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [ocr],
  );

  const confirm = async () => {
    if (!file || !extraction) {
      return;
    }
    setBusy(true);
    setStep("Gravando documento...");
    try {
      const result = await confirmAuditorDocument({ extraction, file, fields, items });
      toast.success("Documento recebido", {
        description: result.caseId
          ? "FV/OS registrada e aguardando análise."
          : "Documento registrado sem FV/OS identificada.",
      });
      reset();
      onSaved();
    } catch (problem) {
      toast.error("Não foi possível gravar o documento", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  const openPage = (page: number | null) => {
    if (!url) {
      return;
    }
    window.open(page ? `${url}#page=${page}` : url, "_blank", "noopener");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              void handleFile(selected);
            }
          }}
        />
        <Button
          type="button"
          variant="glow"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Importar PDF
        </Button>

        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Switch checked={ocr} onCheckedChange={setOcr} />
          Usar OCR se o PDF não tiver texto
        </label>

        {step && <span className="text-[11px] text-muted-foreground">{step}</span>}
      </div>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : reset())}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Revisar leitura do FV</DialogTitle>
            <DialogDescription>
              Confira os dados antes de cadastrar. A classificação original da AlphaGeos não pode
              ser alterada — a conclusão técnica é sempre humana.
            </DialogDescription>
          </DialogHeader>

          {extraction && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border/60 px-2 py-0.5">
                  {extraction.fileName}
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5">
                  {extraction.pages} página(s)
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5">
                  {extraction.usedOcr ? "texto + OCR" : extraction.textAvailable ? "texto" : "sem texto"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => openPage(null)}
                >
                  Abrir PDF original
                </Button>
              </div>

              {duplicate && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] text-foreground">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Este arquivo já foi importado em{" "}
                    {new Date(duplicate.importedAt).toLocaleString("pt-BR")} como{" "}
                    <strong>{duplicate.fileName}</strong>. O cadastro está bloqueado para evitar
                    duplicidade.
                  </p>
                </div>
              )}

              {extraction.divergences.length > 0 && (
                <ul className="space-y-1">
                  {extraction.divergences.map((item) => (
                    <li
                      key={item.message}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-[11px] ${LEVEL_STYLE[item.level]}`}
                    >
                      {item.level === "informacao" ? (
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      )}
                      <span>{item.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {AUDITOR_FIELDS.map(({ key, label }) => (
                  <label key={key} className="text-[11px] text-muted-foreground">
                    <span className="flex items-center justify-between gap-2">
                      {label}
                      {extraction.fields[key].page && (
                        <button
                          type="button"
                          className="text-[10px] text-primary underline-offset-2 hover:underline"
                          onClick={() => openPage(extraction.fields[key].page)}
                        >
                          p. {extraction.fields[key].page}
                        </button>
                      )}
                    </span>
                    <Input
                      value={fields[key] ?? ""}
                      onChange={(event) =>
                        setFields((previous) => ({ ...previous, [key]: event.target.value }))
                      }
                      className="mt-0.5 h-8 text-xs"
                    />
                  </label>
                ))}
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-foreground">
                  Etapas avaliadas ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                    Nenhuma etapa localizada automaticamente. Confira o PDF e registre a análise
                    manualmente na próxima etapa.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60">
                    <table className="w-full border-collapse text-[11px]">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">Item</th>
                          <th className="px-2 py-1.5 font-medium">Descritivo</th>
                          <th className="px-2 py-1.5 font-medium">Classificação original</th>
                          <th className="px-2 py-1.5 font-medium">Pág.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.code} className="border-t border-border/40 align-top">
                            <td className="px-2 py-1.5 font-mono">{item.code}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{item.description}</td>
                            <td className="px-2 py-1.5 font-medium text-foreground">
                              {item.originalResult || "sem classificação"}
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                className="text-primary underline-offset-2 hover:underline"
                                onClick={() => openPage(item.page)}
                              >
                                p. {item.page}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {extraction.observations && (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Observações encontradas
                  </p>
                  <p className="mt-0.5 text-[11px] text-foreground">{extraction.observations}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={reset} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="glow"
              onClick={() => void confirm()}
              disabled={busy || Boolean(duplicate)}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
