import { useEffect, useState } from "react";
import { BarChart3, CloudUpload, Loader2, LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";

type Mode = "entrar" | "criar";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha.");
      return;
    }
    if (mode === "criar" && password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "entrar") {
        await signIn(email.trim(), password);
        toast.success("Bem-vindo de volta!");
        navigate("/emissor", { replace: true });
        return;
      }

      const { needsConfirmation } = await signUp(email.trim(), password);
      if (needsConfirmation) {
        toast.success("Conta criada", {
          description: "Confirme o e-mail para entrar.",
        });
      } else {
        toast.success("Conta criada e acesso liberado");
        navigate("/emissor", { replace: true });
      }
    } catch (error) {
      toast.error("Não foi possível continuar", {
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
              Entre com sua conta para acessar a base de vistorias da equipe de qualquer computador. Os
              relatórios fotográficos, as análises por polo e o cabeçalho institucional ficam guardados na
              nuvem.
            </p>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-primary" />
                Base compartilhada com toda a equipe
              </li>
              <li className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-primary" />
                Acesso somente para quem tem conta
              </li>
            </ul>
          </div>

          <Card className="p-6">
            <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <TabsList className="mb-4 grid w-full grid-cols-2 bg-glass/40">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value={mode}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-muted-foreground">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="nome@empresa.com.br"
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
                        autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Mínimo de 6 caracteres"
                        className="bg-background/70 pl-9"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {mode === "criar" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm" className="text-xs text-muted-foreground">
                        Repita a senha
                      </Label>
                      <Input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        className="bg-background/70"
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  <Button type="submit" variant="glow" className="w-full" disabled={busy}>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === "entrar" ? (
                      <LogIn className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {mode === "entrar" ? "Entrar" : "Criar conta"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    {mode === "entrar"
                      ? "Primeiro acesso? Use a aba Criar conta para liberar seu usuário."
                      : "A conta dá acesso à base compartilhada da Célula de Qualidade."}
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade
        </p>
      </div>
    </div>
  );
}
