import { FileText, Images } from "lucide-react";
import { Card } from "@/components/ui/card";
import { REPORT_TEMPLATES } from "@/lib/report-templates";
import { cn } from "@/lib/utils";

interface TemplatePickerProps {
  selectedId: string;
  onSelect: (templateId: string) => void;
}

export function TemplatePicker({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {REPORT_TEMPLATES.map((template) => {
        const isSelected = selectedId === template.id;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            aria-pressed={isSelected}
            className={cn(
              "animate-slide-up rounded-xl border p-4 text-left transition-smooth",
              isSelected
                ? "border-primary bg-accent shadow-elegant"
                : "border-border bg-card hover:border-primary/60 hover:bg-accent/40",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? "brand-gradient text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-foreground">{template.title}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{template.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Images className="h-3.5 w-3.5" />
                  {template.photoSlots.length} fotos vinculadas
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TemplatePickerCard({ selectedId, onSelect }: TemplatePickerProps) {
  return (
    <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">1. Modelo do relatório</h2>
        <p className="text-xs text-muted-foreground">
          Escolha o modelo que será preenchido. Os dados em comum são mantidos ao trocar de modelo.
        </p>
      </div>
      <TemplatePicker selectedId={selectedId} onSelect={onSelect} />
    </Card>
  );
}
