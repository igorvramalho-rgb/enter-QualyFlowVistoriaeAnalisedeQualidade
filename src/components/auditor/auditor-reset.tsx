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
import { clearScope, fetchScopeTotal, type ResetScope } from "@/lib/auditor-reset";
import { CELLS, invalidateAuditorCache, type CellKey } from "@/lib/auditor";

/**
 * Limpeza controlada do Qualy Auditor.
 * O operador escolhe o escopo: ciclo selecionado, célula atual ou todo o módulo.
 */
export function AuditorReset({
  cell,
  cycle,
  onCleared,
  label,
}: {
  cell?: CellKey;
  cycle?: { id: string; name: string } | null;
  onCleared?: () => void;
  label?: string;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [escopo, setEscopo] = useState<ResetScope>({ type: cycle?.id ? "cycle" : cell ? "cell" : "all", value: cycle?.id ?? cell });
  const [total, setTotal] = useState<number | null>(null);
  const [palavra, setPalavra] = useState("");
  const [busy, setBusy] = useState(false);

  const opcoes: { valor: string; rotulo: string; escopo: ResetScope }[] = [];
  if (cycle?.id) {
    opcoes.push({
      valor: "cycle",
      rotulo: `Ciclo — ${cycle.name}`,
      escopo: { type: "cycle", value: cycle.id },
    });
  }
  if (cell) {
    opcoes.push({
      valor: "cell",
      rotulo: `Célula — ${CELLS[cell].label}`,
      escopo: { type: "cell", value: cell },
    });
  }
  opcoes.push({ valor: "all", rotulo: "Todo o banco do Auditor", escopo: { type: "all" } });

  const medir = useCallback(async (alvo: ResetScope) => {
    setTotal(null);
    try {
      setTotal(await fetchScopeTotal(alvo));
    } catch {
      setTotal(null);
    }
  }, []);

  const abrir = () => {
    setOpen(true);
    setPalavra("");
    const inicial =
      opcoes.find((opcao) => opcao.valor === "cycle")?.escopo ??
      opcoes.find((opcao) => opcao.valor === "cell")?.escopo ??
      { type: "all" as const };
    setEscopo(inicial);
    void medir(inicial);
  };

  const trocarEscopo = (valor: string) => {
    const opcao = opcoes.find((item) => item.valor === valor);
    if (!opcao) {
      return;
    }
    setEscopo(opcao.escopo);
    void medir(opcao.escopo);
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      const apagados = await clearScope(escopo);
      invalidateAuditorCache();
      toast.success("Limpeza concluída", {
        description: `${apagados} FV/OS removida(s) · ${
          escopo.type === "cycle"
            ? "apenas neste ciclo"
            : escopo.type === "cell"
              ? "apenas nesta célula"
              : "todo o banco do Auditor"
        }.`,
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

  useEffect(() => {
    if (!open) {
      return;
    }
    void medir(escopo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (profile?.role !== "gestor") {
    return null;
  }

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
              Escolha exatamente o que será apagado. Analista, Emissor e configurações não são
              afetados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <label className="block text-[11px] text-muted-foreground">
            O que apagar
            <select
              value={escopo.type}
              onChange={(event) => trocarEscopo(event.target.value)}
              className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
            >
              {opcoes.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px]">
            {total === null ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Contando registros…
              </span>
            ) : (
              <span className="flex justify-between">
                <span>FV/OS que serão apagadas</span>
                <strong>{total}</strong>
              </span>
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
            As demais FV/OS (outros ciclos e células) permanecem intactas. Os PDFs continuam no
            armazenamento privado — o aplicativo não tem permissão para excluir arquivos.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || palavra.trim().toUpperCase() !== "APAGAR" || total === null}
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
