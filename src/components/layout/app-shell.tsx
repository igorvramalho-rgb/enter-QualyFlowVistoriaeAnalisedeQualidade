import { useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "@/components/layout/app-footer";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const current = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border/60 md:flex">
        <AppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-3 border-b border-border/70 bg-card/60 px-4 py-3 backdrop-blur sm:px-6">
          {isMobile && (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu de navegação">
                  <Menu className="h-[18px] w-[18px]" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border/60 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navegação do QualyFlow</SheetTitle>
                <AppSidebar onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {current?.label ?? "QualyFlow"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {current?.description ?? "Gestão de vistorias e análise de qualidade"}
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Desenvolvido por Igor Ramalho
          </div>

          <ThemeToggle />
        </header>

        <main className="scroll-slim flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1500px] animate-fade-in">
            <Outlet />
          </div>
        </main>

        <AppFooter />
      </div>
    </div>
  );
}
