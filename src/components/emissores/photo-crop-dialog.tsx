import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Loader2, Move, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface PhotoCropDialogProps {
  open: boolean;
  image: string | null;
  caption: string;
  onClose: () => void;
  onApply: (cropped: string) => void;
}

const ASPECT = 3 / 2;
const OUTPUT_WIDTH = 2100;

/**
 * Ajuste de enquadramento da foto já inserida: arraste para mover e use o zoom
 * para recortar. O recorte é aplicado na imagem (sem depender de CSS), então a
 * folha impressa e o PDF ficam idênticos.
 */
export function PhotoCropDialog({ open, image, caption, onClose, onApply }: PhotoCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(520);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, image]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const update = () => setBoxWidth(Math.min(520, Math.max(260, window.innerWidth - 160)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  const boxHeight = Math.round(boxWidth / ASPECT);

  const imageSize = usePhotoSize(image);

  const frame = useMemo(() => {
    if (!imageSize.width || !imageSize.height) {
      return null;
    }
    const coverScale = Math.max(boxWidth / imageSize.width, boxHeight / imageSize.height);
    const width = imageSize.width * coverScale * zoom;
    const height = imageSize.height * coverScale * zoom;
    const maxX = Math.max(0, (width - boxWidth) / 2);
    const maxY = Math.max(0, (height - boxHeight) / 2);
    const left = (boxWidth - width) / 2 + (offset.x / 100) * maxX;
    const top = (boxHeight - height) / 2 + (offset.y / 100) * maxY;
    return { width, height, left, top };
  }, [boxHeight, boxWidth, imageSize, offset, zoom]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) {
        return;
      }
      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      dragRef.current = { x: event.clientX, y: event.clientY };

      setOffset((previous) => ({
        x: Math.max(-100, Math.min(100, previous.x - (dx / Math.max(1, boxWidth / 2)) * 100)),
        y: Math.max(-100, Math.min(100, previous.y - (dy / Math.max(1, boxHeight / 2)) * 100)),
      }));
    },
    [boxHeight, boxWidth, dragging],
  );

  const apply = async () => {
    if (!image || !frame || !imageSize.width) {
      return;
    }

    setApplying(true);
    try {
      const img = await loadImage(image);
      const outputHeight = Math.round(OUTPUT_WIDTH / ASPECT);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_WIDTH;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Este navegador não permite processar a imagem.");
      }

      // mesma matemática da pré-visualização, em pixels de saída
      const ratio = OUTPUT_WIDTH / boxWidth;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, OUTPUT_WIDTH, outputHeight);
      context.drawImage(
        img,
        frame.left * ratio,
        frame.top * ratio,
        frame.width * ratio,
        frame.height * ratio,
      );

      onApply(canvas.toDataURL("image/jpeg", 0.95));
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="panel-glass max-w-none rounded-2xl p-0 sm:max-w-[600px]">
        <DialogHeader className="border-b border-glass-border/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crop className="h-4 w-4 text-primary" />
            Ajustar foto
          </DialogTitle>
          <DialogDescription className="text-xs">
            Arraste a imagem para mover e use o zoom para recortar. O recorte é gravado na foto do
            relatório. <span className="font-medium text-foreground">{caption}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div
            ref={boxRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-glass-border/60 bg-muted"
            style={{ width: boxWidth, height: boxHeight, cursor: dragging ? "grabbing" : "grab" }}
          >
            {image && frame && (
              <img
                src={image}
                alt="Pré-visualização do recorte"
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: frame.width,
                  height: frame.height,
                  left: frame.left,
                  top: frame.top,
                }}
              />
            )}

            <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-foreground/60 px-2 py-1 text-[10px] font-medium text-background">
              <Move className="h-3 w-3" />
              arraste para mover
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.02}
              onValueChange={(value) => setZoom(value[0] ?? 1)}
              aria-label="Zoom do recorte"
            />
            <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {zoom.toFixed(1)}x
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Centralizar
          </Button>
        </div>

        <DialogFooter className="border-t border-glass-border/40 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="glow" onClick={() => void apply()} disabled={applying}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
            Aplicar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function usePhotoSize(image: string | null) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let active = true;
    if (!image) {
      setSize({ width: 0, height: 0 });
      return;
    }
    void loadImage(image)
      .then((img) => {
        if (active) {
          setSize({ width: img.naturalWidth, height: img.naturalHeight });
        }
      })
      .catch(() => {
        if (active) {
          setSize({ width: 0, height: 0 });
        }
      });
    return () => {
      active = false;
    };
  }, [image]);

  return size;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // sem isso o canvas ficaria "sujo" e o recorte falharia em imagens remotas
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    image.src = source;
  });
}
