import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type AuthContextValue } from "@/hooks/auth-context";
import { fetchProfile, usernameToEmail, type AppUser } from "@/lib/users";
import {
  cacheProfile,
  clearCachedProfile,
  readCachedProfile,
  setCloudDown,
} from "@/lib/offline-access";
import { readOfflineUser, startOfflineServices, offlineActive } from "@/lib/offline/gateway";

/**
 * Sessão no Enter Cloud + perfil de acesso (gestor/vistoriador e status).
 * O perfil é a fonte da verdade para liberar o app: sem status "ativo" o
 * usuário não entra, mesmo com login válido.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  /** Modo contingência: acesso validado antes neste computador, sem nuvem. */
  const [, setOfflineAccess] = useState(false);
  const offlineRef = useRef(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Um evento de sessão vazio não pode derrubar quem está no modo local.
      if (offlineRef.current && !nextSession) {
        return;
      }
      setSession(nextSession);
      // A renovação do token cria um objeto de usuário novo, mas a pessoa é a
      // mesma: preservar a referência evita recarregar as telas a cada token.
      setUser((previous) => {
        const next = nextSession?.user ?? null;
        return previous && next && previous.id === next.id ? previous : next;
      });
      setLoading(false);
    });

    // Se a nuvem não responder, a tela de entrada não pode ficar presa.
    const release = window.setTimeout(() => setLoading(false), 6000);

    void supabase.auth.getSession().then(({ data: current }) => {
      window.clearTimeout(release);
      setSession(current.session);
      setUser((previous) => {
        const next = current.session?.user ?? null;
        return previous && next && previous.id === next.id ? previous : next;
      });
      setLoading(false);
    });

    return () => {
      window.clearTimeout(release);
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);

    void fetchProfile(userId)
      .then((next) => {
        if (!active) {
          return;
        }
        if (next) {
          cacheProfile(next);
          if (!offlineActive()) {
            setCloudDown(false);
          }
          setProfile(next);
          return;
        }
        // Sem linha na nuvem (ou lida da cópia local): vale o último acesso válido.
        const cache = readCachedProfile();
        if (cache) {
          setProfile(cache);
          return;
        }
        setProfile(null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        // Nuvem indisponível: mantém o acesso já autenticado neste computador.
        const cache = readCachedProfile();
        if (cache) {
          setProfile(cache);
          return;
        }
        setProfile(null);
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId, profileVersion]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(identifier),
      password,
    });

    if (error) {
      const mensagem = error.message ?? "";
      // Falha de rede (nuvem indisponível) não é senha errada: avisa na tela.
      if (/failed to fetch|network|fetch failed|load failed/i.test(mensagem)) {
        throw new Error(
          "Não foi possível falar com a nuvem agora. Verifique a conexão e tente novamente em instantes.",
        );
      }
      throw new Error(traduzErro(mensagem));
    }

    setCloudDown(false);
    offlineRef.current = false;
    setOfflineAccess(false);
    startOfflineServices();
  }, []);

  const enterOffline = useCallback(() => {
    const cached = readCachedProfile();
    if (!cached) {
      throw new Error(
        "Este computador ainda não tem um acesso salvo. Entre uma vez com a nuvem ativa para habilitar o modo contingência.",
      );
    }
    const storedUser = readOfflineUser();
    const synthetic = (storedUser ?? {
      id: cached.userId,
      email: usernameToEmail(cached.username),
    }) as unknown as User;

    setCloudDown(true);
    offlineRef.current = true;
    setOfflineAccess(true);
    setProfile(cached);
    setUser(synthetic);
    setSession(null);
    setLoading(false);
    setProfileLoading(false);
    startOfflineServices();
  }, []);

  const signOut = useCallback(async () => {
    clearCachedProfile();
    offlineRef.current = false;
    setOfflineAccess(false);
    try {
      await supabase.auth.signOut();
    } catch {
      /* nuvem fora: a sessão local já foi encerrada */
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileVersion((version) => version + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      signIn,
      enterOffline,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, loading, profileLoading, signIn, enterOffline, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function traduzErro(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Usuário ou senha incorretos.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirme o e-mail antes de entrar.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Muitas tentativas em pouco tempo. Aguarde um instante.";
  }
  return message;
}
