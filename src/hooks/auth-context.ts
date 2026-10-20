import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/users";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AppUser | null;
  /** Carregando a sessão inicial. */
  loading: boolean;
  /** Carregando o perfil de acesso do usuário logado. */
  profileLoading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de AuthProvider.");
  }
  return context;
}
