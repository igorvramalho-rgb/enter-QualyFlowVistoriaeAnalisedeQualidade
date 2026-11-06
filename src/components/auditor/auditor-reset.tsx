import { useCallback, useState } from "react";
import { DatabaseZap, Loader2, RefreshCw } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import {
  clearAuditorCell,
  clearAuditorDatabase,
  fetchAuditorTotals,
  fetchCellTotal,
} from "@/lib/auditor-reset";
import { CELLS, invalidateAuditorCache, type CellKey } from "@/lib/auditor";

/**
 * Limpeza controlada do banco do Qualy Auditor.
 * Sem `cell`, limpa tudo do módulo. Com `cell`, apaga só aquela célula.
 * Restrito ao gestor e com confirmação digitada.
 */
export function AuditorReset({ cell, onCleared }: { cell?: CellKey; onCleared?: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [linhas, setLinhas] = useState<[string, number][] | null>(null);
  const [palavra, setPalavra] = useState("");
  const [busy, setBusy] = useState(false);

  const abrir = useCallback(async () => {
    setOpen(true);
    setPalavra("");
    setLinhas(null);
    try {
      if (cell) {
        const total = await fetchCellTotal(cell);
        setLinhas([["FV/OS nesta célula", total]]);
      } else {
        const totais = await fetchAuditorTotals();
        setLinhas([
          ["FV/OS (tratativas)", totais.cases],
          ["Documentos", totais.documents],
          ["Etapas avaliadas", totais.items],
          ["Movimentações", totais.events],
          ["Controle de refazer", totais.redo],
          ["Relatórios", totais.reports],
        ]);
      }
    } catch (problem) {
      toast.error("Não foi possível contar os registros", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    }
  }, [cell]);

  const confirmar = async () => {
    setBusy(true);
    try {
      if (cell) {
        const apagados = await clearAuditorCell(cell);
        toast.success(`Célula ${CELLS[cell].label} limpa`, {
          description: `${apagados} FV/OS removida(s). As demais células não foram afetadas.`,
        });
      } else {
        await clearAuditorDatabase();
        toast.success("Banco do Qualy Auditor limpo", {
          description: "Os PDFs permanecem no armazenamento privado (sem política de exclusão).",
        });
      }
      invalidateAuditorCache();
      setOpen(false);
      onCleared?.();
    } catch (problem) {
      toast.error("Não foi possível limpar", {
        description:
          problem instanceof Error
            ? problem.message
            : "Verifique se o seu perfil tem permissão de gestor.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (profile?.role !== "gestor") {
    return null;
  }

  return (
    <>
      <Button type="button" variant="glass" size="sm" onClick={() => void abrir()}>
        <DatabaseZap className="h-3.5 w-3.5" />
        {cell ? "Limpar célula" : "Limpar banco"}
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : setOpen(false))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {cell ? `Limpar ${CELLS[cell].label}` : "Limpar banco do Qualy Auditor"}
            </DialogTitle>
            <DialogDescription>
              {cell
                ? "Apaga as FV/OS desta célula, com etapas, movimentações, refazer e relatórios vinculados. As outras células não são afetadas."
                : "Apaga todos os registros do Qualy Auditor. Analista, Emissor e configurações não são afetados."}{" "}
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {!linhas ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Contando registros...
            </div>
          ) : (
            <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px]">
              {linhas.map(([label, valor]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <strong>{valor}</strong>
                </li>
              ))}
            </ul>
          )}

          <label className="block text-[11px] text-muted-foreground">
            Digite <strong className="text-foreground">APAGAR</strong> para liberar
            <Input
              value={palavra}
              onChange={(event) => setPalavra(event.target.value)}
              placeholder="APAGAR"
              className="mt-0.5 h-8 text-xs"
            />
          </label>

          <p className="text-[10px] text-muted-foreground">
            Os PDFs já enviados permanecem no armazenamento privado — o aplicativo não tem permissão
            para excluir arquivos.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || palavra.trim().toUpperCase() !== "APAGAR"}
              onClick={() => void confirmar()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Apagar registros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
