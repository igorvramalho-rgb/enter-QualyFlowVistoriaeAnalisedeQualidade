import { useState } from "react";
import { ArrowLeft, Download, FileBarChart, Loader2, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { BiReportSheets } from "@/components/analista/bi-report";
import { PrintPortal } from "@/components/report/print-portal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import { useCloudAnalyses } from "@/hooks/use-cloud-data";
import { useScaledContainer } from "@/hooks/use-scaled-container";
import { downloadReportPdf, printReport } from "@/lib/report-export";

/** Relatório gerencial do Analista em folhas A4 (impressão e PDF). */
export default function RelatorioBi() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { analyses, loading } = useCloudAnalyses();
  const [exporting, setExporting] = useState(false);
  const { outerRef, innerRef, scale, height } = useScaledContainer(794);

  const generatedBy = profile
    ? `${profile.displayName || profile.username} (@${profile.username})`
    : undefined;

  const sheets = <BiReportSheets analyses={analyses} generatedBy={generatedBy} />;

  const handleDownload = async () => {
    setExporting(true);
    try {
      await downloadReportPdf(`relatorio-bi-qualyflow-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Relatório BI gerado em PDF");
    } catch (error) {
      toast.error("Não foi possível gerar o PDF", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          icon={FileBarChart}
          title="Relatório Gerencial — Analista BI"
          description="Resumo executivo da base de vistorias: indicadores, distribuição por polo e status, motivos de não conformidade e vistorias por data de avaliação."
          chips={[{ icon: FileBarChart, label: `${analyses.length} vistoria(s) na base` }]}
          actions={
            <>
              <Button type="button" variant="glass" onClick={() => navigate("/analista")}>
                <ArrowLeft className="h-4 w-4" />
                Voltar ao analista
              </Button>
              <Button type="button" variant="glass" onClick={printReport}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button
                type="button"
                variant="glow"
                onClick={() => void handleDownload()}
                disabled={exporting || loading}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar PDF
              </Button>
            </>
          }
        />

        <Card className="overflow-hidden">
          <span className="tech-strip absolute inset-x-0 top-0" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Pré-visualização A4</p>
              <p className="text-xs text-muted-foreground">
                2 páginas • {Math.round(scale * 100)}% de zoom
              </p>
            </div>
            <span className="chip-tech">Gerado a partir da base na nuvem</span>
          </div>

          <div ref={outerRef} className="scroll-slim max-h-[78vh] overflow-auto bg-glass/30 p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando a base...
              </div>
            ) : (
              <div style={{ height: height > 0 ? `${height}px` : undefined }}>
                <div
                  ref={innerRef}
                  className="preview-stack w-[210mm] origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                >
                  {sheets}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Porta de impressão: o mesmo mecanismo do Emissor, com as folhas do BI */}
      <PrintPortal>{analyses.length > 0 ? sheets : null}</PrintPortal>
    </>
  );
}
