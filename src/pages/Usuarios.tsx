import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import { formatDateTimeBR } from "@/lib/fields";
import {
  fetchProfiles,
  invokeUsers,
  normalizeUsername,
  ROLE_LABELS,
  STATUS_LABELS,
  type AppUser,
  type UserStatus,
} from "@/lib/users";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<UserStatus, string> = {
  ativo: "bg-success/15 text-success border-success/40",
  pendente: "bg-warning/15 text-warning border-warning/40",
  bloqueado: "bg-destructive/12 text-destructive border-destructive/40",
};

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}

export default function Usuarios() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [releaseNow, setReleaseNow] = useState(true);

  const isManager = profile?.role === "gestor" && profile?.status === "ativo";

  const load = useCallback(async () => {
    try {
      const rows = await fetchProfiles();
      setProfiles(rows);
    } catch (error) {
      toast.error("Não foi possível carregar os usuários", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isManager) {
      void load();
    }
  }, [isManager, load]);

  const counters = useMemo(() => {
    return {
      total: profiles.length,
      ativos: profiles.filter((item) => item.status === "ativo").length,
      pendentes: profiles.filter((item) => item.status === "pendente").length,
    };
  }, [profiles]);

  if (!isManager) {
    return <Navigate to="/emissor" replace />;
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = normalizeUsername(username);

    if (cleanUsername.length < 3) {
      toast.error("Usuário inválido", { description: "Use pelo menos 3 letras, sem espaços." });
      return;
    }
    if (password.length < 6) {
      toast.error("Senha curta", { description: "A senha precisa ter pelo menos 6 caracteres." });
      return;
    }

    setCreating(true);
    try {
      await invokeUsers({
        action: "create",
        username: cleanUsername,
        password,
        displayName: name.trim(),
        status: releaseNow ? "ativo" : "pendente",
      });
      toast.success("Usuário cadastrado", {
        description: `@${cleanUsername} • senha: ${password}${releaseNow ? "" : " • aguardando liberação"}`,
      });
      setName("");
      setUsername("");
      setPassword("");
      setReleaseNow(true);
      await load();
    } catch (error) {
      toast.error("Não foi possível cadastrar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (targetUser: AppUser, status: UserStatus) => {
    setBusyId(targetUser.userId);
    try {
      await invokeUsers({ action: "set-status", userId: targetUser.userId, status });
      toast.success(status === "ativo" ? "Acesso liberado" : "Acesso bloqueado", {
        description: `@${targetUser.username}`,
      });
      await load();
    } catch (error) {
      toast.error("Não foi possível alterar o acesso", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (targetUser: AppUser) => {
    if (confirmDelete !== targetUser.userId) {
      setConfirmDelete(targetUser.userId);
      toast.warning(`Clique em remover novamente para excluir @${targetUser.username}`);
      return;
    }

    setBusyId(targetUser.userId);
    try {
      await invokeUsers({ action: "delete", userId: targetUser.userId });
      toast.success("Usuário removido");
      setConfirmDelete(null);
      await load();
    } catch (error) {
      toast.error("Não foi possível remover", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget) {
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setResetting(true);
    try {
      await invokeUsers({
        action: "reset-password",
        userId: resetTarget.userId,
        password: newPassword,
      });
      toast.success("Senha atualizada", {
        description: `@${resetTarget.username} • nova senha: ${newPassword}`,
      });
      setResetTarget(null);
      setNewPassword("");
    } catch (error) {
      toast.error("Não foi possível alterar a senha", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Usuários e liberação de acesso"
        description="Somente o gestor cadastra novos usuários e libera o acesso ao sistema. Cada pessoa entra com o próprio usuário e senha e compartilha a mesma base de vistorias."
        chips={[
          { icon: Users, label: `${counters.total} usuário(s)` },
          { icon: ShieldCheck, label: `${counters.ativos} ativo(s)` },
          { icon: ShieldOff, label: `${counters.pendentes} aguardando` },
        ]}
        actions={
          <Button type="button" variant="glass" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-foreground">Cadastrar novo usuário</h2>
            <p className="text-xs text-muted-foreground">
              O usuário entra com o nome curto (ex.: joao.silva) e a senha definida aqui.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="novo-nome" className="text-xs text-muted-foreground">
                Nome (opcional)
              </Label>
              <Input
                id="novo-nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: João Silva"
                className="bg-background/70"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="novo-usuario" className="text-xs text-muted-foreground">
                Usuário
              </Label>
              <Input
                id="novo-usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Ex.: joao.silva"
                className="bg-background/70"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="nova-senha" className="text-xs text-muted-foreground">
                  Senha
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setPassword(generatePassword())}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Gerar
                </Button>
              </div>
              <Input
                id="nova-senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="bg-background/70 font-mono"
                required
                minLength={6}
              />
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-glass-border/50 bg-glass/30 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-foreground">Liberar acesso imediatamente</p>
                <p className="text-[11px] text-muted-foreground">
                  Se desligar, o usuário fica aguardando sua liberação.
                </p>
              </div>
              <Switch checked={releaseNow} onCheckedChange={setReleaseNow} aria-label="Liberar acesso imediatamente" />
            </div>

            <Button type="submit" variant="glow" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Cadastrar usuário
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-glass-border/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Usuários do sistema</h2>
            <p className="text-xs text-muted-foreground">
              Libere, bloqueie, redefina a senha ou remova o acesso de cada pessoa.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando usuários...
            </div>
          ) : profiles.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <ul className="divide-y divide-glass-border/30">
              {profiles.map((item) => {
                const isSelf = item.userId === user?.id;
                const busy = busyId === item.userId;

                return (
                  <li key={item.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold uppercase text-onbrand">
                      {(item.displayName || item.username).slice(0, 2)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {item.displayName || `@${item.username}`}
                        {isSelf && <span className="chip-tech px-1.5 py-0 text-[10px]">você</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{item.username} • {ROLE_LABELS[item.role]} • desde {formatDateTimeBR(item.createdAt)}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("whitespace-nowrap border text-[11px]", STATUS_STYLES[item.status])}
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>

                    <div className="flex flex-wrap items-center gap-1">
                      {item.status !== "ativo" ? (
                        <Button
                          type="button"
                          variant="glass"
                          size="sm"
                          disabled={busy}
                          onClick={() => void changeStatus(item, "ativo")}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Liberar
                        </Button>
                      ) : (
                        !isSelf && (
                          <Button
                            type="button"
                            variant="glass"
                            size="sm"
                            disabled={busy}
                            onClick={() => void changeStatus(item, "bloqueado")}
                          >
                            <ShieldOff className="h-4 w-4" />
                            Bloquear
                          </Button>
                        )
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Definir nova senha para @${item.username}`}
                        title="Nova senha"
                        onClick={() => {
                          setResetTarget(item);
                          setNewPassword(generatePassword());
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>

                      {!isSelf && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover @${item.username}`}
                          title={confirmDelete === item.userId ? "Clique para confirmar" : "Remover acesso"}
                          className={cn(
                            "hover:text-destructive",
                            confirmDelete === item.userId ? "text-destructive" : "text-muted-foreground",
                          )}
                          disabled={busy}
                          onClick={() => void removeUser(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="panel-glass rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Nova senha para @{resetTarget?.username}</DialogTitle>
            <DialogDescription className="text-xs">
              Informe a nova senha e repasse para a pessoa. Ela entra com o usuário e essa senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="reset-senha" className="text-xs text-muted-foreground">
              Senha
            </Label>
            <Input
              id="reset-senha"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="bg-background/70 font-mono"
              minLength={6}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="glow" onClick={() => void resetPassword()} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Salvar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
