import { BarChart3 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border/70 px-5 py-5">
        <span className="brand-gradient shadow-glow flex h-11 w-11 items-center justify-center rounded-xl">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-sidebar-accent-foreground">
            QualyFlow
          </p>
          <p className="truncate text-xs text-sidebar-foreground/70">Célula de Qualidade</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-smooth",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-elegant"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
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

      <div className="border-t border-sidebar-border/70 px-5 py-4 text-xs leading-relaxed text-sidebar-foreground/60">
        Dados salvos apenas neste navegador.
        <br />
        Desenvolvido por Igor Ramalho.
      </div>
    </div>
  );
}
