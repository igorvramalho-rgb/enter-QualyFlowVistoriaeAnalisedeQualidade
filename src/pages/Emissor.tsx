import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eraser,
  FileText,
  Images,
  MapPin,
  Info,
  Layers,
  Loader2,
  MessageSquareText,
  Plus,
  Printer,
  Save,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DraftsList } from "@/components/emissores/drafts-list";
import { InstitutionalHeaderForm } from "@/components/emissores/institutional-header-form";
import { PhotoSlotGrid } from "@/components/emissores/photo-slot-grid";
import { ReportForm } from "@/components/emissores/report-form";
import { TemplatePickerCard } from "@/components/emissores/template-picker";
import { PrintPortal } from "@/components/report/print-portal";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useCloudReports, useCloudSettings } from "@/hooks/use-cloud-data";
import { useScaledContainer } from "@/hooks/use-scaled-container";
import { emptyGeotag } from "@/lib/geotag";
import {
  countFilledPhotos,
  draftLabel,
  includedSlots,
  type GeotagSettings,
  type PhotoEntry,
  type PhotoMap,
  type QualyflowSettings,
  migrateDraftValues,
  normalizeSettings,
  type ReportDraft,
  type ReportValues,
} from "@/lib/report-document";
import {
  buildReportFileName,
  isFilePickerAvailable,
  printReport,
  saveReportPdfFile,
} from "@/lib/report-export";
import { lookupReportData, syncReportToAuditor } from "@/lib/report-lookup";
import {
  getDefaultValues,
  getTemplate,
  type ReportTemplateId,
  mergeValuesForTemplate,
  REPORT_TEMPLATES,
} from "@/lib/report-templates";
import { createId } from "@/lib/storage";

const FIRST_TEMPLATE = REPORT_TEMPLATES[0];
const CURRENT_DRAFT_KEY = "qualyflow:current-draft:v1";

/** Assinatura leve do conteúdo (sem serializar as imagens inteiras). */
function draftSignature(draft: {
  templateId: string;
  values: Record<string, string>;
  objeto?: string;
  observacoes?: string;
  geotag?: unknown;
  photos: PhotoMap;
}): string {
  return JSON.stringify({
    templateId: draft.templateId,
    values: draft.values,
    objeto: draft.objeto ?? "",
    observacoes: draft.observacoes ?? "",
    geotag: draft.geotag ?? null,
    photos: Object.entries(draft.photos).map(([slot, entry]) => [
      slot,
      entry.dataUrl.length,
      entry.include,
      entry.caption ?? "",
      entry.showGeotag ?? true,
      entry.geotag ?? null,
    ]),
  });
}

export default function Emissor() {
  const { settings, update: updateSettings } = useCloudSettings();
  const {
    drafts,
    loading: draftsLoading,
    save: saveReport,
    remove: removeReport,
    pruneExcess,
  } = useCloudReports();

  const [templateId, setTemplateId] = useState<ReportTemplateId>(FIRST_TEMPLATE.id);
  const [values, setValues] = useState<ReportValues>(() => getDefaultValues(FIRST_TEMPLATE));
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [objeto, setObjeto] = useState<string>(FIRST_TEMPLATE.objeto ?? "");
  const [observacoes, setObservacoes] = useState<string>("");
  const [geotag, setGeotag] = useState<GeotagSettings>({ enabled: false, defaults: emptyGeotag() });
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [migrarOpen, setMigrarOpen] = useState(false);
  const [migrarDados, setMigrarDados] = useState<{
    fac: string;
    os: string;
    address: string;
    serviceType: string;
  } | null>(null);
  const [migrando, setMigrando] = useState(false);
  const savedSignature = useRef("");
  const pendingDraft = useRef<ReportDraft | null>(null);

  const template = getTemplate(templateId);
  const safeSettings = useMemo(() => normalizeSettings(settings), [settings]);
  const pages = useMemo(() => includedSlots(templateId, photos).length, [templateId, photos]);
  const filledPhotos = useMemo(() => countFilledPhotos(templateId, photos), [templateId, photos]);
  const { outerRef, innerRef, scale, height } = useScaledContainer(794);

  const documentView = (
    <ReportDocumentView
      templateId={templateId}
      values={values}
      photos={photos}
      objeto={objeto}
      observacoes={observacoes}
      settings={safeSettings}
    />
  );

  // Prévia adiada: digitar não precisa redesenhar as folhas a cada tecla.
  const valoresPreview = useDeferredValue(values);
  const fotosPreview = useDeferredValue(photos);
  const observacoesPreview = useDeferredValue(observacoes);
  const objetoPreview = useDeferredValue(objeto);

  const previewView = useMemo(
    () => (
      <ReportDocumentView
        templateId={templateId}
        values={valoresPreview}
        photos={fotosPreview}
        objeto={objetoPreview}
        observacoes={observacoesPreview}
        settings={safeSettings}
      />
    ),
    [templateId, valoresPreview, fotosPreview, objetoPreview, observacoesPreview, safeSettings],
  );

  const hasContent = useMemo(
    () =>
      Object.values(values).some((value) => value.trim().length > 0) ||
      Object.values(photos).some((entry) => entry.dataUrl.length > 0) ||
      observacoes.trim().length > 0 ||
      (template.layout === "pos60" && objeto !== (template.objeto ?? "")) ||
      geotag.enabled,
    [values, photos, observacoes, objeto, template.objeto, template.layout, geotag.enabled],
  );

  const signature = useMemo(
    () => draftSignature({ templateId, values, photos, objeto, observacoes, geotag }),
    [templateId, values, photos, objeto, observacoes, geotag],
  );

  // Retoma o relatório em andamento ao voltar para a tela
  useEffect(() => {
    if (hydrated || draftsLoading) {
      return;
    }
    setHydrated(true);

    const storedId = window.localStorage.getItem(CURRENT_DRAFT_KEY);
    if (!storedId) {
      return;
    }

    const draft = drafts.find((item) => item.id === storedId);
    if (!draft) {
      window.localStorage.removeItem(CURRENT_DRAFT_KEY);
      return;
    }

    const draftTemplate = getTemplate(draft.templateId);
    setTemplateId(draftTemplate.id);
    setValues({ ...getDefaultValues(draftTemplate), ...migrateDraftValues(draft.values) });
    setPhotos(draft.photos ?? {});
    setObjeto(draft.objeto ?? draftTemplate.objeto ?? "");
    setObservacoes(draft.observacoes ?? "");
    setGeotag(draft.geotag ?? { enabled: false, defaults: emptyGeotag() });
    setCurrentDraftId(draft.id);
    savedSignature.current = draftSignature(draft);
    toast.info("Relatório em andamento restaurado", { description: draft.name });
  }, [drafts, draftsLoading, hydrated]);

  // Salva automaticamente enquanto o operador preenche
  useEffect(() => {
    if (!hydrated || !hasContent || signature === savedSignature.current) {
      return;
    }

    const now = new Date().toISOString();
    const existing = currentDraftId
      ? drafts.find((item) => item.id === currentDraftId)
      : undefined;

    const draft: ReportDraft = {
      id: currentDraftId ?? createId(),
      name: draftLabel(templateId, values),
      templateId,
      values,
      photos,
      objeto,
      observacoes,
      geotag,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    pendingDraft.current = draft;
    const timer = window.setTimeout(() => {
      void saveReport(draft).then((saved) => {
        if (!saved) {
          return;
        }
        setCurrentDraftId(saved.id);
        window.localStorage.setItem(CURRENT_DRAFT_KEY, saved.id);
        savedSignature.current = draftSignature(saved);
        pendingDraft.current = null;
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    signature,
    hydrated,
    hasContent,
    currentDraftId,
    drafts,
    templateId,
    values,
    photos,
    objeto,
    observacoes,
    geotag,
    saveReport,
  ]);

  // Grava o que estiver pendente ao sair da tela
  useEffect(
    () => () => {
      const pending = pendingDraft.current;
      if (pending) {
        pendingDraft.current = null;
        void saveReport(pending);
      }
    },
    [saveReport],
  );

  const handleTemplateChange = (nextId: string) => {
    if (nextId === templateId) {
      return;
    }
    const nextTemplate = getTemplate(nextId);
    setValues((previous) => mergeValuesForTemplate(nextTemplate, template, previous));
    setPhotos((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([slotId]) =>
          nextTemplate.photoSlots.some((slot) => slot.id === slotId),
        ),
      ),
    );
    setObjeto(nextTemplate.objeto ?? "");
    setTemplateId(nextId as ReportTemplateId);
  };

  const lookupTimer = useRef<number | null>(null);

  const handleValueChange = (fieldId: string, value: string) => {
    setValues((previous) => ({ ...previous, [fieldId]: value }));

    // Protocolo SGZ, FAC ou OS: completa endereço e OS com o que já está no banco.
    if (!["protocoloSgz", "fac", "os"].includes(fieldId)) {
      return;
    }
    if (lookupTimer.current) {
      window.clearTimeout(lookupTimer.current);
    }
    const termo = value.trim();
    if (termo.length < 4) {
      return;
    }

    lookupTimer.current = window.setTimeout(() => {
      void lookupReportData(termo)
        .then((achado) => {
          if (!achado) {
            return;
          }
          setValues((previous) => ({
            ...previous,
            os: previous.os?.trim() ? previous.os : achado.os || previous.os,
            endereco: previous.endereco?.trim() ? previous.endereco : achado.address || previous.endereco,
          }));
        })
        .catch(() => undefined);
    }, 500);
  };

  const handlePhotoChange = (slotId: string, entry: PhotoEntry | null) => {
    setPhotos((previous) => {
      if (!entry) {
        const next = { ...previous };
        delete next[slotId];
        return next;
      }
      return { ...previous, [slotId]: entry };
    });
  };

  const buildDraft = (id?: string): ReportDraft => {
    const now = new Date().toISOString();
    const existing = id ? drafts.find((draft) => draft.id === id) : undefined;

    return {
      id: id ?? createId(),
      name: draftLabel(templateId, values),
      templateId,
      values,
      photos,
      objeto,
      observacoes,
      geotag,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const hydrateDraft = (draft: ReportDraft) => {
    const draftTemplate = getTemplate(draft.templateId);
    setTemplateId(draftTemplate.id);
    setValues({ ...getDefaultValues(draftTemplate), ...migrateDraftValues(draft.values) });
    setPhotos(draft.photos ?? {});
    setObjeto(draft.objeto ?? draftTemplate.objeto ?? "");
    setObservacoes(draft.observacoes ?? "");
    setGeotag(draft.geotag ?? { enabled: false, defaults: emptyGeotag() });
    setCurrentDraftId(draft.id);
  };

  const handleSaveDraft = async () => {
    const draft = buildDraft(currentDraftId ?? undefined);
    const existing = drafts.find((item) => item.id === draft.id);
    const saved = await saveReport(draft);
    if (!saved) {
      return;
    }

    setCurrentDraftId(saved.id);
    window.localStorage.setItem(CURRENT_DRAFT_KEY, saved.id);
    savedSignature.current = draftSignature(saved);
    toast.success(existing ? "Rascunho atualizado na nuvem" : "Relatório salvo na nuvem", {
      description: draft.name,
    });
  };

  /** Consulta o banco pela FV, OS ou protocolo SGZ e atualiza OS e endereço. */
  const handleAtualizarDados = async () => {
    const termo = (values.protocoloSgz || values.fac || values.os || "").trim();
    if (termo.length < 4) {
      toast.info("Informe o protocolo SGZ, o FAC ou a OS para atualizar.");
      return;
    }

    try {
      const achado = await lookupReportData(termo);
      if (!achado || (!achado.os && !achado.address)) {
        toast.warning("Nada encontrado no banco para este número", { description: termo });
        return;
      }

      setValues((previous) => ({
        ...previous,
        os: achado.os || previous.os,
        endereco: achado.address || previous.endereco,
      }));
      toast.success("Dados atualizados", {
        description: [achado.os && `OS ${achado.os}`, achado.address].filter(Boolean).join(" · "),
      });
    } catch (error) {
      toast.error("Não foi possível atualizar", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const confirmarMigracao = async () => {
    if (!migrarDados) {
      return;
    }
    setMigrando(true);
    try {
      await syncReportToAuditor({ templateId, ...migrarDados });
      toast.success("Migrado para Respondidos à AlphaGeos", {
        description: [migrarDados.fac && `FV ${migrarDados.fac}`, migrarDados.os && `OS ${migrarDados.os}`]
          .filter(Boolean)
          .join(" · "),
      });
      setMigrarOpen(false);
      setMigrarDados(null);
    } catch (error) {
      toast.error("Não foi possível migrar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setMigrando(false);
    }
  };

  const handleNewReport = () => {
    window.localStorage.removeItem(CURRENT_DRAFT_KEY);
    savedSignature.current = "";
    setValues(getDefaultValues(template));
    setPhotos({});
    setObjeto(template.objeto ?? "");
    setObservacoes("");
    setGeotag({ enabled: false, defaults: emptyGeotag() });
    setCurrentDraftId(null);
    toast.success("Novo relatório em branco");
  };

  /** Zera o formulário (campos, fotos, legendas, observação e marca) sem apagar o rascunho salvo. */
  const handleClearReport = () => {
    setClearOpen(false);
    setValues(Object.fromEntries(template.fields.map((field) => [field.id, ""])));
    setPhotos({});
    setObjeto(template.objeto ?? "");
    setObservacoes("");
    setGeotag({ enabled: false, defaults: emptyGeotag() });
    setCurrentDraftId(null);
    savedSignature.current = "";
    window.localStorage.removeItem(CURRENT_DRAFT_KEY);
    toast.success("Relatório limpo para novo preenchimento");
  };

  const handleOpenDraft = (draft: ReportDraft) => {
    hydrateDraft(draft);
    window.localStorage.setItem(CURRENT_DRAFT_KEY, draft.id);
    savedSignature.current = draftSignature(draft);
    toast.success("Relatório carregado", { description: draft.name });
  };

  const handleDuplicateDraft = async (draft: ReportDraft) => {
    const now = new Date().toISOString();
    const saved = await saveReport({ ...draft, id: createId(), createdAt: now, updatedAt: now });
    if (saved) {
      toast.success("Relatório duplicado");
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    const removed = await removeReport(draftId);
    if (!removed) {
      return;
    }
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
      window.localStorage.removeItem(CURRENT_DRAFT_KEY);
    }
    toast.success("Relatório excluído da nuvem");
  };

  /**
   * Fluxo protegido: salva o relatório, gera o PDF, grava o arquivo e só então
   * aplica a retenção dos dois mais recentes. Qualquer falha preserva os antigos.
   */
  const esperarFolhas = async (limiteMs = 2500): Promise<boolean> => {
    const inicio = Date.now();
    while (Date.now() - inicio < limiteMs) {
      const portal = document.getElementById("print-portal");
      if (portal && portal.querySelector(".print-sheet")) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    return false;
  };

  /** A impressão usa as mesmas folhas do PDF: monta o portal, imprime e libera. */
  const handlePrint = async () => {
    setExporting(true);
    try {
      if (!(await esperarFolhas())) {
        toast.error("Não foi possível preparar as folhas para impressão.");
        return;
      }
      printReport();
    } finally {
      window.setTimeout(() => setExporting(false), 1000);
    }
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const draft = buildDraft(currentDraftId ?? undefined);
      const saved = await saveReport(draft);

      if (!saved) {
        toast.error("Relatório não foi salvo", {
          description: "O PDF não foi gerado e os relatórios anteriores foram mantidos.",
        });
        return;
      }

      setCurrentDraftId(saved.id);
      window.localStorage.setItem(CURRENT_DRAFT_KEY, saved.id);
      savedSignature.current = draftSignature(saved);

      const fileName = buildReportFileName(templateId, values);

      if (!(await esperarFolhas())) {
        throw new Error("Não foi possível preparar as folhas do relatório para o PDF.");
      }

      const result = await saveReportPdfFile(fileName);

      if (result === "cancelled") {
        toast.info("Download cancelado", {
          description: "Os relatórios anteriores foram mantidos.",
        });
        return;
      }

      // Pós 60: pergunta se o operador quer levar a FV/OS para "Respondidos".
      if (templateId.startsWith("pos_60") && (values.fac?.trim() || values.os?.trim())) {
        setMigrarDados({
          fac: values.fac ?? "",
          os: values.os ?? "",
          address: values.endereco ?? "",
          serviceType: values.servicoExda ?? "",
        });
        setMigrarOpen(true);
      }

      if (result === "unconfirmed") {
        const dentroDoPreview = !isFilePickerAvailable() && window.self !== window.top;
        toast.info("PDF gerado", {
          description: dentroDoPreview
            ? `${fileName} • a pré-visualização não permite escolher onde salvar. Se o arquivo não aparecer, abra o sistema em uma aba própria do navegador e gere novamente.`
            : `${fileName} • este navegador não confirma a gravação do arquivo, então os relatórios anteriores foram preservados.`,
        });
        return;
      }

      const pruned = await pruneExcess(2);
      toast.success("PDF salvo com sucesso", {
        description:
          pruned && pruned.deleted > 0
            ? `${fileName} • ${pruned.deleted} relatório(s) antigo(s) removido(s), mantendo os 2 mais recentes.`
            : `${fileName} • mantidos os 2 relatórios mais recentes.`,
      });
    } catch (error) {
      toast.error("Não foi possível gerar o PDF", {
        description:
          error instanceof Error
            ? `${error.message} Os relatórios anteriores foram mantidos.`
            : "Os relatórios anteriores foram mantidos.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          icon={FileText}
          title="Emissor de Relatórios de Vistoria"
          description="Escolha o modelo, preencha o cabeçalho e insira as fotos colando com Ctrl+V. A pré-visualização mostra a folha A4 exatamente como ela será impressa."
          chips={[
            { icon: Layers, label: template.shortTitle },
            { icon: FileText, label: `${pages} página(s)` },
            { icon: Images, label: `${filledPhotos} foto(s) inseridas` },
            {
              icon: MessageSquareText,
              label: observacoes.trim() ? "Observação preenchida" : "Sem observação",
            },
            { icon: MapPin, label: geotag.enabled ? "Marca de local ativa" : "Sem marca de local" },
          ]}
          actions={
            <>
              <Button type="button" variant="glass" onClick={handleNewReport}>
                <Plus className="h-4 w-4" />
                Novo relatório
              </Button>
              <Button
                type="button"
                variant="glass"
                onClick={() => void handleAtualizarDados()}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              <Button type="button" variant="glass" onClick={() => setClearOpen(true)}>
                <Eraser className="h-4 w-4" />
                Limpar relatório
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleSaveDraft()}>
                <Save className="h-4 w-4" />
                {currentDraftId ? "Atualizar rascunho" : "Salvar rascunho"}
              </Button>
            </>
          }
        />

        <div className="panel-glass flex items-start gap-2 rounded-xl px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            Os relatórios e as logos ficam salvos na nuvem e disponíveis para toda a equipe. Use "Baixar
            PDF" ou "Imprimir" para gerar o arquivo final.
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <TemplatePickerCard selectedId={templateId} onSelect={handleTemplateChange} />
            <ReportForm
              template={template}
              values={values}
              onValueChange={handleValueChange}
              objeto={objeto}
              onObjetoChange={setObjeto}
              observacoes={observacoes}
              onObservacoesChange={setObservacoes}
            />
            <InstitutionalHeaderForm settings={settings} onChange={updateSettings} />
            <PhotoSlotGrid
              slots={template.photoSlots}
              photos={photos}
              onChange={handlePhotoChange}
              geotag={geotag}
              onGeotagChange={setGeotag}
              enderecoPadrao={values.endereco}
            />
            <DraftsList
              drafts={drafts}
              currentId={currentDraftId}
              onOpen={handleOpenDraft}
              onDuplicate={(draft) => void handleDuplicateDraft(draft)}
              onDelete={(draftId) => void handleDeleteDraft(draftId)}
            />
          </div>

          <Card className="flex flex-col overflow-hidden lg:sticky lg:top-0">
            <span className="tech-strip absolute inset-x-0 top-0" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Pré-visualização A4</p>
                <p className="text-xs text-muted-foreground">
                  {pages} página(s) • {Math.round(scale * 100)}% de zoom
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-accent/70 text-accent-foreground">
                  {template.shortTitle}
                </Badge>
                <Button type="button" variant="glass" size="sm" onClick={() => void handlePrint()}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  variant="glow"
                  size="sm"
                  onClick={() => void handleDownload()}
                  disabled={exporting}
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar PDF
                </Button>
              </div>
            </div>

            <div ref={outerRef} className="scroll-slim max-h-[74vh] overflow-auto bg-glass/30 p-4">
              <div style={{ height: height > 0 ? `${height}px` : undefined }}>
                <div
                  ref={innerRef}
                  className="preview-stack w-[210mm] origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                >
                  {previewView}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={migrarOpen}
        onOpenChange={(open) => {
          setMigrarOpen(open);
          if (!open) {
            setMigrarDados(null);
          }
        }}
      >
        <DialogContent className="panel-glass rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base">Migrar para Respondidos?</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Relatório Pós 60 emitido
              {migrarDados?.fac || migrarDados?.os ? (
                <>
                  {" "}
                  (FV <strong>{migrarDados?.fac || "—"}</strong> · OS{" "}
                  <strong>{migrarDados?.os || "—"}</strong>)
                </>
              ) : null}
              . Deseja mover esta FV/OS para a célula{" "}
              <strong>Respondidos à AlphaGeos</strong> no Qualy Auditor, com a situação
              “Resposta enviada”?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMigrarOpen(false);
                setMigrarDados(null);
              }}
              disabled={migrando}
            >
              Agora não
            </Button>
            <Button type="button" variant="glow" onClick={() => void confirmarMigracao()} disabled={migrando}>
              {migrando ? "Migrando..." : "Migrar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="panel-glass rounded-2xl sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base">Limpar relatório</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Deseja limpar os dados deste relatório e iniciar um novo? Verifique se suas alterações
              foram salvas antes de continuar. O relatório salvo anteriormente permanece na lista de
              relatórios salvos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setClearOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="glow" onClick={handleClearReport}>
              <Eraser className="h-4 w-4" />
              Limpar e iniciar novo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {exporting && <PrintPortal>{documentView}</PrintPortal>}
    </>
  );
}
