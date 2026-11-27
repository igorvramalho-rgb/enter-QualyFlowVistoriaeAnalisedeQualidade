import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CloudOff, HardDriveDownload, LogOut, Menu, ShieldCheck } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppFooter } from "@/components/layout/app-footer";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/hooks/auth-context";
import { useLegacyCloudMigration } from "@/hooks/use-cloud-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { JarvisIntro } from "@/components/auth/jarvis-intro";
import { isCloudDown, subscribeCloudDown } from "@/lib/offline-access";
import { offlineRuntime, subscribeOfflineRuntime, startOfflineServices, syncNow } from "@/lib/offline/gateway";

export default function AppShell() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const nuvemIndisponivel = useSyncExternalStore(subscribeCloudDown, isCloudDown, isCloudDown);
  const contingencia = useSyncExternalStore(subscribeOfflineRuntime, offlineRuntime, offlineRuntime);
  const { user, profile, loading, profileLoading, signOut } = useAuth();
  const [sincronizando, setSincronizando] = useState(false);
  const servicosIniciados = useRef(false);

  useEffect(() => {
    if (profile?.status === "ativo" && !servicosIniciados.current) {
      servicosIniciados.current = true;
      startOfflineServices();
    }
  }, [profile?.status]);

  const sincronizarAgora = async () => {
    setSincronizando(true);
    try {
      await syncNow();
      const estado = offlineRuntime();
      if (estado.pending > 0) {
        toast.warning(`${estado.pending} alteração(ões) ainda pendentes`, {
          description:
            estado.message || "O envio continua automático; não é preciso refazer o trabalho.",
        });
      } else if (estado.failed > 0) {
        toast.warning("Algumas alterações não puderam ser enviadas", {
          description: "Confira os dados sinalizados no aviso antes de continuar.",
        });
      } else if (isCloudDown()) {
        toast.error("A nuvem ainda não respondeu", {
          description: "O trabalho continua salvo neste computador; tente novamente em instantes.",
        });
      } else {
        toast.success("Sincronização concluída");
      }
    } finally {
      setSincronizando(false);
    }
  };

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
              <span
                className="chip-tech max-w-[210px] truncate"
                title="Cópia dos dados neste computador para trabalhar com a nuvem pausada. Atualizada a cada 5 minutos."
              >
                <HardDriveDownload className="h-3.5 w-3.5 text-primary" />
                {contingencia.snapshotAt > 0
                  ? `Cópia local ${new Date(contingencia.snapshotAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Preparando cópia local"}
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

        {(nuvemIndisponivel || contingencia.pending > 0 || contingencia.failed > 0) && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-[11px] text-foreground"
            title={contingencia.message || undefined}
          >
            <p className="flex items-center gap-2">
              <CloudOff className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>
                  {nuvemIndisponivel
                    ? "Nuvem indisponível — modo contingência."
                    : "Sincronização pendente."}
                </strong>{" "}
                {nuvemIndisponivel
                  ? "O sistema está trabalhando com a cópia local deste computador: importações, células, BI e relatórios continuam funcionando."
                  : "O trabalho local está salvo neste computador e será enviado à nuvem."}{" "}
                {contingencia.pending > 0
                  ? `${contingencia.pending} alteração(ões) aguardam envio automático quando a nuvem voltar.`
                  : "Nenhuma alteração pendente de envio."}
                {contingencia.failed > 0 && (
                  <span className="ml-1 font-semibold text-destructive">
                    {contingencia.failed} alteração(ões) não puderam ser enviadas — verifique os
                    dados antes de continuar.
                  </span>
                )}
                {contingencia.pending > 0 && contingencia.message && (
                  <span className="ml-1 text-muted-foreground">{contingencia.message}</span>
                )}
                {contingencia.snapshotAt > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    Cópia local de {new Date(contingencia.snapshotAt).toLocaleString("pt-BR")}.
                  </span>
                )}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void sincronizarAgora()}
              disabled={sincronizando}
              className="rounded-md border border-warning/50 px-2 py-1 text-[10px] font-medium disabled:opacity-60"
            >
              {sincronizando ? "Sincronizando…" : "Sincronizar agora"}
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
