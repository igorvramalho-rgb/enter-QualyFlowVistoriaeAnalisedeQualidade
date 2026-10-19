import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ReportValues } from "@/lib/report-document";
import type { ReportTemplate } from "@/lib/report-templates";
import { cn } from "@/lib/utils";

interface ReportFormProps {
  template: ReportTemplate;
  values: ReportValues;
  onValueChange: (fieldId: string, value: string) => void;
  objeto: string;
  onObjetoChange: (value: string) => void;
}

export function ReportForm({
  template,
  values,
  onValueChange,
  objeto,
  onObjetoChange,
}: ReportFormProps) {
  return (
    <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">2. Dados de cabeçalho</h2>
        <p className="text-xs text-muted-foreground">
          Os dados abaixo são impressos exatamente nos campos do modelo {template.title}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {template.fields.map((field) => {
          const inputId = `campo-${field.id}`;
          return (
            <div key={field.id} className={cn("space-y-1.5", field.wide && "sm:col-span-2")}>
              <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
                {field.label}
              </Label>

              {field.type === "select" ? (
                <Select
                  value={values[field.id] || undefined}
                  onValueChange={(value) => onValueChange(field.id, value)}
                >
                  <SelectTrigger id={inputId} className="bg-background">
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={inputId}
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => onValueChange(field.id, event.target.value)}
                  className="bg-background"
                />
              )}
            </div>
          );
        })}
      </div>

      {template.layout === "pos60" && (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="campo-objeto" className="text-xs font-medium text-muted-foreground">
            Objeto do relatório (texto impresso acima da tabela)
          </Label>
          <Textarea
            id="campo-objeto"
            rows={5}
            value={objeto}
            onChange={(event) => onObjetoChange(event.target.value)}
            className="bg-background text-sm leading-snug"
          />
        </div>
      )}
    </Card>
  );
}
