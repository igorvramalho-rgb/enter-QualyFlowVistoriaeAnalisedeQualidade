import { FileUp, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { POLOS } from "@/lib/analysis";
import { cn } from "@/lib/utils";

export interface UploadProgress {
  fileName: string;
  page: number;
  total: number;
  fileIndex: number;
  fileCount: number;
  polo?: string;
}

export interface PoloSummary {
  polo: string;
  total: number;
  conforme: number;
  emAndamento: number;
  naoConforme: number;
  pendente: number;
}

interface PoloUploadGridProps {
  summaries: PoloSummary[];
  busy: boolean;
  progress: UploadProgress | null;
  onFiles: (files: File[], polo: string) => void;
}

/**
 * Um bloco por polo: o arquivo arrastado/solto no bloco recebe aquele polo na
 * análise, mantendo os dados separados por região.
 */
export function PoloUploadGrid({ summaries, busy, progress, onFiles }: PoloUploadGridProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Importar por polo</h2>
          <p className="text-xs text-muted-foreground">
            Solte cada PDF no bloco do polo correspondente — o polo é gravado no registro, mesmo que o
            PDF traga outro valor.
          </p>
        </div>
        <span className="chip-tech">
          <ShieldAlert className="h-3.5 w-3.5 text-warning" />
          Sem limite de páginas ou de arquivos
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {POLOS.map((polo) => {
          const summary =
            summaries.find((item) => item.polo === polo) ?? {
              polo,
              total: 0,
              conforme: 0,
              emAndamento: 0,
              naoConforme: 0,
              pendente: 0,
            };

          return (
            <PoloDropCard
              key={polo}
              summary={summary}
              busy={busy}
              progress={progress?.polo === polo ? progress : null}
              onFiles={(files) => onFiles(files, polo)}
            />
          );
        })}
      </div>
    </section>
  );
}

interface PoloDropCardProps {
  summary: PoloSummary;
  busy: boolean;
  progress: UploadProgress | null;
  onFiles: (files: File[]) => void;
}

function PoloDropCard({ summary, busy, progress, onFiles }: PoloDropCardProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: busy,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        onFiles(accepted);
      }
    },
  });

  const percent = progress && progress.total > 0 ? (progress.page / progress.total) * 100 : 0;

  return (
    <Card
      className={cn(
        "panel-interactive relative flex flex-col gap-3 overflow-hidden p-4",
        progress && "border-primary/70 shadow-glow",
      )}
    >
      <span className="tech-strip absolute inset-x-0 top-0" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="brand-gradient shadow-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <MapPin className="h-4 w-4 text-onbrand" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">{summary.polo}</p>
            <p className="text-xs text-muted-foreground">
              {summary.total} vistoria(s) neste polo
            </p>
          </div>
        </div>
        <span className="chip-tech font-mono">{summary.total}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="chip-tech">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {summary.conforme} conformes
        </span>
        <span className="chip-tech">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          {summary.emAndamento} em andamento
        </span>
        <span className="chip-tech">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          {summary.naoConforme} NC
        </span>
        {summary.pendente > 0 && (
          <span className="chip-tech">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            {summary.pendente} a revisar
          </span>
        )}
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-smooth",
          isDragActive
            ? "border-primary bg-accent/40 shadow-glow"
            : "border-glass-border/60 bg-glass/30 hover:border-primary/60",
          busy && "cursor-wait opacity-80",
        )}
      >
        <input {...getInputProps()} />

        {progress ? (
          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-foreground">
              Analisando {progress.fileName} ({progress.fileIndex}/{progress.fileCount})
            </p>
            <Progress value={percent} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">
              Página {progress.page} de {progress.total}
            </p>
          </div>
        ) : (
          <>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
            </span>
            <p className="text-xs font-semibold text-foreground">
              Arraste os PDFs deste polo
            </p>
            <p className="text-[11px] text-muted-foreground">ou clique para selecionar</p>
          </>
        )}
      </div>
    </Card>
  );
}
