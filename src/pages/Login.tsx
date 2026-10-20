import { useEffect, useState } from "react";
import {
  BarChart3,
  CloudUpload,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  LockKeyhole,
  LogIn,
  ScanLine,
  ShieldCheck,
  UserRound,
  Waypoints,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";

const HIGHLIGHTS = [
  {
    icon: CloudUpload,
    title: "Base única na nuvem",
    description: "Relatórios, vistorias e logos disponíveis para a equipe em qualquer máquina.",
  },
  {
    icon: FileText,
    title: "Relatórios em A4",
    description: "Folhas SGZ-156 e Pós 60 fiéis ao modelo oficial, prontas para imprimir ou PDF.",
  },
  {
    icon: Waypoints,
    title: "Indicadores por polo",
    description: "Análise por polo, data de avaliação e motivo de não conformidade.",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/emissor", { replace: true });
    }
  }, [loading, user, navigate]);

  if (!loading && user) {
    return <Navigate to="/emissor" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      toast.error("Informe usuário e senha.");
      return;
    }

    setBusy(true);
    try {
      await signIn(identifier, password);
      toast.success("Bem-vindo de volta!");
      navigate("/emissor", { replace: true });
    } catch (error) {
      toast.error("Não foi possível entrar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tech-mesh relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-brand-green/15 blur-3xl"
      />

      <div className="relative w-full max-w-5xl">
        <div className="grid overflow-hidden rounded-3xl border border-glass-border/50 shadow-elegant backdrop-blur-xl lg:grid-cols-[1.05fr_minmax(0,430px)]">
          {/* Painel institucional */}
          <aside className="relative flex flex-col justify-between gap-8 overflow-hidden bg-sidebar p-7 text-sidebar-foreground sm:p-9">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, hsl(var(--sidebar-primary)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--sidebar-primary)) 1px, transparent 1px)",
                backgroundSize: "38px 38px",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-sidebar-primary/25 blur-3xl"
            />
            <span aria-hidden className="tech-strip absolute inset-x-0 top-0" />

            <div className="relative space-y-6">
              <div className="flex items-center gap-3">
                <span className="brand-gradient shadow-glow ring-glow flex h-11 w-11 items-center justify-center rounded-xl">
                  <BarChart3 className="h-5 w-5 text-onbrand" />
                </span>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-sidebar-accent-foreground">
                    QualyFlow
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
                    Célula de Qualidade
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/75">
                  <ScanLine className="h-3.5 w-3.5 text-sidebar-primary" />
                  Acesso corporativo
                </span>
                <h1 className="text-2xl font-semibold leading-tight text-sidebar-accent-foreground sm:text-[28px]">
                  Gestão de vistorias com dados sempre disponíveis.
                </h1>
                <p className="max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
                  Emissão de relatórios fotográficos, análise dos PDFs de fiscalização e indicadores de
                  qualidade em um só lugar.
                </p>
              </div>

              <ul className="space-y-3">
                {HIGHLIGHTS.map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/50">
                      <item.icon className="h-4 w-4 text-sidebar-primary" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-sidebar-accent-foreground">
                        {item.title}
                      </span>
                      <span className="block text-xs leading-snug text-sidebar-foreground/60">
                        {item.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
              <span className="flex items-center gap-1.5 rounded-full border border-sidebar-border/60 px-2.5 py-1">
                <span className="glow-dot" aria-hidden />
                Base na nuvem
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-sidebar-border/60 px-2.5 py-1">
                <ShieldCheck className="h-3 w-3" />
                Acesso controlado
              </span>
            </div>
          </aside>

          {/* Formulário */}
          <section className="panel-glass relative flex flex-col justify-center gap-6 border-0 p-7 sm:p-9">
            <span className="tech-strip absolute inset-x-0 top-0" />

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Identificação do usuário
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                Entrar no sistema
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Use o usuário e a senha cadastrados pelo gestor da qualidade.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-medium text-muted-foreground">
                  Usuário ou e-mail
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="ex.: ramalhoigor"
                    className="h-11 border-glass-border/60 bg-background/60 pl-9 font-medium tracking-wide"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Sua senha"
                    className="h-11 border-glass-border/60 bg-background/60 pl-9 pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                    onClick={() => setShowPassword((previous) => !previous)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="glow" className="h-11 w-full text-sm" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Acessar o sistema
              </Button>

              <p className="flex items-start gap-2 rounded-lg border border-glass-border/40 bg-glass/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Primeiro acesso ou senha esquecida? O gestor cadastra o usuário e redefine a senha.
              </p>
            </form>

            <div className="flex items-center justify-between border-t border-glass-border/40 pt-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>QualyFlow</span>
              <span className="normal-case tracking-normal">Criado por Igor Ramalho</span>
            </div>
          </section>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Sistema Criado por Igor Ramalho | Célula de Qualidade
        </p>
      </div>
    </div>
  );
}
