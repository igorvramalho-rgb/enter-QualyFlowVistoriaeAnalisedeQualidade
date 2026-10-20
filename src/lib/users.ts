import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["qualyflow_profiles"]["Row"];

export type UserRole = "gestor" | "vistoriador";
export type UserStatus = "ativo" | "pendente" | "bloqueado";

export interface AppUser {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

const USERNAME_DOMAIN = "qualyflow.local";

/** O login usa o usuário curto; internamente a conta é um e-mail do sistema. */
export function usernameToEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${USERNAME_DOMAIN}`;
}

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

export function toAppUser(row: ProfileRow): AppUser {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    createdAt: row.created_at,
  };
}

export async function fetchProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("qualyflow_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? toAppUser(data) : null;
}

export async function fetchProfiles(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("qualyflow_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return (data ?? []).map(toAppUser);
}

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const payload = (await context.json()) as { error?: string };
      if (payload?.error) {
        return payload.error;
      }
    } catch {
      /* corpo não era JSON */
    }
  }
  return error instanceof Error ? error.message : "Falha ao falar com o servidor.";
}

/** Chamadas administrativas passam pela backend function (somente gestor). */
export async function invokeUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("qualyflow-users", { body });

  if (error) {
    throw new Error(await readFunctionError(error));
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }

  return data as T;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  gestor: "Gestor",
  vistoriador: "Vistoriador",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  ativo: "Ativo",
  pendente: "Aguardando liberação",
  bloqueado: "Bloqueado",
};
