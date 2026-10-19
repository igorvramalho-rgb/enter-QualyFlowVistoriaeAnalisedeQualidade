import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageHeaderChip {
  icon: LucideIcon;
  label: string;
}

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  chips?: PageHeaderChip[];
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, title, description, chips, actions }: PageHeaderProps) {
  return (
    <header className="panel-glass panel-interactive relative overflow-hidden rounded-2xl p-5">
      <span className="tech-strip absolute inset-x-0 top-0" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="brand-gradient shadow-glow ring-glow flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5 text-onbrand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>

            {chips && chips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <span key={chip.label} className="chip-tech">
                    <chip.icon className="h-3.5 w-3.5 text-primary" />
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
