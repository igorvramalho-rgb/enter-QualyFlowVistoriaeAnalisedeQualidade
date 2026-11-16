import { useEffect, useState } from "react";
import { CalendarRange, Loader2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import {
  createCycle,
  loadCycles,
  setActiveCycle,
  useActiveCycle,
  useCycles,
} from "@/lib/cycles";

/**
 * Seletor de ciclo (Pós 60 por período). Tudo no Qualy Auditor — células, BI e
 * importações — trabalha dentro do ciclo escolhido.
 */
export function CycleBar() {
  const { profile } = useAuth();
  const ciclos = useCycles();
  const ativo = useActiveCycle();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadCycles();
  }, []);

  const criar = async () => {
    if (!nome.trim()) {
      toast.error("Dê um nome ao ciclo (ex.: Pós 60 · mai a jul/2026).");
      return;
    }
    setBusy(true);
    try {
      const novo = await createCycle({ name: nome, startDate: inicio, endDate: fim });
      if (!novo) {
        toast.error("Não foi possível criar o ciclo.");
        return;
      }
      toast.success("Ciclo criado", { description: novo.name });
      setOpen(false);
      setNome("");
      setInicio("");
      setFim("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 shrink-0 text-[hsl(var(--auditor-navy-mid))]" />
        <Select
          value={ativo ?? undefined}
          onValueChange={(valor) => setActiveCycle(valor)}
          disabled={ciclos.length === 0}
        >
          <SelectTrigger className="h-9 w-[260px] bg-card text-xs font-medium">
            <SelectValue placeholder={ciclos.length === 0 ? "Carregando ciclos…" : "Selecione o ciclo"} />
          </SelectTrigger>
          <SelectContent>
            {ciclos.map((ciclo) => (
              <SelectItem key={ciclo.id} value={ciclo.id} className="text-xs">
                <span className="font-medium">{ciclo.name}</span>
                {ciclo.startDate && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {ciclo.startDate} → {ciclo.endDate}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {profile?.role === "gestor" && (
        <Button type="button" variant="glass" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" />
          Novo ciclo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo ciclo de tratativa</DialogTitle>
            <DialogDescription>
              Cada ciclo reúne as FV/OS de um período (ex.: Pós 60 de maio a julho). As células e o
              BI passam a mostrar apenas o ciclo selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="block text-[11px] text-muted-foreground">
              Nome do ciclo
              <Input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Pós 60 · mai a jul/2026"
                className="mt-0.5 h-8 text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-muted-foreground">
                Início
                <Input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="mt-0.5 h-8 text-xs" />
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Fim
                <Input type="date" value={fim} onChange={(event) => setFim(event.target.value)} className="mt-0.5 h-8 text-xs" />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="glow" onClick={() => void criar()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar ciclo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
