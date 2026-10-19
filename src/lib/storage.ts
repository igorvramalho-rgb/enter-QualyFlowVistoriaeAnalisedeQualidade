/**
 * Armazenamento local versionado. Os dados do QualyFlow vivem apenas neste
 * navegador — não há backend, então a leitura é defensiva e a escrita trata
 * cota excedida sem quebrar a tela.
 */
export const STORAGE_KEYS = {
  drafts: "qualyflow:drafts:v1",
  analyses: "qualyflow:analyses:v1",
  settings: "qualyflow:settings:v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function storageAvailable(): boolean {
  try {
    const probe = "__qualyflow_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function subscribeStorage(key: string, listener: Listener): () => void {
  const set = listeners.get(key) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(key);
    }
  };
}

function emit(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" };

export function writeStorage<T>(key: string, value: T): WriteResult {
  if (typeof window === "undefined" || !storageAvailable()) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emit(key);
    return { ok: true };
  } catch {
    return { ok: false, reason: "quota" };
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
    emit(key);
  } catch {
    /* ignora falha ao limpar */
  }
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
