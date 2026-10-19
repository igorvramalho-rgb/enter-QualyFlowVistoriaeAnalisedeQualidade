import { useMemo, useState } from "react";
import { Activity, BarChart3, DatabaseZap, FileCheck2, Info, Loader2, Tags } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import {
  NcTypeChart,
  PoloChart,
  StatusChart,
  type NcTypeDatum,
  type PoloDatum,
  type StatusDatum,
} from "@/components/analista/charts";
import { KpiCards } from "@/components/analista/kpi-cards";
import { PdfUploader, type UploadProgress } from "@/components/analista/pdf-uploader";
import { ReviewDialog } from "@/components/analista/review-dialog";
import { VistoriasTable } from "@/components/analista/vistorias-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { normalizeNcType, type AnalysisRecord } from "@/lib/analysis";
import { lastAnalysisLabel } from "@/lib/analysis-summary";
import { STORAGE_KEYS } from "@/lib/storage";

const STATUS_COLORS: Record<string, string> = {
  conforme: "hsl(var(--success))",
  nao_conforme: "hsl(var(--destructive))",
  em_andamento: "hsl(var(--warning))",
  pendente: "hsl(var(--muted-foreground))",
};

const STATUS_ORDER = ["conforme", "em_andamento", "nao_conforme", "pendente"] as const;

const STATUS_NAMES: Record<string, string> = {
  conforme: "Conforme",
  nao_conforme: "Não Conforme",
  em_andamento: "Em Andamento",
  pendente: "Pendente de revisão",
};

export default function Analista() {
  const [analyses, setAnalyses] = useLocalStorage<AnalysisRecord[]>(STORAGE_KEYS.analyses, []);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [reviewing, setReviewing] = useState<AnalysisRecord | null>(null);
  const [clearing, setClearing] = useState(false);

  const poloData = useMemo<PoloDatum[]>(() => {
    const map = new Map<string, PoloDatum>();
    analyses.forEach((item) => {
      const polo = item.fields.polo?.trim() || "Não informado";
      const entry = map.get(polo) ?? { polo, conforme: 0, emAndamento: 0, naoConforme: 0, total: 0 };
      entry.total += 1;
      if (item.status === "conforme") {
        entry.conforme += 1;
      } else if (item.status === "em_andamento") {
        entry.emAndamento += 1;
      } else if (item.status === "nao_conforme") {
        entry.naoConforme += 1;
      }
      map.set(polo, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [analyses]);

  const statusData = useMemo<StatusDatum[]>(
    () =>
      STATUS_ORDER.map((status) => ({
        key: status,
        label: STATUS_NAMES[status],
        total: analyses.filter((item) => item.status === status).length,
        color: STATUS_COLORS[status],
      })),
    [analyses],
  );

  const ncTypeData = useMemo<NcTypeDatum[]>(() => {
    const map = new Map<string, number>();
    analyses.forEach((item) => {
      const tipo = normalizeNcType(item.fields.tipoNaoConformidade);
      if (tipo) {
        map.set(tipo, (map.get(tipo) ?? 0) + 1);
      }
    });

    const sorted = Array.from(map.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total);

    if (sorted.length <= 8) {
      return sorted;
    }

    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8).reduce((sum, item) => sum + item.total, 0);
    return [...top, { tipo: "OUTROS TIPOS", total: rest }];
  }, [analyses]);

  const tiposNcDistintos = ncTypeData.filter((item) => item.tipo !== "OUTROS TIPOS").length;

  const handleFiles = async (files: File[]) => {
    setBusy(true);
    const added: AnalysisRecord[] = [];
    let duplicates = 0;
    let failed = 0;

    try {
      const { analyzePdfFile } = await import("@/lib/pdf-extract");
      const known = new Set(analyses.map((item) => item.fingerprint));

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress({
          fileName: file.name,
          page: 0,
          total: 0,
          fileIndex: index + 1,
          fileCount: files.length,
        });

        try {
          const record = await analyzePdfFile(file, (page, total) => {
            setProgress((previous) => (previous ? { ...previous, page, total } : previous));
          });

          if (known.has(record.fingerprint)) {
            duplicates += 1;
            continue;
          }

          known.add(record.fingerprint);
          added.push(record);
        } catch (error) {
          failed += 1;
          toast.error(`Falha ao analisar ${file.name}`, {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }

    if (added.length > 0) {
      setAnalyses((previous) => [...added, ...previous]);
      toast.success(
        added.length === 1 ? "Vistoria analisada" : `${added.length} vistorias analisadas`,
        {
          description: [
            duplicates > 0 ? `${duplicates} já constavam na base` : null,
            failed > 0 ? `${failed} com falha de leitura` : null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined,
        },
      );
      return;
    }

    if (duplicates > 0 && failed === 0) {
      toast.info("Nenhum arquivo novo", {
        description: "Todos os PDFs enviados já foram analisados anteriormente.",
      });
    }
  };

  const handleSaveReview = (record: AnalysisRecord) => {
    setAnalyses((previous) => previous.map((item) => (item.id === record.id ? record : item)));
    toast.success("Dados revisados e salvos");
  };

  const handleDelete = (recordId: string) => {
    setAnalyses((previous) => previous.filter((item) => item.id !== recordId));
    toast.success("Registro removido da análise");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Analista de Vistorias"
        description="Importe os PDFs de vistoria, confira os dados extraídos e acompanhe os indicadores de qualidade por polo, situação e tipo de não conformidade."
        chips={
          analyses.length > 0
            ? [
                { icon: FileCheck2, label: `${analyses.length} vistorias` },
                { icon: Tags, label: `${tiposNcDistintos} tipos de NC` },
                { icon: Activity, label: lastAnalysisLabel(analyses) },
              ]
            : undefined
        }
        actions={
          analyses.length > 0 ? (
            <Button
              type="button"
              variant={clearing ? "destructive" : "glass"}
              onClick={() => {
                if (!clearing) {
                  setClearing(true);
                  toast.warning("Clique novamente para limpar a base de análise");
                  return;
                }
                setAnalyses([]);
                setClearing(false);
                toast.success("Base de análise limpa");
              }}
            >
              {clearing ? "Confirmar limpeza" : "Limpar base"}
            </Button>
          ) : undefined
        }
      />

      <div className="panel-glass flex items-start gap-2 rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p>
          A leitura roda no seu navegador e nada é enviado para servidores. PDFs digitalizados (sem
          camada de texto) entram como "Pendente de revisão" para conferência manual.
        </p>
      </div>

      <PdfUploader onFiles={(files) => void handleFiles(files)} busy={busy} progress={progress} />

      {analyses.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 border-dashed border-glass-border/60 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <DatabaseZap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Nenhuma vistoria analisada ainda</h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Importe o primeiro PDF de vistoria para gerar os indicadores: total de vistorias,
              percentual de conclusão, não conformidades e distribuição por polo.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <KpiCards analyses={analyses} />

          <div className="grid gap-4 xl:grid-cols-2">
            <PoloChart data={poloData} />
            <StatusChart data={statusData} />
          </div>

          <NcTypeChart data={ncTypeData} />

          <VistoriasTable analyses={analyses} onReview={setReviewing} onDelete={handleDelete} />
        </>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Processando os arquivos selecionados...
        </p>
      )}

      <ReviewDialog
        record={reviewing}
        onOpenChange={(open) => {
          if (!open) {
            setReviewing(null);
          }
        }}
        onSave={handleSaveReview}
      />
    </div>
  );
}
