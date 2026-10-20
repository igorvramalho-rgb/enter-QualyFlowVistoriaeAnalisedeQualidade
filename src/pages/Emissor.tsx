import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Images,
  Info,
  Layers,
  Loader2,
  MessageSquareText,
  Plus,
  Printer,
  Save,
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
import { toast } from "@/components/ui/sonner";
import { useCloudReports, useCloudSettings } from "@/hooks/use-cloud-data";
import { useScaledContainer } from "@/hooks/use-scaled-container";
import {
  countFilledPhotos,
  draftLabel,
  includedSlots,
  type PhotoEntry,
  type PhotoMap,
  type QualyflowSettings,
  migrateDraftValues,
  normalizeSettings,
  type ReportDraft,
  type ReportValues,
} from "@/lib/report-document";
import { buildReportFileName, downloadReportPdf, printReport } from "@/lib/report-export";
import {
  getDefaultValues,
  getTemplate,
  mergeValuesForTemplate,
  REPORT_TEMPLATES,
} from "@/lib/report-templates";
import { createId } from "@/lib/storage";

const FIRST_TEMPLATE = REPORT_TEMPLATES[0];

export default function Emissor() {
  const { settings, update: updateSettings } = useCloudSettings();
  const { drafts, save: saveReport, remove: removeReport } = useCloudReports();

  const [templateId, setTemplateId] = useState<string>(FIRST_TEMPLATE.id);
  const [values, setValues] = useState<ReportValues>(() => getDefaultValues(FIRST_TEMPLATE));
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [objeto, setObjeto] = useState<string>(FIRST_TEMPLATE.objeto ?? "");
  const [observacoes, setObservacoes] = useState<string>("");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
    setTemplateId(nextId);
  };

  const handleValueChange = (fieldId: string, value: string) => {
    setValues((previous) => ({ ...previous, [fieldId]: value }));
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

  const handleSaveDraft = async () => {
    const now = new Date().toISOString();
    const existing = currentDraftId
      ? drafts.find((draft) => draft.id === currentDraftId)
      : undefined;

    const draft: ReportDraft = {
      id: currentDraftId ?? createId(),
      name: draftLabel(templateId, values),
      templateId,
      values,
      photos,
      objeto,
      observacoes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const saved = await saveReport(draft);
    if (!saved) {
      return;
    }

    setCurrentDraftId(saved.id);
    toast.success(existing ? "Rascunho atualizado na nuvem" : "Relatório salvo na nuvem", {
      description: draft.name,
    });
  };

  const handleNewReport = () => {
    setValues(getDefaultValues(template));
    setPhotos({});
    setObjeto(template.objeto ?? "");
    setObservacoes("");
    setCurrentDraftId(null);
    toast.success("Novo relatório em branco");
  };

  const handleOpenDraft = (draft: ReportDraft) => {
    const draftTemplate = getTemplate(draft.templateId);
    setTemplateId(draftTemplate.id);
    setValues({ ...getDefaultValues(draftTemplate), ...migrateDraftValues(draft.values) });
    setPhotos(draft.photos ?? {});
    setObjeto(draft.objeto ?? draftTemplate.objeto ?? "");
    setObservacoes(draft.observacoes ?? "");
    setCurrentDraftId(draft.id);
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
    }
    toast.success("Relatório excluído da nuvem");
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadReportPdf(buildReportFileName(templateId, values));
      toast.success("PDF gerado com sucesso");
    } catch (error) {
      toast.error("Não foi possível gerar o PDF", {
        description:
          error instanceof Error
            ? `${error.message} Você também pode usar o botão Imprimir e escolher "Salvar como PDF".`
            : "Use o botão Imprimir e escolha \"Salvar como PDF\".",
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
          ]}
          actions={
            <>
              <Button type="button" variant="glass" onClick={handleNewReport}>
                <Plus className="h-4 w-4" />
                Novo relatório
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
            <PhotoSlotGrid slots={template.photoSlots} photos={photos} onChange={handlePhotoChange} />
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
                <Button type="button" variant="glass" size="sm" onClick={printReport}>
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
                  {documentView}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <PrintPortal>{documentView}</PrintPortal>
    </>
  );
}
