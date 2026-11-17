import { useCallback, useEffect, useState } from "react";
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
import { clearScope, fetchScopeTotal } from "@/lib/auditor-reset";
import { CELLS, CELL_KEYS, invalidateAuditorCache, type CellKey } from "@/lib/auditor";
import { useActiveCycle, useCycles } from "@/lib/cycles";

/**
 * Limpeza do Qualy Auditor com dois filtros independentes:
 * **ciclo** e **célula**. O operador escolhe exatamente o que apagar.
 */
export function AuditorReset({
  cell,
  onCleared,
  label,
}: {
  /** Célula pré-selecionada (quando aberto dentro de uma célula). */
  cell?: CellKey;
  onCleared?: () => void;
  label?: string;
}) {
  const { profile } = useAuth();
  const ciclos = useCycles();
  const cicloAtivo = useActiveCycle();

  const [open, setOpen] = useState(false);
  const [cicloSel, setCicloSel] = useState<string>("todos");
  const [celaSel, setCelaSel] = useState<string>(cell ?? "todas");
  const [total, setTotal] = useState<number | null>(null);
  const [palavra, setPalavra] = useState("");
  const [busy, setBusy] = useState(false);

  const escopo = useCallback(
    () => ({
      cycleId: cicloSel === "todos" ? null : cicloSel,
      cell: celaSel === "todas" ? null : (celaSel as CellKey),
    }),
    [cicloSel, celaSel],
  );

  const medir = useCallback(async () => {
    setTotal(null);
    try {
      setTotal(await fetchScopeTotal(escopo()));
    } catch {
      setTotal(null);
    }
  }, [escopo]);

  useEffect(() => {
    if (open) {
      void medir();
    }
  }, [open, medir]);

  const abrir = () => {
    setOpen(true);
    setPalavra("");
    setCicloSel(cicloAtivo ?? "todos");
    setCelaSel(cell ?? "todas");
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      const apagados = await clearScope(escopo());
      invalidateAuditorCache();
      toast.success("Limpeza concluída", {
        description: `${apagados} FV/OS removida(s).`,
      });
      setOpen(false);
      onCleared?.();
    } catch (error) {
      toast.error("Não foi possível limpar", {
        description:
          error instanceof Error
            ? error.message
            : "Verifique se o seu perfil tem permissão de gestor.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (profile?.role !== "gestor") {
    return null;
  }

  const tudoSelecionado = cicloSel === "todos" && celaSel === "todas";

  return (
    <>
      <Button type="button" variant="glass" size="sm" onClick={abrir}>
        <DatabaseZap className="h-3.5 w-3.5" />
        {label ?? "Limpar banco"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Limpar dados do Qualy Auditor</DialogTitle>
            <DialogDescription>
              Escolha o ciclo e a célula que deseja apagar. Você pode apagar só uma célula de um
              ciclo, só um ciclo inteiro, ou uma célula em todos os ciclos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-muted-foreground">
              Ciclo
              <select
                value={cicloSel}
                onChange={(event) => setCicloSel(event.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="todos">Todos os ciclos</option>
                {ciclos.map((ciclo) => (
                  <option key={ciclo.id} value={ciclo.id}>
                    {ciclo.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] text-muted-foreground">
              Célula
              <select
                value={celaSel}
                onChange={(event) => setCelaSel(event.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="todas">Todas as células</option>
                {CELL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {CELLS[key].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            className={`mt-2 rounded-lg border px-3 py-2 text-[11px] ${
              tudoSelecionado
                ? "border-destructive/60 bg-destructive/10"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            {total === null ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando registros…
              </span>
            ) : (
              <span className="flex justify-between">
                <span>
                  FV/OS que serão apagadas
                  {tudoSelecionado ? " (todo o banco do Auditor)" : ""}
                </span>
                <strong>{total}</strong>
              </span>
            )}
            {tudoSelecionado && total !== null && total > 0 && (
              <p className="mt-1 text-[10px] font-medium">
                Atenção: a seleção atual apaga o módulo inteiro (todos os ciclos e células).
              </p>
            )}
          </div>

          <label className="mt-2 block text-[11px] text-muted-foreground">
            Digite <strong className="text-foreground">APAGAR</strong> para liberar
            <Input
              value={palavra}
              onChange={(event) => setPalavra(event.target.value)}
              placeholder="APAGAR"
              className="mt-0.5 h-8 text-xs"
            />
          </label>

          <p className="text-[10px] text-muted-foreground">
            O que não corresponder aos dois filtros permanece intacto. Os PDFs continuam no
            armazenamento privado — o aplicativo não tem permissão para excluir arquivos.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                busy || palavra.trim().toUpperCase() !== "APAGAR" || total === null || total === 0
              }
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
