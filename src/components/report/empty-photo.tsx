import { ImageOff } from "lucide-react";

export function EmptyPhoto({ label = "Imagem não inserida" }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-1 self-stretch flex-col items-center justify-center gap-1 border border-dashed border-sheet-line/40 bg-sheet-head text-sheet-muted">
      <ImageOff className="h-5 w-5" />
      <span className="text-[9px] uppercase tracking-wide">{label}</span>
    </div>
  );
}
