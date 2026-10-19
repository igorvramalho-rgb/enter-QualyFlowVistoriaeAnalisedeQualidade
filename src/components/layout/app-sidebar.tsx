import { BarChart3 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-sidebar-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-40 h-52 w-52 rounded-full bg-brand-green/15 blur-3xl"
      />

      <div className="relative flex items-center gap-3 border-b border-sidebar-border/60 px-5 py-5">
        <span className="brand-gradient shadow-glow ring-glow flex h-11 w-11 items-center justify-center rounded-xl">
          <BarChart3 className="h-5 w-5 text-onbrand" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-sidebar-accent-foreground text-glow">
            QualyFlow
          </p>
          <p className="truncate text-xs text-sidebar-foreground/70">Célula de Qualidade</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1.5 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-smooth",
                isActive
                  ? "border-sidebar-primary/40 bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-glow"
                  : "border-transparent text-sidebar-foreground/80 hover:border-sidebar-border/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full transition-smooth",
                    isActive ? "bg-sidebar-primary shadow-glow" : "bg-transparent",
                  )}
                />
                <item.icon
                  className={cn(
                    "mt-0.5 h-[18px] w-[18px] shrink-0 transition-smooth",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60",
                  )}
                />
                <span className="min-w-0">
                  <span className="block font-medium leading-tight">{item.label}</span>
                  <span className="block text-xs text-sidebar-foreground/60">{item.description}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative space-y-2 border-t border-sidebar-border/60 px-5 py-4 text-xs leading-relaxed text-sidebar-foreground/60">
        <p className="flex items-center gap-2 text-sidebar-foreground/75">
          <span className="glow-dot" aria-hidden />
          Dados salvos neste navegador
        </p>
        <p>Desenvolvido por Igor Ramalho.</p>
      </div>
    </div>
  );
}
