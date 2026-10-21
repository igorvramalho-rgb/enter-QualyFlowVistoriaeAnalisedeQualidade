import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  observacoes: string;
  onObservacoesChange: (value: string) => void;
}

const MAX_OBSERVACOES = 2000;

/** Mantém a digitação no formato dd/mm/aaaa. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

/** Converte datas antigas em ISO (aaaa-mm-dd) para o formato digitado. */
function toDisplayDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}

function todayBR(): string {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
}

export function ReportForm({
  template,
  values,
  onValueChange,
  objeto,
  onObjetoChange,
  observacoes,
  onObservacoesChange,
}: ReportFormProps) {
  return (
    <Card className="p-4">
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
                  <SelectTrigger id={inputId} className="bg-background/70">
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
              ) : field.type === "date" ? (
                <div className="flex items-center gap-2">
                  <Input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    value={toDisplayDate(values[field.id] ?? "")}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    onChange={(event) => onValueChange(field.id, maskDate(event.target.value))}
                    className="bg-background/70"
                  />
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    className="h-10 shrink-0"
                    title="Usar a data de hoje"
                    onClick={() => onValueChange(field.id, todayBR())}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Hoje
                  </Button>
                </div>
              ) : (
                <Input
                  id={inputId}
                  type="text"
                  value={values[field.id] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => onValueChange(field.id, event.target.value)}
                  className="bg-background/70"
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
            className="bg-background/70 text-sm leading-snug"
          />
        </div>
      )}

      <div className="mt-4 space-y-1.5 border-t border-glass-border/40 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="campo-observacoes" className="text-xs font-medium text-muted-foreground">
            Observações (impressa logo abaixo dos dados de cabeçalho)
          </Label>
          <span className="chip-tech font-mono text-[10px]">
            {observacoes.length}/{MAX_OBSERVACOES}
          </span>
        </div>
        <Textarea
          id="campo-observacoes"
          rows={6}
          maxLength={MAX_OBSERVACOES}
          className="min-h-[120px] resize-y bg-background/70 text-sm leading-snug"
          value={observacoes}
          placeholder="Ex.: acesso pelo portão lateral, obra liberada às 14h, pendência de sinalização provisória..."
          onChange={(event) => onObservacoesChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          O bloco de observações só aparece na folha quando há texto — caso contrário, o relatório
          permanece idêntico ao modelo oficial.
        </p>
      </div>
    </Card>
  );
}
