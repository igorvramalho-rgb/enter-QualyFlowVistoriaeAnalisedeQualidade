import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "@/components/layout/app-footer";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/hooks/auth-context";
import { useLegacyCloudMigration } from "@/hooks/use-cloud-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { JarvisIntro } from "@/components/auth/jarvis-intro";
import { isCloudDown, subscribeCloudDown } from "@/lib/offline-access";
import { CloudOff } from "lucide-react";

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const nuvemIndisponivel = useSyncExternalStore(subscribeCloudDown, isCloudDown, isCloudDown);
  const { user, profile, loading, profileLoading, signOut, refreshProfile } = useAuth();

  useLegacyCloudMigration();

  // Abertura estilo Jarvis: sempre que o operador entra no sistema.
  const introMostrada = useRef(false);
  useEffect(() => {
    if (introMostrada.current) {
      return;
    }
    if (!user || !profile || profile.status !== "ativo") {
      return;
    }
    introMostrada.current = true;
    setIntroOpen(true);
  }, [user, profile]);

  const current = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));

  if (loading || profileLoading) {
    return (
      <div className="tech-mesh flex h-screen w-full items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-12 w-40 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return (
      <AccessGate
        status={isCloudDown() ? "nuvem-off" : "sem-perfil"}
        username={user.email ?? ""}
        onSignOut={signOut}
      />
    );
  }

  if (profile.status !== "ativo") {
    return (
      <AccessGate status={profile.status} username={profile.username} onSignOut={signOut} />
    );
  }

  return (
    <>
      {introOpen && (
        <JarvisIntro
          name={profile.displayName || profile.username}
          onDone={() => setIntroOpen(false)}
        />
      )}
      <div className="tech-mesh flex h-screen w-full overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-glass-border/40 md:flex">
        <AppSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print relative border-b border-glass-border/40 bg-glass/50 backdrop-blur-xl">
          <span className="tech-strip absolute inset-x-0 top-0" />
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            {isMobile && (
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="glass" size="icon" aria-label="Abrir menu de navegação">
                    <Menu className="h-[18px] w-[18px]" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 border-glass-border/40 bg-sidebar p-0">
                  <SheetTitle className="sr-only">Navegação do QualyFlow</SheetTitle>
                  <AppSidebar onNavigate={() => setMenuOpen(false)} />
                </SheetContent>
              </Sheet>
            )}

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold tracking-tight text-foreground">
                <span className="glow-dot glow-dot--primary" aria-hidden />
                {current?.label ?? "QualyFlow"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {current?.description ?? "Gestão de vistorias e análise de qualidade"}
              </p>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="chip-tech max-w-[220px] truncate" title={profile.username}>
                <span className="glow-dot" aria-hidden />
                @{profile.username}
              </span>
              <span className="chip-tech">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {profile.role === "gestor" ? "Gestor" : "Vistoriador"}
              </span>
            </div>

            <ThemeToggle />

            <Button
              type="button"
              variant="glass"
              size="icon"
              aria-label="Sair da conta"
              title="Sair"
              onClick={() => void signOut()}
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </header>

        {nuvemIndisponivel && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-[11px] text-foreground">
            <p className="flex items-center gap-2">
              <CloudOff className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Nuvem indisponível.</strong> Você está no modo contingência: pode continuar
                emitindo relatórios neste computador. Análises e BI voltam quando a conexão
                retornar.
              </span>
            </p>
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-md border border-warning/50 px-2 py-1 text-[10px] font-medium"
            >
              Tentar reconectar
            </button>
          </div>
        )}

        <main className="scroll-slim flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1500px] animate-fade-in">
            <Outlet />
          </div>
        </main>

        <AppFooter />
      </div>
      </div>
    </>
  );
}
