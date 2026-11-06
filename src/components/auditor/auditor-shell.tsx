import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AUDITOR_NAME, AUDITOR_SIGNATURE, AUDITOR_SUBTITLE } from "@/lib/auditor";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/auditor", label: "Visão geral", end: true },
  { to: "/auditor/celula/fiscalizacao", label: "Em fiscalização" },
  { to: "/auditor/celula/refazer", label: "Refazer" },
  { to: "/auditor/celula/respondidos", label: "Respondidos" },
  { to: "/auditor/celula/rpa", label: "RPA" },
  { to: "/auditor/celula/nao_avaliado", label: "N/A" },
  { to: "/auditor/analises", label: "Análises" },
  { to: "/auditor/bi", label: "Painel BI" },
];

/**
 * Casca do módulo: cabeçalho institucional, navegação própria e assinatura.
 * Não interfere no shell do Qualy Flow — apenas ocupa a área de conteúdo.
 */
export function AuditorShell({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 pb-2">
      <header className="auditor-hero relative overflow-hidden rounded-2xl px-5 py-5 shadow-elegant">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/25">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] auditor-hero-sub">
                Célula da Qualidade
              </p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
                {AUDITOR_NAME}
              </h1>
              <p className="auditor-hero-sub mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em]">
                {AUDITOR_SUBTITLE}
              </p>
            </div>
          </div>

          <div className="auditor-hero-sub flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
              Vila Maria
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
              Santana
            </span>
          </div>
        </div>
      </header>

      <nav className="scroll-slim -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "auditor-tab shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive && "font-semibold",
              )
            }
          >
            {({ isActive }) => (
              <span data-active={isActive ? "true" : undefined}>{tab.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {children}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
        <span>
          {AUDITOR_NAME} · {AUDITOR_SUBTITLE}
        </span>
        <span className="font-medium">{AUDITOR_SIGNATURE}</span>
      </footer>
    </div>
  );
}
