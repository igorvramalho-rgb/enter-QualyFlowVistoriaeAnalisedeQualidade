import { useEffect, useState } from "react";
import { BarChart3, CloudUpload, Loader2, LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="tech-mesh flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex flex-col justify-center gap-4">
            <div className="flex items-center gap-3">
              <span className="brand-gradient shadow-glow ring-glow flex h-12 w-12 items-center justify-center rounded-xl">
                <BarChart3 className="h-5 w-5 text-onbrand" />
              </span>
              <div>
                <p className="text-xl font-semibold tracking-tight text-foreground text-glow">QualyFlow</p>
                <p className="text-xs text-muted-foreground">Célula de Qualidade</p>
              </div>
            </div>

            <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              Seus relatórios e vistorias sempre salvos na nuvem
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Entre com o usuário liberado pelo gestor para acessar a base de vistorias da equipe de
              qualquer computador. Os relatórios fotográficos, as análises por polo e o cabeçalho
              institucional ficam guardados na nuvem.
            </p>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-primary" />
                Base compartilhada com toda a equipe
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Novos acessos liberados apenas pelo gestor
              </li>
            </ul>
          </div>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Entrar no sistema</h2>
              <p className="text-xs text-muted-foreground">Use o usuário e a senha cadastrados pelo gestor.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs text-muted-foreground">
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
                    className="bg-background/70 pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-muted-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Sua senha"
                    className="bg-background/70 pl-9"
                    required
                  />
                </div>
              </div>

              <Button type="submit" variant="glow" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Entrar
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Ainda não tem acesso? Peça ao gestor para cadastrar seu usuário na aba Usuários.
              </p>
            </form>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade
        </p>
      </div>
    </div>
  );
}
