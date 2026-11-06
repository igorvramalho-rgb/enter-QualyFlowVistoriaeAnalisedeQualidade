import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ImagePlus, Loader2, Save, Send, Trash2 } from "lucide-react";
import { AuditorShell } from "@/components/auditor/auditor-shell";
import { PrintPortal } from "@/components/report/print-portal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  fetchCase,
  fetchCaseItems,
  fetchReportForCase,
  markReportSent,
  saveReport,
  type AuditorCase,
  type AuditorCaseItem,
} from "@/lib/auditor";
import { fileToCompressedDataUrl } from "@/lib/image";
import { signPhotoUrls, uploadPhoto } from "@/lib/photo-storage";
import { saveReportPdfFile } from "@/lib/report-export";
import { formatDateBR } from "@/lib/fields";

interface GalleryItem {
  path: string;
  caption: string;
  code: string;
}

const TEMPLATES = [
  { id: "pos_60_passeio", label: "Devolutiva Pós 60 — Passeio" },
  { id: "pos_60_via", label: "Devolutiva Pós 60 — Via" },
  { id: "sgz_156", label: "Demanda SGZ-156" },
];

export default function AuditorRelatorioEditor() {
  const { caseId = "" } = useParams();
  const [caso, setCaso] = useState<AuditorCase | null>(null);
  const [items, setItems] = useState<AuditorCaseItem[]>([]);
  const [templateId, setTemplateId] = useState("pos_60_passeio");
  const [justification, setJustification] = useState("");
  const [observations, setObservations] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sentAt, setSentAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = await fetchCase(caseId);
      setCaso(found);
      if (!found) return;

      const listaItens = await fetchCaseItems(found.documentId);
      setItems(listaItens);

      const report = await fetchReportForCase(caseId);
      if (report) {
        setTemplateId(report.templateId || "pos_60_passeio");
        setJustification(report.justification);
        setObservations(report.observations);
        setSentAt(report.sentAt);
        const fotos = (report.photos as { gallery?: GalleryItem[] })?.gallery ?? [];
        setGallery(fotos);
        const signed = await signPhotoUrls(fotos.map((foto) => foto.path));
        setUrls(signed);
      }
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

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const novas: GalleryItem[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await fileToCompressedDataUrl(file);
        const uploaded = await uploadPhoto(dataUrl);
        novas.push({ path: uploaded.path, caption: "", code: "" });
        setUrls((previous) => ({ ...previous, [uploaded.path]: uploaded.url }));
      }
      setGallery((previous) => [...previous, ...novas]);
      toast.success(`${novas.length} foto(s) anexada(s)`);
    } catch (problem) {
      toast.error("Falha ao anexar foto", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const salvar = async (enviar = false) => {
    setBusy(true);
    try {
      await saveReport({
        caseId,
        templateId,
        values: {},
        photos: { gallery },
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
      if (result === "cancelled") {
        toast.info("Geração cancelada");
      } else {
        toast.success("PDF gerado", {
          description: result === "unconfirmed" ? `${nome} (download sem confirmação)` : nome,
        });
      }
    } catch (problem) {
      toast.error("Não foi possível gerar o PDF", {
        description: problem instanceof Error ? problem.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const avaliadas = useMemo(
    () =>
      items.filter(
        (item) => item.internalResult === "conforme" || item.internalResult === "nao_conforme",
      ),
    [items],
  );

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
            Gerar PDF
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Resposta à AlphaGeos</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          FV {caso?.fac || "—"} · OS {caso?.os || "—"} · {caso?.address || "endereço não informado"}
        </p>

        <label className="mt-3 block text-[11px] text-muted-foreground">
          Modelo
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="mt-0.5 h-8 w-full rounded-md border border-input bg-background/70 px-2 text-xs"
          >
            {TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-2 block text-[11px] text-muted-foreground">
          Justificativa técnica
          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            className="mt-0.5 min-h-20 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
          />
        </label>

        <label className="mt-2 block text-[11px] text-muted-foreground">
          Observações
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            className="mt-0.5 min-h-14 w-full rounded-md border border-input bg-background/70 px-2 py-1.5 text-xs text-foreground"
          />
        </label>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Fotografias ({gallery.length})</h2>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-[11px] text-foreground">
            <ImagePlus className="h-3.5 w-3.5" />
            Anexar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void addPhotos(event.target.files)}
            />
          </label>
        </div>

        {gallery.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border/70 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
            Nenhuma foto anexada. As imagens ficam no armazenamento privado e aparecem no PDF.
          </p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {gallery.map((foto, index) => (
              <div key={foto.path} className="rounded-lg border border-border/60 p-2">
                {urls[foto.path] ? (
                  <img src={urls[foto.path]} alt="" className="h-32 w-full rounded object-cover" />
                ) : (
                  <div className="h-32 w-full rounded bg-muted" />
                )}
                <div className="mt-1 flex gap-1">
                  <Input
                    value={foto.caption}
                    placeholder="Legenda"
                    onChange={(event) => {
                      const value = event.target.value;
                      setGallery((previous) =>
                        previous.map((item, position) =>
                          position === index ? { ...item, caption: value } : item,
                        ),
                      );
                    }}
                    className="h-7 text-[11px]"
                  />
                  <select
                    value={foto.code}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGallery((previous) =>
                        previous.map((item, position) =>
                          position === index ? { ...item, code: value } : item,
                        ),
                      );
                    }}
                    className="h-7 rounded border border-input bg-background px-1 text-[11px]"
                  >
                    <option value="">item</option>
                    {items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1"
                    onClick={() => setGallery((previous) => previous.filter((_, p) => p !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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

      <PrintPortal>
        <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
          <header className="border-b-2 border-slate-800 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-widest">Qualy Auditor — Inteligência de Fiscalização</p>
                <h1 className="text-[15px] font-bold">RESPOSTA À FISCALIZAÇÃO</h1>
              </div>
              <p className="text-[9px]">
                Criado por Igor Ramalho
              </p>
            </div>
          </header>

          <section className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px]">
            <p>
              <strong>Nº FAC:</strong> {caso?.fac || "—"}
            </p>
            <p>
              <strong>OS:</strong> {caso?.os || "—"}
            </p>
            <p className="col-span-2">
              <strong>Endereço:</strong> {caso?.address || "—"}
            </p>
            <p>
              <strong>Município:</strong> {caso?.municipality || "—"}
            </p>
            <p>
              <strong>Localidade:</strong> {caso?.locality || "—"}
            </p>
            <p>
              <strong>Serviço:</strong> {caso?.serviceType || "—"}
            </p>
            <p>
              <strong>Modelo:</strong> {TEMPLATES.find((t) => t.id === templateId)?.label ?? "—"}
            </p>
          </section>

          <section className="mt-3">
            <h2 className="text-[10px] font-bold uppercase">Itens avaliados</h2>
            <table className="mt-1 w-full border-collapse text-[8px]">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 px-1 py-0.5">Item</th>
                  <th className="border border-slate-300 px-1 py-0.5">Descritivo</th>
                  <th className="border border-slate-300 px-1 py-0.5">AlphaGeos</th>
                  <th className="border border-slate-300 px-1 py-0.5">Avaliação interna</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-slate-300 px-1 py-0.5">{item.code}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{item.description}</td>
                    <td className="border border-slate-300 px-1 py-0.5">{item.originalResult || "—"}</td>
                    <td className="border border-slate-300 px-1 py-0.5">
                      {item.internalResult === "conforme"
                        ? "Conforme"
                        : item.internalResult === "nao_conforme"
                          ? "Não conforme"
                          : item.internalResult === "na"
                            ? "Não se aplica"
                            : "Não avaliado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[8px]">
              {avaliadas.length} de {items.length} etapa(s) avaliada(s) internamente.
            </p>
          </section>

          {gallery.length > 0 && (
            <section className="mt-3">
              <h2 className="text-[10px] font-bold uppercase">Registro fotográfico</h2>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {gallery.map((foto) => (
                  <figure key={foto.path} className="break-inside-avoid">
                    {urls[foto.path] ? (
                      <img src={urls[foto.path]} alt="" className="h-[38mm] w-full object-cover" />
                    ) : (
                      <div className="h-[38mm] w-full bg-slate-200" />
                    )}
                    <figcaption className="text-[7px] leading-tight">
                      {foto.code ? `${foto.code} · ` : ""}
                      {foto.caption || "sem legenda"}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="mt-3 text-[9px]">
            <h2 className="text-[10px] font-bold uppercase">Justificativa técnica</h2>
            <p className="mt-0.5 whitespace-pre-wrap">{justification || "—"}</p>
            {observations && (
              <>
                <h2 className="mt-2 text-[10px] font-bold uppercase">Observações</h2>
                <p className="mt-0.5 whitespace-pre-wrap">{observations}</p>
              </>
            )}
          </section>

          <footer className="mt-auto border-t border-slate-300 pt-1 text-[8px]">
            <p>Qualy Auditor · Inteligência de Fiscalização · Criado por Igor Ramalho</p>
            <p>Emitido em {formatDateBR(new Date())}</p>
          </footer>
        </article>
      </PrintPortal>
    </AuditorShell>
  );
}
