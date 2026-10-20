import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type AuthContextValue } from "@/hooks/auth-context";
import { fetchProfile, usernameToEmail, type AppUser } from "@/lib/users";

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

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data: current }) => {
      setSession(current.session);
      setUser(current.session?.user ?? null);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);

    void fetchProfile(user.id)
      .then((next) => {
        if (active) {
          setProfile(next);
        }
      })
      .catch(() => {
        if (active) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, profileVersion]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(identifier),
      password,
    });

    if (error) {
      throw new Error(traduzErro(error.message));
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfileVersion((version) => version + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, profile, loading, profileLoading, signIn, signOut, refreshProfile }),
    [user, session, profile, loading, profileLoading, signIn, signOut, refreshProfile],
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
