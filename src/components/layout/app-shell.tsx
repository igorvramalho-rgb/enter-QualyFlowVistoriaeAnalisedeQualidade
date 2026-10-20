import { useState } from "react";
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

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, loading, profileLoading, signOut } = useAuth();

  useLegacyCloudMigration();

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
      <AccessGate status="sem-perfil" username={user.email ?? ""} onSignOut={signOut} />
    );
  }

  if (profile.status !== "ativo") {
    return (
      <AccessGate status={profile.status} username={profile.username} onSignOut={signOut} />
    );
  }

  return (
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
