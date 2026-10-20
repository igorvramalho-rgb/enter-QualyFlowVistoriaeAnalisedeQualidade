import { LogOut, ShieldX, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UserStatus } from "@/lib/users";

interface AccessGateProps {
  status: UserStatus | "sem-perfil";
  username: string;
  onSignOut: () => Promise<void>;
}

const CONTENT: Record<
  AccessGateProps["status"],
  { title: string; description: string; icon: typeof ShieldX; tone: string }
> = {
  pendente: {
    title: "Cadastro aguardando liberação",
    description:
      "Seu acesso foi criado, mas ainda não foi autorizado. Peça ao gestor para liberar o usuário na aba Usuários.",
    icon: TimerReset,
    tone: "bg-warning/15 text-warning",
  },
  bloqueado: {
    title: "Acesso bloqueado",
    description: "Seu acesso está bloqueado. Fale com o gestor para reativar o usuário.",
    icon: ShieldX,
    tone: "bg-destructive/12 text-destructive",
  },
  "sem-perfil": {
    title: "Usuário sem perfil de acesso",
    description:
      "Sua conta existe, mas não tem perfil no QualyFlow. Peça ao gestor para cadastrar seu usuário na aba Usuários.",
    icon: ShieldX,
    tone: "bg-destructive/12 text-destructive",
  },
};

export function AccessGate({ status, username, onSignOut }: AccessGateProps) {
  const content = CONTENT[status];

  return (
    <div className="tech-mesh flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8 text-center">
        <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${content.tone}`}>
          <content.icon className="h-5 w-5" />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-foreground">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{content.description}</p>

        <p className="mt-4 chip-tech justify-center">Usuário: {username}</p>

        <Button
          type="button"
          variant="glass"
          className="mt-6 w-full"
          onClick={() => void onSignOut()}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </Card>
    </div>
  );
}
