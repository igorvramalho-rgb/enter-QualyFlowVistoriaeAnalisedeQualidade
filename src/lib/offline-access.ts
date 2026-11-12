import type { AppUser } from "@/lib/users";

/**
 * Contingência quando a nuvem está indisponível (pausada, sem rede ou fora do ar).
 *
 * O acesso já autenticado neste computador continua funcionando com os dados
 * do último perfil válido, para o fluxo de trabalho não parar. Os dados que
 * dependem da nuvem ficam limitados e o aplicativo avisa na tela.
 */

const PROFILE_KEY = "qualyflow:perfil-cache:v1";

let cloudDown = false;
const listeners = new Set<() => void>();

export function isCloudDown(): boolean {
  return cloudDown;
}

export function setCloudDown(value: boolean): void {
  if (cloudDown === value) {
    return;
  }
  cloudDown = value;
  listeners.forEach((listener) => listener());
}

export function subscribeCloudDown(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function cacheProfile(profile: AppUser): void {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ profile, at: Date.now() }));
  } catch {
    /* sem armazenamento: segue sem cache */
  }
}

export function readCachedProfile(): AppUser | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { profile?: AppUser };
    return parsed?.profile ?? null;
  } catch {
    return null;
  }
}

export function clearCachedProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignora */
  }
}
