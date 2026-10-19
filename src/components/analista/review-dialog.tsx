import { useEffect, useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANALYSIS_FIELDS,
  CONFIDENCE_LABELS,
  DOCUMENT_TYPE_LABELS,
  STATUS_LABELS,
  type AnalysisRecord,
  type Confidence,
  type DocumentType,
  type QualityStatus,
} from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface ReviewDialogProps {
  record: AnalysisRecord | null;
  onOpenChange: (open: boolean) => void;
  onSave: (record: AnalysisRecord) => void;
}

const CONFIDENCE_VARIANTS: Record<Confidence, string> = {
  alta: "bg-success/15 text-success border-success/40",
  media: "bg-warning/15 text-warning border-warning/40",
  baixa: "bg-muted text-muted-foreground border-border",
  nenhuma: "bg-destructive/10 text-destructive border-destructive/40",
};

export function ReviewDialog({ record, onOpenChange, onSave }: ReviewDialogProps) {
  const [draft, setDraft] = useState<AnalysisRecord | null>(record);

  useEffect(() => {
    setDraft(record);
  }, [record]);

  const open = Boolean(record);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(94vw,900px)] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-base">Revisão dos dados extraídos</DialogTitle>
          <DialogDescription className="text-xs">
            {record?.fileName} • {record?.pages} página(s) • confiança indicada em cada campo. Ajuste o
            que estiver incorreto e salve para alimentar os indicadores.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="grid max-h-[68vh] gap-5 overflow-hidden px-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <ScrollArea className="max-h-[62vh] pr-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {ANALYSIS_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`analise-${field.key}`} className="text-xs text-muted-foreground">
                        {field.label}
                      </Label>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border px-1.5 py-0 text-[10px] font-medium",
                          CONFIDENCE_VARIANTS[draft.confidence[field.key] ?? "nenhuma"],
                        )}
                      >
                        {CONFIDENCE_LABELS[draft.confidence[field.key] ?? "nenhuma"]}
                      </Badge>
                    </div>
                    <Input
                      id={`analise-${field.key}`}
                      value={draft.fields[field.key] ?? ""}
                      onChange={(event) =>
                        setDraft((previous) =>
                          previous
                            ? {
                                ...previous,
                                fields: { ...previous.fields, [field.key]: event.target.value },
                                confidence: { ...previous.confidence, [field.key]: "alta" },
                              }
                            : previous,
                        )
                      }
                      className="bg-background"
                    />
                  </div>
                ))}

                <div className="space-y-1.5">
                  <Label htmlFor="analise-tipo" className="text-xs text-muted-foreground">
                    Tipo de relatório
                  </Label>
                  <Select
                    value={draft.documentType}
                    onValueChange={(value) =>
                      setDraft((previous) =>
                        previous ? { ...previous, documentType: value as DocumentType } : previous,
                      )
                    }
                  >
                    <SelectTrigger id="analise-tipo" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="analise-status" className="text-xs text-muted-foreground">
                    Status da vistoria
                  </Label>
                  <Select
                    value={draft.status}
                    onValueChange={(value) =>
                      setDraft((previous) =>
                        previous ? { ...previous, status: value as QualityStatus } : previous,
                      )
                    }
                  >
                    <SelectTrigger id="analise-status" className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Texto lido do arquivo</p>
              <ScrollArea className="h-[52vh] rounded-lg border border-border bg-muted/40 p-3">
                <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-muted-foreground">
                  {draft.snippet || "Nenhum texto legível encontrado (PDF digitalizado)."}
                </pre>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (draft) {
                onSave({ ...draft, reviewed: true });
              }
              onOpenChange(false);
            }}
          >
            {draft?.reviewed ? <Save className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
            Salvar dados revisados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
