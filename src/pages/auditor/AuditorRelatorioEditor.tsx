import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ImagePlus, Loader2, Save, Send, Trash2 } from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { PrintPortal } from "@/components/report/print-portal";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useCloudSettings } from "@/hooks/use-cloud-data";
import { useScaledContainer } from "@/hooks/use-scaled-container";
import {
  fetchCase,
  fetchReportForCase,
  markReportSent,
  saveReport,
  type AuditorCase,
} from "@/lib/auditor";
import { fileToCompressedDataUrl } from "@/lib/image";
import { signPhotoUrls, uploadPhoto } from "@/lib/photo-storage";
import { saveReportPdfFile } from "@/lib/report-export";
import { getTemplate, type ReportTemplateId } from "@/lib/report-templates";
import type { PhotoEntry, PhotoMap, ReportValues } from "@/lib/report-document";
import { formatDateBR } from "@/lib/fields";

const MODELS: { id: ReportTemplateId; label: string }[] = [
  { id: "pos_60_passeio", label: "Devolutiva Pós 60 — Passeio" },
  { id: "pos_60_via", label: "Devolutiva Pós 60 — Via" },
  { id: "sgz_156", label: "Demanda SGZ-156" },
];

function sugestao(caso: AuditorCase | null): ReportTemplateId {
  const servico = (caso?.serviceType ?? "").toLowerCase();
  if (servico.includes("passeio")) return "pos_60_passeio";
  if (servico.includes("via") || servico.includes("asfal")) return "pos_60_via";
  return "pos_60_passeio";
}

export default function AuditorRelatorioEditor() {
  const { caseId = "" } = useParams();
  const { settings } = useCloudSettings();
  const { outerRef, innerRef, scale, height } = useScaledContainer(794);
  const [caso, setCaso] = useState<AuditorCase | null>(null);
  const [templateId, setTemplateId] = useState<ReportTemplateId>("pos_60_passeio");
  const [values, setValues] = useState<ReportValues>({});
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [justification, setJustification] = useState("");
  const [observations, setObservations] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await fetchCase(caseId);
      setCaso(found);
      if (!found) return;

      const report = await fetchReportForCase(caseId);
      const model = (report?.templateId as ReportTemplateId) || sugestao(found);
      setTemplateId(model);
      setJustification(report?.justification ?? "");
      setObservations(report?.observations ?? "");
      setSentAt(report?.sentAt ?? null);

      const base: ReportValues = {
        fac: found.fac,
        os: found.os,
        endereco: found.address,
        polo: found.locality,
        contratada: found.contractor,
        servicoExda: found.serviceType,
        ...((report?.values ?? {}) as ReportValues),
      };
      setValues(base);

      const salvos = (report?.photos ?? {}) as PhotoMap;
      const caminhos = Object.values(salvos)
        .map((entry) => entry?.path)
        .filter((path): path is string => Boolean(path));
      const assinados = caminhos.length > 0 ? await signPhotoUrls(caminhos) : {};

      setPhotos(
        Object.fromEntries(
          Object.entries(salvos).map(([slot, entry]) => [
            slot,
            {
              ...entry,
              dataUrl: entry.path ? assinados[entry.path] ?? "" : entry.dataUrl ?? "",
              include: entry.include !== false,
            } as PhotoEntry,
          ]),
        ),
      );
    } catch (problem) {
      toast.error("Não foi possível carregar o relatório", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const template = useMemo(() => getTemplate(templateId), [templateId]);
  const slots = template.photoSlots;

  const anexar = async (slotId: string, file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      const uploaded = await uploadPhoto(dataUrl);
      setPhotos((previous) => ({
        ...previous,
        [slotId]: {
          dataUrl: uploaded.url,
          path: uploaded.path,
          include: true,
          caption: previous[slotId]?.caption,
        },
      }));
      toast.success("Foto anexada");
    } catch (problem) {
      toast.error("Falha ao anexar a foto", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const salvar = async (enviar = false) => {
    setBusy(true);
    try {
      // Guarda apenas o essencial: caminho, legenda e inclusão (sem base64).
      const compacto = Object.fromEntries(
        Object.entries(photos).map(([slot, entry]) => [
          slot,
          { dataUrl: "", include: entry.include, caption: entry.caption, path: entry.path },
        ]),
      );

      await saveReport({
        caseId,
        templateId,
        values,
        photos: compacto,
        justification,
        observations,
        status: enviar ? "enviado" : "rascunho",
      });

      if (enviar) {
        await markReportSent(caseId);
        setSentAt(new Date().toISOString());
      }
      toast.success(enviar ? "Resposta registrada como enviada" : "Rascunho salvo");
      await load();
    } catch (problem) {
      toast.error("Falha ao salvar", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const gerarPdf = async () => {
    setBusy(true);
    try {
      const nome = `auditor-fv-${caso?.fac || "sem"}-os-${caso?.os || "sem"}.pdf`;
      const result = await saveReportPdfFile(nome);
      toast.success(result === "unconfirmed" ? "PDF gerado (download sem confirmação)" : "PDF gerado", {
        description: nome,
      });
    } catch (problem) {
      toast.error("Não foi possível gerar o PDF", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AuditorShell>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      </AuditorShell>
    );
  }

  return (
    <AuditorShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/auditor/caso/${caseId}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar à tratativa
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="glass" size="sm" onClick={() => void salvar(false)} disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Salvar rascunho
          </Button>
          <Button type="button" variant="glow" size="sm" onClick={() => void gerarPdf()} disabled={busy}>
            <Download className="h-3.5 w-3.5" />
            Gerar PDF oficial
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Relatório de resposta</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Usa o mesmo modelo oficial do Emissor. FV {caso?.fac || "—"} · OS {caso?.os || "—"} ·{" "}
          {caso?.address || "endereço não informado"}
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-muted-foreground">
            Modelo oficial
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value as ReportTemplateId)}
              className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            Data
            <Input
              value={values.data ?? ""}
              onChange={(event) => setValues({ ...values, data: event.target.value })}
              placeholder="dd/mm/aaaa"
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Nº FAC
            <Input
              value={values.fac ?? ""}
              onChange={(event) => setValues({ ...values, fac: event.target.value })}
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            OS
            <Input
              value={values.os ?? ""}
              onChange={(event) => setValues({ ...values, os: event.target.value })}
              className="mt-0.5 h-8 text-xs"
            />
          </label>
          <label className="text-[11px] text-muted-foreground sm:col-span-2">
            Endereço
            <Input
              value={values.endereco ?? ""}
              onChange={(event) => setValues({ ...values, endereco: event.target.value })}
              className="mt-0.5 h-8 text-xs"
            />
          </label>
        </div>

        <label className="mt-2 block text-[11px] text-muted-foreground">
          Justificativa técnica (não impressa no modelo oficial)
          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            className="mt-0.5 min-h-16 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
          />
        </label>
        <label className="mt-2 block text-[11px] text-muted-foreground">
          Observação impressa na folha
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            className="mt-0.5 min-h-14 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
          />
        </label>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Fotos do modelo ({slots.filter((slot) => photos[slot.id]?.dataUrl).length}/{slots.length})
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Cada campo do modelo oficial recebe a foto do fiscal correspondente.
        </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => {
            const entry = photos[slot.id];
            return (
              <div key={slot.id} className="rounded-lg border border-border/60 p-2">
                <p className="text-[11px] font-medium text-foreground">{slot.caption}</p>
                <p className="text-[10px] text-muted-foreground">{slot.hint}</p>

                {entry?.dataUrl ? (
                  <img src={entry.dataUrl} alt="" className="mt-1 h-28 w-full rounded object-cover" />
                ) : (
                  <div className="mt-1 flex h-28 items-center justify-center rounded bg-muted/50 text-[10px] text-muted-foreground">
                    sem foto
                  </div>
                )}

                <div className="mt-1 flex gap-1">
                  <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded border border-input px-2 text-[10px] text-foreground">
                    <ImagePlus className="h-3 w-3" />
                    anexar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void anexar(slot.id, event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Input
                    value={entry?.caption ?? ""}
                    placeholder="legenda"
                    onChange={(event) =>
                      setPhotos((previous) => ({
                        ...previous,
                        [slot.id]: {
                          ...(previous[slot.id] ?? { dataUrl: "", include: true }),
                          caption: event.target.value,
                        },
                      }))
                    }
                    className="h-7 text-[11px]"
                  />
                  {entry?.dataUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1"
                      onClick={() =>
                        setPhotos((previous) => {
                          const next = { ...previous };
                          delete next[slot.id];
                          return next;
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Envio</h2>
            <p className="text-[11px] text-muted-foreground">
              {sentAt ? `Enviado em ${formatDateBR(sentAt)}` : "Ainda não enviado"}
            </p>
          </div>
          <Button type="button" variant="glow" size="sm" onClick={() => void salvar(true)} disabled={busy}>
            <Send className="h-3.5 w-3.5" />
            Marcar como enviado
          </Button>
        </div>
      </Card>

      <Card className="p-3">
        <h2 className="text-sm font-semibold text-foreground">Prévia do modelo oficial</h2>
        <p className="mb-2 text-[11px] text-muted-foreground">
          A mesma folha A4 que vai para o PDF.
        </p>
        <div ref={outerRef} className="scroll-slim max-h-[70vh] overflow-auto rounded-lg bg-muted/30 p-3">
          <div style={{ height: height > 0 ? `${height}px` : undefined }}>
            <div
              ref={innerRef}
              className="preview-stack w-[210mm] origin-top-left"
              style={{ transform: `scale(${scale})` }}
            >
              <ReportDocumentView
                templateId={templateId}
                values={values}
                photos={photos}
                objeto={caso?.serviceType}
                observacoes={observations}
                settings={settings}
              />
            </div>
          </div>
        </div>
      </Card>

      <PrintPortal>
        <ReportDocumentView
          templateId={templateId}
          values={values}
          photos={photos}
          objeto={caso?.serviceType}
          observacoes={observations}
          settings={settings}
        />
      </PrintPortal>
    </AuditorShell>
  );
}
