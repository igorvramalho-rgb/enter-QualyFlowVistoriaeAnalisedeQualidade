import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isImageFile, fileToCompressedDataUrl } from "@/lib/image";
import type { PhotoEntry, PhotoMap } from "@/lib/report-document";
import type { ReportPhotoSlot } from "@/lib/report-templates";
import { cn } from "@/lib/utils";

interface PhotoSlotGridProps {
  slots: ReportPhotoSlot[];
  photos: PhotoMap;
  onChange: (slotId: string, entry: PhotoEntry | null) => void;
}

/**
 * Campos de foto do relatório: colar com Ctrl+V, arrastar o arquivo ou clicar
 * para selecionar. As imagens são recomprimidas antes de entrar no relatório.
 */
export function PhotoSlotGrid({ slots, photos, onChange }: PhotoSlotGridProps) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const handleFile = useCallback(
    async (slotId: string, file: File) => {
      if (!isImageFile(file)) {
        toast.error("Arquivo não suportado", {
          description: "Use uma imagem (JPG, PNG, WEBP) para o campo de foto.",
        });
        return;
      }

      setProcessingId(slotId);
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        onChange(slotId, { dataUrl, include: true });
        toast.success("Foto inserida no relatório", { description: file.name });
      } catch (error) {
        toast.error("Não foi possível processar a imagem", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setProcessingId(null);
      }
    },
    [onChange],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const file = Array.from(items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .find((candidate): candidate is File => Boolean(candidate));

      if (!file) {
        return;
      }

      event.preventDefault();
      const target =
        activeSlotId ??
        slots.find((slot) => !photosRef.current[slot.id]?.dataUrl)?.id ??
        slots[0]?.id;

      if (target) {
        setActiveSlotId(target);
        void handleFile(target, file);
      }
    },
    [activeSlotId, handleFile, slots],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    multiple: false,
    noClick: true,
    onDrop: (accepted) => {
      const file = accepted[0];
      if (!file) {
        return;
      }
      const target =
        activeSlotId ?? slots.find((slot) => !photosRef.current[slot.id]?.dataUrl)?.id ?? slots[0]?.id;
      if (target) {
        void handleFile(target, file);
      }
    },
  });

  usePasteListener(handlePaste);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border border-dashed p-3 transition-smooth",
        isDragActive
          ? "border-primary bg-accent/40 shadow-glow"
          : "border-glass-border/60 bg-glass/30",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">3. Fotos do relatório</h2>
          <p className="text-xs text-muted-foreground">
            Clique em um campo e use Ctrl+V para colar, arraste a imagem ou use o botão.
          </p>
        </div>
        <span className="chip-tech">
          <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
          Ctrl+V direto da vistoria
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => {
          const photo = photos[slot.id];
          const isActive = activeSlotId === slot.id;
          const isProcessing = processingId === slot.id;

          return (
            <div
              key={slot.id}
              onClick={() => setActiveSlotId(slot.id)}
              className={cn(
                "panel-glass flex flex-col gap-2 rounded-xl p-3 transition-smooth",
                isActive && "border-primary/70 shadow-glow",
                photo && !photo.include && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                    <span className="glow-dot glow-dot--primary" aria-hidden />
                    Foto {index + 1}
                  </p>
                  <p className="truncate text-xs font-medium text-foreground" title={slot.caption}>
                    {slot.caption}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={photo?.include ?? slot.includeByDefault}
                    onCheckedChange={(checked) =>
                      onChange(slot.id, photo ? { ...photo, include: checked } : null)
                    }
                    aria-label={`Incluir ${slot.caption} na impressão`}
                  />
                </div>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
                {isProcessing ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : photo?.dataUrl ? (
                  <img src={photo.dataUrl} alt={slot.caption} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px]">Sem imagem</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <DropzoneButton
                  onFile={(file) => void handleFile(slot.id, file)}
                  active={isActive}
                  onActivate={() => setActiveSlotId(slot.id)}
                  hasPhoto={Boolean(photo?.dataUrl)}
                />
                {photo?.dataUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(slot.id, null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DropzoneButtonProps {
  onFile: (file: File) => void;
  active: boolean;
  onActivate: () => void;
  hasPhoto: boolean;
}

function DropzoneButton({ onFile, active, onActivate, hasPhoto }: DropzoneButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onActivate();
            onFile(file);
          }
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={active ? "glow" : "glass"}
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
          inputRef.current?.click();
        }}
      >
        <ImagePlus className="h-4 w-4" />
        {hasPhoto ? "Substituir" : "Inserir foto"}
      </Button>
    </>
  );
}

function usePasteListener(handler: (event: ClipboardEvent) => void) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: ClipboardEvent) => handlerRef.current(event);
    document.addEventListener("paste", listener);
    return () => document.removeEventListener("paste", listener);
  }, []);
}
