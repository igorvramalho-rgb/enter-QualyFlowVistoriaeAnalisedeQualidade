import { AlertTriangle, ClipboardList, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { POLOS, type AnalysisRecord } from "@/lib/analysis";
import { normalizeNcType } from "@/lib/analysis";
import { comparePolo } from "@/lib/analysis";
import { cn } from "@/lib/utils";

interface NcPanelProps {
  analyses: AnalysisRecord[];
  onReview: (record: AnalysisRecord) => void;
}

/**
 * Especifica as não conformidades da base: motivo, polo, data e arquivo de
 * origem, agrupados por polo para leitura rápida.
 */
export function NcPanel({ analyses, onReview }: NcPanelProps) {
  const nonConforming = analyses.filter((item) => item.status === "nao_conforme");

  const groups = new Map<string, AnalysisRecord[]>();
  nonConforming.forEach((record) => {
    const polo = record.fields.polo?.trim() || "Não informado";
    groups.set(polo, [...(groups.get(polo) ?? []), record]);
  });

  const orderedGroups = Array.from(groups.entries()).sort((a, b) => comparePolo(a[0], b[0]));
  const semMotivo = nonConforming.filter((record) => !normalizeNcType(record.fields.tipoNaoConformidade)).length;

  return (
    <Card className="overflow-hidden">
      <span className="tech-strip absolute inset-x-0 top-0" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border/40 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4 text-primary" />
            Não conformidades identificadas
          </h2>
          <p className="text-xs text-muted-foreground">
            {nonConforming.length} vistoria(s) com não conformidade
            {semMotivo > 0 ? ` • ${semMotivo} sem motivo informado no PDF` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {POLOS.map((polo) => (
            <Badge key={polo} variant="outline" className="border-border text-[11px] font-normal">
              {polo}: {groups.get(polo)?.length ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      {nonConforming.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma não conformidade registrada na base. As vistorias "não avaliadas" (N/A) não entram
          aqui.
        </div>
      ) : (
        <div className="divide-y divide-glass-border/30">
          {orderedGroups.map(([polo, records]) => (
            <div key={polo} className="px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Polo {polo} • {records.length} não conformidade(s)
              </p>

              <ul className="space-y-2">
                {records.map((record) => {
                  const motivo = record.fields.tipoNaoConformidade?.trim();
                  const semMotivoNoRegistro = !motivo;

                  return (
                    <li
                      key={record.id}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-glass-border/40 bg-glass/30 p-3"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          semMotivoNoRegistro
                            ? "bg-warning/15 text-warning"
                            : "bg-destructive/12 text-destructive",
                        )}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {motivo || "Motivo não informado no PDF"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={record.fileName}>
                          {record.fields.os ? `OS ${record.fields.os} • ` : ""}
                          {record.fields.endereco || record.fileName}
                          {record.fields.data ? ` • ${record.fields.data}` : ""}
                        </p>
                      </div>

                      <Button type="button" variant="glass" size="sm" onClick={() => onReview(record)}>
                        <Pencil className="h-4 w-4" />
                        Especificar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
