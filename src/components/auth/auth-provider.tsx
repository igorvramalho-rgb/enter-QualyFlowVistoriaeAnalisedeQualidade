import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type AuthContextValue } from "@/hooks/auth-context";

/**
 * Sessão da equipe no Enter Cloud. A sessão é a fonte da verdade: o listener é
 * registrado antes de checar a sessão atual para não perder a restauração.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(traduzErro(error.message));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      throw new Error(traduzErro(error.message));
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading, signIn, signUp, signOut }),
    [user, session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function traduzErro(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Este e-mail já tem conta. Use Entrar.";
  }
  if (text.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (text.includes("unable to validate email") || text.includes("invalid email")) {
    return "Informe um e-mail válido.";
  }
  if (text.includes("email not confirmed")) {
    return "Confirme o e-mail antes de entrar.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Muitas tentativas em pouco tempo. Aguarde um instante.";
  }
  return message;
}
