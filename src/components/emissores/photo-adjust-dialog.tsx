import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  NEUTRAL_ADJUSTMENTS,
  PHOTO_PRESETS,
  PRESET_LABELS,
  type PhotoAdjustments,
} from "@/lib/image";
import { cn } from "@/lib/utils";

interface PhotoAdjustDialogProps {
  open: boolean;
  image: string | null;
  /** Dimensões originais, para calcular o resultado da ampliação. */
  originalSize?: { width: number; height: number };
  caption: string;
  onClose: () => void;
  onApply: (adjustments: PhotoAdjustments) => void;
  applying?: boolean;
}

type PresetKey = keyof typeof PHOTO_PRESETS;

const CONTROLS: { key: keyof PhotoAdjustments; label: string; min: number; max: number }[] = [
  { key: "exposure", label: "Exposição", min: -100, max: 100 },
  { key: "brightness", label: "Brilho", min: -100, max: 100 },
  { key: "contrast", label: "Contraste", min: -100, max: 100 },
  { key: "saturation", label: "Saturação", min: -100, max: 100 },
  { key: "temperature", label: "Temperatura de cor", min: -100, max: 100 },
  { key: "shadows", label: "Sombras", min: -100, max: 100 },
  { key: "highlights", label: "Realces", min: -100, max: 100 },
  { key: "sharpness", label: "Nitidez", min: 0, max: 100 },
];

const UPSCALES = [
  { value: 1, label: "Original (1×)" },
  { value: 1.5, label: "Ampliar 1,5×" },
  { value: 2, label: "Ampliar 2×" },
  { value: 4, label: "Ampliar 4×" },
];

/**
 * Filtros PRO: ajustes locais de tom, cor, nitidez e resolução. A prévia é uma
 * aproximação por CSS; o resultado final é aplicado pixel a pixel ao confirmar.
 * O arquivo original permanece no armazenamento e pode ser restaurado.
 */
export function PhotoAdjustDialog({
  open,
  image,
  originalSize,
  caption,
  onClose,
  onApply,
  applying = false,
}: PhotoAdjustDialogProps) {
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(PHOTO_PRESETS.profissional);
  const [preset, setPreset] = useState<PresetKey>("profissional");

  useEffect(() => {
    if (open) {
      setAdjustments(PHOTO_PRESETS.profissional);
      setPreset("profissional");
    }
  }, [open, image]);

  const previewFilter = useMemo(() => {
    const brilho = 1 + (adjustments.brightness + adjustments.exposure) / 130;
    const contraste = 1 + adjustments.contrast / 110;
    const saturacao = 1 + adjustments.saturation / 100;
    return `brightness(${brilho.toFixed(3)}) contrast(${contraste.toFixed(3)}) saturate(${saturacao.toFixed(3)})`;
  }, [adjustments]);

  const toneTint =
    adjustments.temperature > 0
      ? `rgba(255, 176, 84, ${Math.min(0.32, adjustments.temperature / 340)})`
      : adjustments.temperature < 0
        ? `rgba(84, 156, 255, ${Math.min(0.32, Math.abs(adjustments.temperature) / 340)})`
        : "transparent";

  const dimensoes = originalSize
    ? {
        width: Math.round(originalSize.width * adjustments.upscale),
        height: Math.round(originalSize.height * adjustments.upscale),
      }
    : null;

  const aplicarPreset = (key: PresetKey) => {
    setPreset(key);
    setAdjustments(PHOTO_PRESETS[key]);
  };

  const alterar = (key: keyof PhotoAdjustments, value: number) => {
    setPreset("profissional");
    setAdjustments((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="panel-glass max-h-[94vh] w-[min(96vw,900px)] max-w-none overflow-auto rounded-2xl p-0">
        <DialogHeader className="border-b border-glass-border/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filtros PRO
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ajustes locais, sem IA e sem envio da foto para fora. A prévia é uma aproximação — sombras,
            realces e nitidez são aplicados exatamente ao confirmar.{" "}
            <span className="font-medium text-foreground">{caption}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Antes
                </p>
                <div className="aspect-video overflow-hidden rounded-lg border border-glass-border/50 bg-muted">
                  {image && <img src={image} alt="antes" className="h-full w-full object-contain" />}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-primary">Depois</p>
                <div className="relative aspect-video overflow-hidden rounded-lg border border-primary/50 bg-muted">
                  {image && (
                    <>
                      <img
                        src={image}
                        alt="depois"
                        className="h-full w-full object-contain"
                        style={{ filter: previewFilter }}
                      />
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{ backgroundColor: toneTint, mixBlendMode: "soft-light" }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(PHOTO_PRESETS) as PresetKey[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={preset === key ? "glow" : "glass"}
                  size="sm"
                  onClick={() => aplicarPreset(key)}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  {PRESET_LABELS[key]}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setAdjustments(NEUTRAL_ADJUSTMENTS);
                  setPreset("profissional");
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Zerar ajustes
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {CONTROLS.map((control) => (
              <div key={control.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <Label className="text-muted-foreground">{control.label}</Label>
                  <span className="font-mono text-muted-foreground">
                    {adjustments[control.key] > 0 ? `+${adjustments[control.key]}` : adjustments[control.key]}
                  </span>
                </div>
                <Slider
                  value={[adjustments[control.key]]}
                  min={control.min}
                  max={control.max}
                  step={1}
                  onValueChange={(value) => alterar(control.key, value[0] ?? 0)}
                  aria-label={control.label}
                />
              </div>
            ))}

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Resolução</Label>
              <Select
                value={String(adjustments.upscale)}
                onValueChange={(value) =>
                  setAdjustments((previous) => ({ ...previous, upscale: Number(value) }))
                }
              >
                <SelectTrigger className="bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPSCALES.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dimensoes && (
                <p className="text-[11px] text-muted-foreground">
                  Resultado: {dimensoes.width} × {dimensoes.height} px
                  {adjustments.upscale > 1
                    ? " — a ampliação melhora a impressão, sem recuperar detalhes que não existem na foto."
                    : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className={cn("border-t border-glass-border/40 px-5 py-4")}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="glow"
            disabled={applying}
            onClick={() => onApply(adjustments)}
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Aplicar ajustes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
