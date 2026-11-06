import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Wrench,
} from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  ANALYSIS_ORDER,
  ANALYSIS_STATUS,
  EVENT_LABELS,
  REDO_ORDER,
  REDO_STATUS,
  TEAM_TYPES,
  fetchCase,
  fetchCaseEvents,
  fetchCaseItems,
  fetchRedoForCase,
  registerReturn,
  saveItemInternal,
  saveRedo,
  updateCase,
  type AnalysisStatus,
  type AuditorCase,
  type AuditorCaseItem,
  type AuditorEvent,
  type AuditorRedo,
  type CaseOutcome,
  type RedoStatus,
} from "@/lib/auditor";
import { signedPdfUrl } from "@/lib/auditor-save";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeBR } from "@/lib/fields";

const OUTCOME_BY_STATUS: Partial<Record<AnalysisStatus, CaseOutcome>> = {
  conforme_verificado: "conforme",
  nao_conforme_confirmado: "nao_conforme",
  encaminhado_refazer: "nao_conforme",
};

const STATUS_TONE: Record<string, string> = {
  conforme_verificado: "border-success/40 bg-success/10",
  nao_conforme_confirmado: "border-destructive/40 bg-destructive/10",
  encaminhado_refazer: "border-warning/40 bg-warning/10",
  resposta_enviada: "border-primary/40 bg-primary/10",
};

export default function AuditorCaso() {
  const { caseId = "" } = useParams();
  const [caso, setCaso] = useState<AuditorCase | null>(null);
  const [items, setItems] = useState<AuditorCaseItem[]>([]);
  const [events, setEvents] = useState<AuditorEvent[]>([]);
  const [redo, setRedo] = useState<AuditorRedo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfPath, setPdfPath] = useState("");
  const [opinion, setOpinion] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await fetchCase(caseId);
      setCaso(found);
      if (found) {
        setOpinion(found.opinion);
        setNotes(found.notes);
        const [listaItens, historico, refazer] = await Promise.all([
          fetchCaseItems(found.documentId),
          fetchCaseEvents(caseId),
          fetchRedoForCase(caseId),
        ]);
        setItems(listaItens);
        setEvents(historico);
        setRedo(refazer);

        if (found.documentId) {
          const { data } = await supabase
            .from("qa_documents")
            .select("pdf_path")
            .eq("id", found.documentId)
            .maybeSingle();
          setPdfPath(data?.pdf_path ?? "");
        }
      }
    } catch (problem) {
      toast.error("Não foi possível carregar a tratativa", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const avaliadas = useMemo(
    () => items.filter((item) => item.originalResult && item.originalResult !== "N/A").length,
    [items],
  );

  const aplicarStatus = async (status: AnalysisStatus) => {
    setBusy(true);
    try {
      await updateCase(
        caseId,
        {
          status,
          outcome: OUTCOME_BY_STATUS[status] ?? (status === "encerrado" ? undefined : "pendente"),
          opinion,
          notes,
          decided: Boolean(OUTCOME_BY_STATUS[status]),
        },
        { type: status },
      );
      toast.success("Situação atualizada", { description: ANALYSIS_STATUS[status] });
      await load();
    } catch (problem) {
      toast.error("Falha ao atualizar", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const salvarParecer = async () => {
    setBusy(true);
    try {
      await updateCase(caseId, { opinion, notes }, { type: "parecer_registrado" });
      toast.success("Parecer salvo");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const salvarItem = async (item: AuditorCaseItem, resultado: string, observacao: string) => {
    try {
      await saveItemInternal(item.id, resultado, observacao);
      setItems((previous) =>
        previous.map((row) =>
          row.id === item.id ? { ...row, internalResult: resultado, notes: observacao } : row,
        ),
      );
    } catch (problem) {
      toast.error("Falha ao salvar a avaliação do item");
    }
  };

  const registrarDevolucao = async () => {
    const motivo = window.prompt("Motivo da devolução da AlphaGeos:");
    if (!motivo) {
      return;
    }
    setBusy(true);
    try {
      await registerReturn(caseId, motivo, caso?.returnedCount ?? 0);
      toast.success("Devolução registrada", { description: "A mesma FV/OS foi reaberta." });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AuditorShell>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando tratativa...
        </div>
      </AuditorShell>
    );
  }

  if (!caso) {
    return (
      <AuditorShell>
        <Card className="p-4 text-sm text-muted-foreground">Tratativa não encontrada.</Card>
      </AuditorShell>
    );
  }

  return (
    <AuditorShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/auditor">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {pdfPath && (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => {
                void signedPdfUrl(pdfPath).then((link) => {
                  if (link) window.open(link, "_blank", "noopener");
                });
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              PDF original
            </Button>
          )}
          <Button asChild variant="glass" size="sm">
            <Link to={`/auditor/relatorio/${caso.id}`}>
              <FileText className="h-3.5 w-3.5" />
              Relatório
            </Link>
          </Button>
        </div>
      </div>

      <Card className={`p-4 ${STATUS_TONE[caso.status] ?? ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">FV / OS</p>
            <p className="text-lg font-semibold text-foreground">
              {caso.fac || "—"} / {caso.os || "—"}
            </p>
            <p className="text-xs text-muted-foreground">{caso.address || "Endereço não informado"}</p>
            <p className="text-[11px] text-muted-foreground">
              {[caso.municipality, caso.locality, caso.serviceType].filter(Boolean).join(" · ") ||
                "Sem município/localidade"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{ANALYSIS_STATUS[caso.status]}</p>
            <p className="text-[11px] text-muted-foreground">
              {items.length} etapa(s) · {avaliadas} avaliada(s)
            </p>
            {caso.returnedCount > 0 && (
              <p className="text-[11px] text-warning">{caso.returnedCount} devolução(ões)</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Etapas do FV</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          A coluna “AlphaGeos” é a classificação original e não pode ser alterada. A avaliação
          interna é sua e vale apenas para a tratativa.
        </p>
        {items.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border/70 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
            Nenhuma etapa registrada para este documento.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2">Item</th>
                  <th className="py-1.5 pr-2">Descritivo</th>
                  <th className="py-1.5 pr-2">AlphaGeos</th>
                  <th className="py-1.5 pr-2">Avaliação interna</th>
                  <th className="py-1.5 pr-2">Pág.</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 align-top">
                    <td className="py-1.5 pr-2 font-mono">{item.code}</td>
                    <td className="max-w-[320px] py-1.5 pr-2 text-muted-foreground">
                      {item.description}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-foreground">
                      {item.originalResult || "sem classificação"}
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={item.internalResult ?? ""}
                        onChange={(event) => void salvarItem(item, event.target.value, item.notes)}
                        className="h-7 rounded border border-input bg-background px-1 text-[11px]"
                      >
                        <option value="">não avaliado</option>
                        <option value="conforme">conforme</option>
                        <option value="nao_conforme">não conforme</option>
                        <option value="na">não se aplica</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{item.page ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Parecer técnico</h2>
        <textarea
          value={opinion}
          onChange={(event) => setOpinion(event.target.value)}
          placeholder="Conclusão da análise da qualidade (decisão humana)."
          className="mt-2 min-h-20 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
        />
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Observações internas."
          className="mt-2 min-h-14 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="glass" size="sm" onClick={() => void salvarParecer()} disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Salvar parecer
          </Button>
          <select
            value=""
            onChange={(event) => {
              const value = event.target.value as AnalysisStatus;
              if (value) void aplicarStatus(value);
            }}
            className="h-9 rounded-md border border-input bg-background/70 px-2 text-xs"
          >
            <option value="">Mudar situação...</option>
            {ANALYSIS_ORDER.map((status) => (
              <option key={status} value={status}>
                {ANALYSIS_STATUS[status]}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void registrarDevolucao()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Registrar devolução
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wrench className="h-4 w-4" /> Refazer
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Preencha quando a não conformidade for confirmada e o serviço precisar de correção.
        </p>
        <RedoForm caseId={caso.id} itemCodes={items.map((item) => item.code)} initial={redo} onSaved={() => void load()} />
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
        {events.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Sem eventos registrados.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                <CheckCircle2 className="h-3 w-3 text-[hsl(var(--auditor-steel))]" />
                <span className="font-medium text-foreground">
                  {EVENT_LABELS[event.type] ?? event.type}
                </span>
                <span className="text-muted-foreground">{formatDateTimeBR(event.createdAt)}</span>
                {typeof event.payload.reason === "string" && (
                  <span className="text-muted-foreground">· {event.payload.reason}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AuditorShell>
  );
}

function RedoForm({
  caseId,
  itemCodes,
  initial,
  onSaved,
}: {
  caseId: string;
  itemCodes: string[];
  initial: AuditorRedo | null;
  onSaved: () => void;
}) {
  const [itemCode, setItemCode] = useState(initial?.itemCode ?? "");
  const [problem, setProblem] = useState(initial?.problem ?? "");
  const [teamType, setTeamType] = useState(initial?.teamType ?? "");
  const [foreman, setForeman] = useState(initial?.foreman ?? "");
  const [status, setStatus] = useState<RedoStatus>(initial?.status ?? "pendente_encaminhamento");
  const [sentAt, setSentAt] = useState(initial?.sentAt?.slice(0, 10) ?? "");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt?.slice(0, 10) ?? "");
  const [finishedAt, setFinishedAt] = useState(initial?.finishedAt?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    setBusy(true);
    try {
      await saveRedo({
        caseId,
        itemCode,
        problem,
        reason: "",
        teamType,
        foreman,
        sentAt: sentAt ? new Date(`${sentAt}T12:00:00`).toISOString() : null,
        scheduledAt: scheduledAt ? new Date(`${scheduledAt}T12:00:00`).toISOString() : null,
        status,
        finishedAt: finishedAt ? new Date(`${finishedAt}T12:00:00`).toISOString() : null,
        notes,
        photosBefore: initial?.photosBefore ?? [],
        photosAfter: initial?.photosAfter ?? [],
      });
      toast.success("Controle de refazer salvo");
      onSaved();
    } catch (error) {
      toast.error("Falha ao salvar", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="text-[11px] text-muted-foreground">
        Item não conforme
        <Input value={itemCode} onChange={(event) => setItemCode(event.target.value)} list="itens" className="mt-0.5 h-8 text-xs" />
        <datalist id="itens">
          {itemCodes.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      </label>
      <label className="text-[11px] text-muted-foreground">
        Tipo de equipe
        <select
          value={teamType}
          onChange={(event) => setTeamType(event.target.value)}
          className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
        >
          <option value="">selecione</option>
          {Object.entries(TEAM_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-muted-foreground sm:col-span-2">
        Problema identificado
        <Input value={problem} onChange={(event) => setProblem(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <label className="text-[11px] text-muted-foreground">
        Encarregado
        <Input value={foreman} onChange={(event) => setForeman(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <label className="text-[11px] text-muted-foreground">
        Situação da correção
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as RedoStatus)}
          className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
        >
          {REDO_ORDER.map((value) => (
            <option key={value} value={value}>
              {REDO_STATUS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-muted-foreground">
        Encaminhado em
        <Input type="date" value={sentAt} onChange={(event) => setSentAt(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <label className="text-[11px] text-muted-foreground">
        Programado para
        <Input type="date" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <label className="text-[11px] text-muted-foreground">
        Concluído em
        <Input type="date" value={finishedAt} onChange={(event) => setFinishedAt(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <label className="text-[11px] text-muted-foreground sm:col-span-2">
        Observações
        <Input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-0.5 h-8 text-xs" />
      </label>
      <div className="sm:col-span-2">
        <Button type="button" variant="glow" size="sm" onClick={() => void salvar()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar refazer
        </Button>
      </div>
    </div>
  );
}
