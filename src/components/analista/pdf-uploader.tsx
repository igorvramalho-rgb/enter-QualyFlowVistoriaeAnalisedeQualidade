import { FileUp, Loader2, ShieldAlert } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MAX_PAGES } from "@/lib/analysis";
import { cn } from "@/lib/utils";

export interface UploadProgress {
  fileName: string;
  page: number;
  total: number;
  fileIndex: number;
  fileCount: number;
}

interface PdfUploaderProps {
  onFiles: (files: File[]) => void;
  busy: boolean;
  progress: UploadProgress | null;
}

export function PdfUploader({ onFiles, busy, progress }: PdfUploaderProps) {
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
      {...getRootProps()}
      className={cn(
        "cursor-pointer border-2 border-dashed bg-card/70 p-6 text-center transition-smooth",
        isDragActive ? "border-primary bg-accent/50" : "border-border hover:border-primary/60",
        busy && "cursor-wait opacity-80",
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-2">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl",
            busy ? "bg-muted text-muted-foreground" : "brand-gradient text-primary-foreground",
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>

        {busy && progress ? (
          <div className="w-full max-w-md space-y-2">
            <p className="text-sm font-medium text-foreground">
              Analisando {progress.fileName} ({progress.fileIndex}/{progress.fileCount})
            </p>
            <Progress value={percent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Lendo página {progress.page} de {progress.total}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              Arraste os PDFs de vistoria ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Até {MAX_PAGES} páginas por arquivo. Vários arquivos podem ser importados de uma vez.
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-warning" />
              PDFs digitalizados sem texto entram como "Pendente de revisão" para conferência manual.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
