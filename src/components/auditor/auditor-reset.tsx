import { useState } from "react";
import { useAuth } from "@/hooks/auth-context";
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
import { clearAuditorDatabase, fetchAuditorTotals, type AuditorTotals } from "@/lib/auditor-reset";
import { invalidateAuditorCache } from "@/lib/auditor";

/**
 * Limpeza do banco do Qualy Auditor (somente tabelas qa_*).
 * Exige digitar APAGAR e mostra exatamente o que será excluído.
 */
export function AuditorReset({ onCleared }: { onCleared?: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [totais, setTotais] = useState<AuditorTotals | null>(null);
  const [palavra, setPalavra] = useState("");
  const [busy, setBusy] = useState(false);

  const abrir = async () => {
    setOpen(true);
    setPalavra("");
    setTotais(null);
    try {
      setTotais(await fetchAuditorTotals());
    } catch (problem) {
      toast.error("Não foi possível contar os registros", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      await clearAuditorDatabase();
      invalidateAuditorCache();
      toast.success("Banco do Qualy Auditor limpo", {
        description: "Os PDFs permanecem no armazenamento privado (sem política de exclusão).",
      });
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

  const linhas: [string, number][] = totais
    ? [
        ["FV/OS (tratativas)", totais.cases],
        ["Documentos", totais.documents],
        ["Etapas avaliadas", totais.items],
        ["Movimentações", totais.events],
        ["Controle de refazer", totais.redo],
        ["Relatórios", totais.reports],
      ]
    : [];

  if (profile?.role !== "gestor") {
    return null;
  }

  return (
    <>
      <Button type="button" variant="glass" size="sm" onClick={() => void abrir()}>
        <DatabaseZap className="h-3.5 w-3.5" />
        Limpar banco
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : setOpen(false))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Limpar banco do Qualy Auditor</DialogTitle>
            <DialogDescription>
              Apaga apenas os registros do Qualy Auditor. Analista, Emissor e configurações não são
              afetados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          {!totais ? (
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
