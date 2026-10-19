import { Copy, FileStack, FolderOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTimeBR } from "@/lib/fields";
import { countFilledPhotos, draftLabel, type ReportDraft } from "@/lib/report-document";
import { getTemplate } from "@/lib/report-templates";

interface DraftsListProps {
  drafts: ReportDraft[];
  currentId: string | null;
  onOpen: (draft: ReportDraft) => void;
  onDuplicate: (draft: ReportDraft) => void;
  onDelete: (draftId: string) => void;
}

export function DraftsList({ drafts, currentId, onOpen, onDuplicate, onDelete }: DraftsListProps) {
  return (
    <Card className="border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Relatórios salvos</h2>
          <p className="text-xs text-muted-foreground">
            Rascunhos guardados neste navegador, com fotos e cabeçalho.
          </p>
        </div>
        <Badge variant="outline" className="border-border">
          {drafts.length}
        </Badge>
      </div>

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
          <FileStack className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum relatório salvo ainda. Use "Salvar rascunho" para guardar o trabalho.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {drafts.map((draft) => {
            const template = getTemplate(draft.templateId);
            return (
              <li
                key={draft.id}
                className={
                  draft.id === currentId
                    ? "rounded-lg border border-primary bg-accent/60 p-3"
                    : "rounded-lg border border-border p-3 transition-smooth hover:border-primary/50"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {draftLabel(draft.templateId, draft.values)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {template.shortTitle} • {countFilledPhotos(draft.templateId, draft.photos)} foto(s) •{" "}
                      {formatDateTimeBR(draft.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(draft)}>
                      <FolderOpen className="h-4 w-4" />
                      Abrir
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Duplicar relatório"
                      onClick={() => onDuplicate(draft)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir relatório"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(draft.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
