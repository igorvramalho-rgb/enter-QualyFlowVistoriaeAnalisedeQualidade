import { useEffect, useState } from "react";
import { CalendarRange, Loader2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
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
  attachOrphanCases,
  countCycleCases,
  countOrphanCases,
  createCycle,
  deleteCycle,
  loadCycles,
  setActiveCycle,
  updateCycle,
  useActiveCycle,
  useCycles,
} from "@/lib/cycles";

const SEM_CICLO = "sem-ciclo";

function periodoInvalido(inicio: string, fim: string): boolean {
  return Boolean(inicio && fim && fim < inicio);
}

/**
 * Seletor de ciclo (Pós 60 por período). Tudo no Qualy Auditor — células, BI e
 * importações — trabalha dentro do ciclo escolhido. O ciclo selecionado pode ser
 * editado ou excluído; excluir nunca apaga tratativas.
 */
export function CycleBar() {
  const { profile } = useAuth();
  const ciclos = useCycles();
  const ativo = useActiveCycle();
  const cicloAtivo = ciclos.find((ciclo) => ciclo.id === ativo) ?? null;
  const outrosCiclos = ciclos.filter((ciclo) => ciclo.id !== ativo);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [busy, setBusy] = useState(false);
  const [orfaos, setOrfaos] = useState(0);

  const [editarOpen, setEditarOpen] = useState(false);
  const [edicaoNome, setEdicaoNome] = useState("");
  const [edicaoInicio, setEdicaoInicio] = useState("");
  const [edicaoFim, setEdicaoFim] = useState("");

  const [excluirOpen, setExcluirOpen] = useState(false);
  const [casosCiclo, setCasosCiclo] = useState(0);
  const [carregandoCasos, setCarregandoCasos] = useState(false);
  const [destinoCiclo, setDestinoCiclo] = useState<string>(SEM_CICLO);

  useEffect(() => {
    void loadCycles().finally(() => {
      void countOrphanCases().then(setOrfaos).catch(() => setOrfaos(0));
    });
  }, [ativo]);

  const vincular = async () => {
    if (!ativo) {
      toast.error("Selecione o ciclo de destino.");
      return;
    }
    setBusy(true);
    try {
      const total = await attachOrphanCases(ativo);
      setOrfaos(0);
      toast.success("Tratativas vinculadas ao ciclo", { description: `${total} FV/OS` });
    } finally {
      setBusy(false);
    }
  };

  const criar = async () => {
    if (!nome.trim()) {
      toast.error("Dê um nome ao ciclo (ex.: Pós 60 · mai a jul/2026).");
      return;
    }
    if (periodoInvalido(inicio, fim)) {
      toast.error("O fim do ciclo não pode ser anterior ao início.");
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

  const abrirEdicao = () => {
    if (!cicloAtivo) {
      return;
    }
    setEdicaoNome(cicloAtivo.name);
    setEdicaoInicio(cicloAtivo.startDate);
    setEdicaoFim(cicloAtivo.endDate);
    setEditarOpen(true);
  };

  const salvarEdicao = async () => {
    if (!cicloAtivo) {
      return;
    }
    if (!edicaoNome.trim()) {
      toast.error("O ciclo precisa de um nome.");
      return;
    }
    if (periodoInvalido(edicaoInicio, edicaoFim)) {
      toast.error("O fim do ciclo não pode ser anterior ao início.");
      return;
    }

    setBusy(true);
    try {
      const atualizado = await updateCycle(cicloAtivo.id, {
        name: edicaoNome,
        startDate: edicaoInicio,
        endDate: edicaoFim,
      });

      if (!atualizado) {
        toast.error("Não foi possível editar o ciclo", {
          description: "Verifique a conexão e tente novamente.",
        });
        return;
      }

      toast.success("Ciclo atualizado", { description: atualizado.name });
      setEditarOpen(false);
      await loadCycles(true);
    } finally {
      setBusy(false);
    }
  };

  const abrirExclusao = async () => {
    if (!cicloAtivo) {
      return;
    }
    setDestinoCiclo(SEM_CICLO);
    setCasosCiclo(0);
    setExcluirOpen(true);
    setCarregandoCasos(true);
    try {
      setCasosCiclo(await countCycleCases(cicloAtivo.id));
    } catch {
      setCasosCiclo(0);
    } finally {
      setCarregandoCasos(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!cicloAtivo) {
      return;
    }

    setBusy(true);
    try {
      const resultado = await deleteCycle(
        cicloAtivo.id,
        destinoCiclo === SEM_CICLO ? null : destinoCiclo,
      );

      if (!resultado.ok) {
        toast.error("Ciclo não foi excluído", { description: resultado.error });
        return;
      }

      toast.success("Ciclo excluído", {
        description: [
          resultado.moved > 0 ? `${resultado.moved} tratativa(s) movida(s)` : null,
          resultado.moved === 0 && casosCiclo > 0 ? `${casosCiclo} sem ciclo` : null,
          resultado.error ?? null,
        ]
          .filter(Boolean)
          .join(" · ") || cicloAtivo.name,
      });

      setExcluirOpen(false);
      await loadCycles(true);
      setOrfaos(await countOrphanCases());
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

      {cicloAtivo && (
        <>
          <Button
            type="button"
            variant="glass"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={abrirEdicao}
            disabled={busy}
            title="Editar nome e período do ciclo selecionado"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
          <Button
            type="button"
            variant="glass"
            size="sm"
            className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
            onClick={() => void abrirExclusao()}
            disabled={busy}
            title="Excluir o ciclo selecionado (as tratativas não são apagadas)"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </Button>
        </>
      )}

      {profile?.role === "gestor" && (
        <Button type="button" variant="glass" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" />
          Novo ciclo
        </Button>
      )}

      {profile?.role === "gestor" && orfaos > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => void vincular()}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Vincular {orfaos} sem ciclo
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

      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ciclo</DialogTitle>
            <DialogDescription>
              Altere o nome e o período do ciclo. As tratativas continuam vinculadas a ele.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="block text-[11px] text-muted-foreground">
              Nome do ciclo
              <Input
                value={edicaoNome}
                onChange={(event) => setEdicaoNome(event.target.value)}
                placeholder="Pós 60 · mai a jul/2026"
                className="mt-0.5 h-8 text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-muted-foreground">
                Início
                <Input
                  type="date"
                  value={edicaoInicio}
                  onChange={(event) => setEdicaoInicio(event.target.value)}
                  className="mt-0.5 h-8 text-xs"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Fim
                <Input
                  type="date"
                  value={edicaoFim}
                  onChange={(event) => setEdicaoFim(event.target.value)}
                  className="mt-0.5 h-8 text-xs"
                />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditarOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="glow" onClick={() => void salvarEdicao()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluirOpen} onOpenChange={setExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir ciclo</DialogTitle>
            <DialogDescription>
              O ciclo <strong className="text-foreground">{cicloAtivo?.name}</strong> será removido.
              FV/OS, fotos, relatórios e histórico das tratativas não são apagados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="rounded-lg border border-glass-border/60 bg-glass/30 px-3 py-2 text-[11px] text-muted-foreground">
              {carregandoCasos
                ? "Contando tratativas do ciclo..."
                : `${casosCiclo} tratativa(s) vinculada(s) a este ciclo.`}
            </p>

            {casosCiclo > 0 && outrosCiclos.length > 0 && (
              <label className="block text-[11px] text-muted-foreground">
                Destino das tratativas
                <Select value={destinoCiclo} onValueChange={setDestinoCiclo}>
                  <SelectTrigger className="mt-1 h-9 bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_CICLO} className="text-xs">
                      Deixar sem ciclo (vincular depois)
                    </SelectItem>
                    {outrosCiclos.map((ciclo) => (
                      <SelectItem key={ciclo.id} value={ciclo.id} className="text-xs">
                        {ciclo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}

            <p className="flex items-start gap-2 text-[11px] text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A exclusão do ciclo é definitiva e restrita ao gestor. Sem destino escolhido, as
              tratativas ficam sem ciclo e podem ser vinculadas pelo botão "Vincular sem ciclo".
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExcluirOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmarExclusao()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir ciclo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
