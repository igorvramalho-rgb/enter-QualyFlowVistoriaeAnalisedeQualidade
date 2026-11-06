import type { LucideIcon } from "lucide-react";

/** Estado vazio honesto: explica o que falta sem oferecer controles sem função. */
export function AuditorEmpty({
  icon: Icon,
  title,
  description,
  nextStage,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  nextStage?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/25 px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-[11px] text-muted-foreground">{description}</p>
      {nextStage && (
        <p className="mt-1 rounded-full border border-border/60 px-2.5 py-0.5 text-[10px] text-muted-foreground">
          {nextStage}
        </p>
      )}
    </div>
  );
}
