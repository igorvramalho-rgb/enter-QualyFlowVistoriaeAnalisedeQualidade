import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useAuth } from "@/hooks/auth-context";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { profile } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.gestorOnly || profile?.role === "gestor");

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

      <div className="relative border-b border-sidebar-border/60 px-5 py-5">
        <span className="flex items-center justify-center rounded-xl bg-logo-plate px-3 py-2 shadow-glow">
          <img
            src="/brand/qualyflow-logo.png"
            alt="QualyFlow — Gestão de Qualidade & Análise"
            className="h-9 w-auto"
          />
        </span>
      </div>

      <nav className="relative flex-1 space-y-1.5 p-3">
        {items.map((item) => (
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
          Base compartilhada na nuvem
        </p>
        {profile && (
          <p className="truncate text-sidebar-foreground/70" title={profile.displayName || profile.username}>
            {profile.displayName ? `${profile.displayName} • ` : ""}@{profile.username}
          </p>
        )}
        <p>Desenvolvido por Igor Ramalho.</p>
      </div>
    </div>
  );
}
