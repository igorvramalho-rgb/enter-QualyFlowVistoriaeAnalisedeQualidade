import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImagePlus, Loader2, MapPin, RotateCcw, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { estimateDataUrlSize, fileToCompressedDataUrl, isImageFile } from "@/lib/image";
import { formatBytes } from "@/lib/fields";
import { formatCoordinates, nowStamp, readPhotoGps, type GeotagData } from "@/lib/geotag";
import type { GeotagSettings, PhotoEntry, PhotoMap } from "@/lib/report-document";
import type { ReportPhotoSlot } from "@/lib/report-templates";
import { cn } from "@/lib/utils";

interface PhotoSlotGridProps {
  slots: ReportPhotoSlot[];
  photos: PhotoMap;
  onChange: (slotId: string, entry: PhotoEntry | null) => void;
  geotag: GeotagSettings;
  onGeotagChange: (next: GeotagSettings) => void;
  /** Endereço do relatório, usado como padrão da marca de local. */
  enderecoPadrao?: string;
}

const GEOTAG_FIELDS: { key: keyof GeotagData; label: string; placeholder: string }[] = [
  { key: "dataHora", label: "Data e hora", placeholder: "21/07/2026 15:07:42" },
  { key: "coordenadas", label: "Coordenadas", placeholder: "23,4932S 46,5915W" },
  { key: "endereco", label: "Endereço", placeholder: "176 Rua Monsenhor Arruda Câmara" },
  { key: "bairro", label: "Bairro", placeholder: "Vila Ede" },
  { key: "cidade", label: "Cidade", placeholder: "São Paulo" },
];

/**
 * Campos de foto do relatório: colar com Ctrl+V, arrastar o arquivo ou clicar
 * para selecionar, com legenda e marca de data/local (GPS) editáveis.
 */
export function PhotoSlotGrid({
  slots,
  photos,
  onChange,
  geotag,
  onGeotagChange,
  enderecoPadrao,
}: PhotoSlotGridProps) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const buildGeotag = useCallback(
    async (file: File): Promise<GeotagData | undefined> => {
      if (!geotag.enabled) {
        return undefined;
      }

      const gps = await readPhotoGps(file);
      return {
        dataHora: geotag.defaults.dataHora || nowStamp(),
        coordenadas: gps
          ? formatCoordinates(gps.latitude, gps.longitude)
          : geotag.defaults.coordenadas,
        endereco: geotag.defaults.endereco || enderecoPadrao || "",
        bairro: geotag.defaults.bairro,
        cidade: geotag.defaults.cidade || "São Paulo",
      };
    },
    [enderecoPadrao, geotag.defaults, geotag.enabled],
  );

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
        const stamp = await buildGeotag(file);
        onChange(slotId, {
          dataUrl,
          include: true,
          caption: photosRef.current[slotId]?.caption,
          geotag: stamp,
          showGeotag: geotag.enabled,
        });
        toast.success("Foto inserida no relatório", {
          description: stamp?.coordenadas ? `${file.name} • ${stamp.coordenadas}` : file.name,
        });
      } catch (error) {
        toast.error("Não foi possível processar a imagem", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setProcessingId(null);
      }
    },
    [buildGeotag, geotag.enabled, onChange],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const focused = event.target as HTMLElement | null;
      if (focused?.closest("input, textarea, [contenteditable='true']")) {
        return;
      }

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
        activeSlotId ?? slots.find((slot) => !photosRef.current[slot.id]?.dataUrl)?.id ?? slots[0]?.id;

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

  const filledCount = slots.filter((slot) => Boolean(photos[slot.id]?.dataUrl)).length;
  const totalBytes = slots.reduce(
    (sum, slot) => sum + (photos[slot.id]?.dataUrl ? estimateDataUrlSize(photos[slot.id].dataUrl) : 0),
    0,
  );
  const totalSizeLabel = formatBytes(totalBytes);
  const hasCustomCaptions = slots.some((slot) => Boolean(photos[slot.id]?.caption?.trim()));
  const comMarca = slots.filter(
    (slot) => photos[slot.id]?.dataUrl && photos[slot.id]?.showGeotag !== false && photos[slot.id]?.geotag,
  ).length;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border border-dashed p-3 transition-smooth",
        isDragActive ? "border-primary bg-accent/40 shadow-glow" : "border-glass-border/60 bg-glass/30",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">4. Fotos do relatório</h2>
          <p className="text-xs text-muted-foreground">
            Clique em um campo e use Ctrl+V para colar, arraste a imagem ou use o botão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="glass"
            size="sm"
            className="h-8"
            disabled={!hasCustomCaptions}
            onClick={() =>
              slots.forEach((slot) => {
                const entry = photos[slot.id];
                if (entry?.caption?.trim()) {
                  onChange(slot.id, { ...entry, caption: undefined });
                }
              })
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar legendas padrão
          </Button>
          <span className="chip-tech">
            <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
            Ctrl+V
          </span>
          <span className="chip-tech font-mono">{`${filledCount}/${slots.length} • ${totalSizeLabel}`}</span>
        </div>
      </div>

      {/* Marca de data/local (GPS) */}
      <div className="mb-3 rounded-xl border border-glass-border/50 bg-glass/30 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                geotag.enabled ? "brand-gradient text-onbrand shadow-glow" : "bg-muted text-muted-foreground",
              )}
            >
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium text-foreground">
                Marca de data e local (GPS) nas fotos
              </p>
              <p className="text-[11px] text-muted-foreground">
                Padrão das fotos de campo: data/hora, coordenadas, endereço, bairro e cidade — tudo
                editável. Use o botão para habilitar só quando precisar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {geotag.enabled && (
              <span className="chip-tech">{comMarca} foto(s) marcadas</span>
            )}
            <Switch
              checked={geotag.enabled}
              aria-label="Habilitar marca de data e local nas fotos"
              onCheckedChange={(checked) => onGeotagChange({ ...geotag, enabled: checked })}
            />
          </div>
        </div>

        {geotag.enabled && (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {GEOTAG_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label
                    htmlFor={`geo-${field.key}`}
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    {field.label}
                  </Label>
                  <Input
                    id={`geo-${field.key}`}
                    value={geotag.defaults[field.key]}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      onGeotagChange({
                        ...geotag,
                        defaults: { ...geotag.defaults, [field.key]: event.target.value },
                      })
                    }
                    className="h-8 bg-background/70 text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="glass"
                size="sm"
                className="h-8"
                onClick={() => {
                  onGeotagChange({
                    ...geotag,
                    defaults: { ...geotag.defaults, dataHora: nowStamp() },
                  });
                  toast.success("Data e hora atualizadas para agora");
                }}
              >
                Usar data e hora de agora
              </Button>
              <Button
                type="button"
                variant="glass"
                size="sm"
                className="h-8"
                onClick={() => {
                  slots.forEach((slot) => {
                    const entry = photos[slot.id];
                    if (entry?.dataUrl) {
                      onChange(slot.id, {
                        ...entry,
                        geotag: {
                          ...geotag.defaults,
                          endereco: geotag.defaults.endereco || enderecoPadrao || "",
                        },
                        showGeotag: true,
                      });
                    }
                  });
                  toast.success("Marca aplicada às fotos inseridas");
                }}
              >
                <MapPin className="h-3.5 w-3.5" />
                Aplicar às fotos inseridas
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => {
          const photo = photos[slot.id];
          const isActive = activeSlotId === slot.id;
          const isProcessing = processingId === slot.id;
          const isCustomCaption = Boolean(photo?.caption?.trim());

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
                <Switch
                  checked={photo?.include ?? slot.includeByDefault}
                  onCheckedChange={(checked) =>
                    onChange(slot.id, {
                      dataUrl: photo?.dataUrl ?? "",
                      include: checked,
                      caption: photo?.caption,
                      geotag: photo?.geotag,
                      showGeotag: photo?.showGeotag,
                    })
                  }
                  aria-label={`Incluir ${slot.caption} na impressão`}
                />
              </div>

              <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
                {isProcessing ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : photo?.dataUrl ? (
                  <>
                    <img src={photo.dataUrl} alt={slot.caption} className="h-full w-full object-cover" />
                    {geotag.enabled && photo.geotag && photo.showGeotag !== false && (
                      <div className="pointer-events-none absolute bottom-1 right-1 max-w-[80%] text-right">
                        {[photo.geotag.dataHora, photo.geotag.coordenadas, photo.geotag.endereco]
                          .filter((line) => line?.trim())
                          .map((line) => (
                            <p
                              key={line}
                              className="text-[10px] font-semibold leading-tight text-white"
                              style={{
                                fontFamily: "Arial, Helvetica, sans-serif",
                                textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.5)",
                              }}
                            >
                              {line}
                            </p>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px]">Sem imagem</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor={`legenda-${slot.id}`}
                  className="flex items-center justify-between text-[11px] text-muted-foreground"
                >
                  Legenda da foto
                  {isCustomCaption && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange(slot.id, {
                          dataUrl: photo?.dataUrl ?? "",
                          include: photo?.include ?? slot.includeByDefault,
                          caption: undefined,
                          geotag: photo?.geotag,
                          showGeotag: photo?.showGeotag,
                        });
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      padrão do modelo
                    </button>
                  )}
                </Label>
                <Input
                  id={`legenda-${slot.id}`}
                  value={photo?.caption ?? ""}
                  placeholder={slot.caption}
                  maxLength={70}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onChange(slot.id, {
                      dataUrl: photo?.dataUrl ?? "",
                      include: photo?.include ?? slot.includeByDefault,
                      caption: event.target.value,
                      geotag: photo?.geotag,
                      showGeotag: photo?.showGeotag,
                    })
                  }
                  className="h-8 bg-background/70 text-xs uppercase"
                />
              </div>

              {photo?.dataUrl && photo.geotag && (
                <details className="rounded-lg border border-glass-border/40 bg-glass/30 px-2 py-1.5">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Data e local desta foto
                  </summary>
                  <div className="mt-2 space-y-1.5" onClick={(event) => event.stopPropagation()}>
                    {GEOTAG_FIELDS.map((field) => (
                      <Input
                        key={field.key}
                        value={photo.geotag?.[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          onChange(slot.id, {
                            ...photo,
                            geotag: { ...(photo.geotag ?? geotag.defaults), [field.key]: event.target.value },
                          })
                        }
                        className="h-7 bg-background/70 text-[11px]"
                      />
                    ))}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">Mostrar na folha</span>
                      <Switch
                        checked={photo.showGeotag !== false}
                        onCheckedChange={(checked) => onChange(slot.id, { ...photo, showGeotag: checked })}
                        aria-label="Mostrar a marca de local nesta foto"
                      />
                    </div>
                  </div>
                </details>
              )}

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
                      onChange(slot.id, { ...(photo ?? { dataUrl: "", include: true }), dataUrl: "" });
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
