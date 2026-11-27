/**
 * Modo contingência: o app continua funcionando com a nuvem pausada.
 *
 * - leituras vêm da cópia local (IndexedDB) atualizada automaticamente;
 * - gravações são aplicadas localmente e entram em uma fila;
 * - quando a nuvem volta, a fila é enviada em ordem e a cópia é atualizada.
 *
 * O interceptador atua só nas chamadas do backend (Enter Cloud). Nada mais do
 * navegador é alterado.
 */

import { enqueue, getBlob, listBlobPaths, listOutbox, putBlob, readMeta, removeOutbox, writeMeta, writeRows } from "@/lib/offline/db";
import type { PendingRequest } from "@/lib/offline/db";
import { handleLocalRest } from "@/lib/offline/postgrest";
import { isCloudDown, readCachedProfile, setCloudDown } from "@/lib/offline-access";

const nativeFetch = window.fetch.bind(window);

const SNAPSHOT_TABLES = [
  "qa_cases",
  "qa_documents",
  "qa_document_items",
  "qa_case_events",
  "qa_cycles",
  "qa_redo",
  "qa_reports",
  "qa_sniper_documents",
  "qa_duplicate_uploads",
  "qualyflow_analyses",
  "qualyflow_reports",
  "qualyflow_profiles",
  "qualyflow_settings",
  "qualyflow_user_settings",
];

const TABLES_WITH_ID = new Set([
  "qa_cases",
  "qa_documents",
  "qa_document_items",
  "qa_case_events",
  "qa_cycles",
  "qa_redo",
  "qa_reports",
  "qa_sniper_documents",
  "qa_duplicate_uploads",
  "qualyflow_analyses",
  "qualyflow_reports",
  "qualyflow_settings",
]);

const REFRESH_EVENT = "qualyflow:refresh";
const PROBE_INTERVAL = 20_000;
const SNAPSHOT_INTERVAL = 5 * 60_000;

let backendUrl = "";
let backendKey = "";
let sessionKey = "";
let offline = false;
let ready: Promise<void> | null = null;
let snapshotting = false;
let lastSyncMessage = "";
let probeTimer: number | null = null;
let snapshotTimer: number | null = null;

interface RuntimeStatus {
  offline: boolean;
  pending: number;
  failed: number;
  message: string;
  snapshotAt: number;
}

let status: RuntimeStatus = { offline: false, pending: 0, failed: 0, message: "", snapshotAt: 0 };
const statusListeners = new Set<() => void>();

function emitStatus(): void {
  statusListeners.forEach((listener) => listener());
}

export function subscribeOfflineRuntime(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function offlineRuntime(): RuntimeStatus {
  return status;
}

/** True quando as chamadas já estão sendo atendidas pela cópia local. */
export function offlineActive(): boolean {
  return offline;
}

function updateStatus(patch: Partial<RuntimeStatus>): void {
  status = { ...status, ...patch };
  emitStatus();
}

function markOffline(reason = "Nuvem indisponível"): void {
  offline = true;
  setCloudDown(true);
  updateStatus({ offline: true, message: reason });
  startProbe();
}

function markOnline(): void {
  offline = false;
  setCloudDown(false);
  updateStatus({ offline: false, message: "" });
  stopProbe();
}

function startProbe(): void {
  if (probeTimer !== null) {
    return;
  }
  probeTimer = window.setInterval(() => {
    void probe();
  }, PROBE_INTERVAL);
}

function stopProbe(): void {
  if (probeTimer !== null) {
    window.clearInterval(probeTimer);
    probeTimer = null;
  }
}

async function refreshPending(): Promise<void> {
  try {
    const rows = await listOutbox();
    updateStatus({ pending: rows.length });
    if (rows.length > 0) {
      offUnload();
    }
  } catch {
    /* ignora */
  }
}

let unloadInstalled = false;
function offUnload(): void {
  if (unloadInstalled) {
    return;
  }
  unloadInstalled = true;
  window.addEventListener("beforeunload", (event) => {
    if (status.pending > 0) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

/* -------------------------------------------------------------- transporte */

function isCloudStatus(value: number): boolean {
  return value === 502 || value === 503 || value === 504;
}

async function nativeFetchTimed(request: Request, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await nativeFetch(new Request(request, { signal: controller.signal }));
  } finally {
    window.clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------- sessão */

interface StoredSession {
  access_token?: string;
  refresh_token?: string;
  user?: Record<string, unknown>;
  [key: string]: unknown;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(sessionKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { currentSession?: StoredSession } & StoredSession;
    const session = parsed.currentSession ?? parsed;
    return session && typeof session === "object" ? session : null;
  } catch {
    return null;
  }
}

export function readOfflineUser(): Record<string, unknown> | null {
  return readStoredSession()?.user ?? null;
}

async function accessToken(): Promise<string> {
  const stored = readStoredSession();
  return stored?.access_token ?? "";
}

/* ---------------------------------------------------------------- respostas */

function authJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function localAuthResponse(url: URL, method: string): Response {
  const path = url.pathname;
  const stored = readStoredSession();

  if (path.endsWith("/auth/v1/health") || path.endsWith("/auth/v1/settings")) {
    return authJson({}, 200);
  }
  if (path.endsWith("/auth/v1/user")) {
    if (stored?.user) {
      return authJson(stored.user, 200);
    }
    const cache = readCachedProfile();
    if (cache) {
      return authJson(
        { id: cache.userId, email: `${cache.username}@qualyflow.local`, user_metadata: {}, app_metadata: {} },
        200,
      );
    }
    return authJson({ message: "Sessão local não encontrada" }, 401);
  }
  if (path.endsWith("/auth/v1/logout")) {
    return new Response(null, { status: 204 });
  }
  if (path.endsWith("/auth/v1/token")) {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token" && stored?.access_token) {
      return authJson(
        {
          access_token: stored.access_token,
          token_type: "bearer",
          expires_in: 60,
          expires_at: Math.floor(Date.now() / 1000) + 60,
          refresh_token: stored.refresh_token ?? "",
          user: stored.user ?? null,
        },
        200,
      );
    }
    return authJson(
      { error: "server_error", error_description: "Failed to fetch: nuvem indisponível." },
      503,
    );
  }
  if (method === "POST" && path.includes("/auth/v1/")) {
    return authJson(
      { error: "server_error", error_description: "Failed to fetch: nuvem indisponível." },
      503,
    );
  }
  return authJson({ message: "Recurso de autenticação indisponível no modo local." }, 503);
}

function localStorageResponse(url: URL, method: string): Promise<Response> | Response {
  const match = /\/storage\/v1\/object\/(?:public\/|authenticated\/|sign\/)?([^/]+)\/(.+)$/.exec(url.pathname);
  if (match && method === "GET") {
    const key = `${match[1]}/${match[2]}`;
    return getBlob(key).then((record) =>
      record
        ? new Response(record.blob, { status: 200, headers: { "Content-Type": record.contentType } })
        : new Response("Arquivo não disponível offline", { status: 404 }),
    );
  }
  return new Response(JSON.stringify({ message: "Armazenamento indisponível no modo local." }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------- interceptador */

async function handleBackend(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/rest/v1/")) {
    const bodyText = request.method === "GET" || request.method === "HEAD" ? null : await request.clone().text();
    try {
      const response = await handleLocalRest({
        method: request.method,
        url,
        headers: request.headers,
        bodyText,
      });
      void refreshPending();
      return response;
    } catch (problem) {
      return new Response(
        JSON.stringify({
          code: "LOCAL001",
          message: problem instanceof Error ? problem.message : "Falha na cópia local",
          details: null,
          hint: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  if (url.pathname.startsWith("/auth/v1/")) {
    return localAuthResponse(url, request.method);
  }

  if (url.pathname.startsWith("/storage/v1/")) {
    if (request.method === "GET") {
      return localStorageResponse(url, request.method);
    }
    return new Response(JSON.stringify({ message: "Envio indisponível no modo local." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.pathname.startsWith("/functions/v1/")) {
    return new Response(
      JSON.stringify({ error: "Esta função administrativa precisa da nuvem ativa." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ message: "Serviço indisponível no modo local." }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!ready) {
    return nativeFetch(input, init);
  }
  await ready;

  const href = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  if (!href.startsWith(backendUrl)) {
    return nativeFetch(input, init);
  }

  const request = new Request(input, init);
  const pathname = new URL(request.url).pathname;
  const isStorageUpload = /\/storage\/v1\/object\/(?!sign|public|authenticated)/.test(pathname);
  const timeout = isStorageUpload ? 45_000 : pathname.startsWith("/auth/v1/") ? 8_000 : 12_000;

  if (!offline) {
    try {
      const response = await nativeFetchTimed(request.clone(), timeout);
      if (!isCloudStatus(response.status)) {
        if (request.method !== "GET" && request.method !== "HEAD" && response.ok) {
          markTableDirty(request.url);
        }
        return response;
      }
      markOffline("A nuvem não respondeu");
    } catch {
      markOffline("Sem resposta da nuvem");
    }
  }

  return handleBackend(request);
}

/* ------------------------------------------------------------------ snapshot */

async function snapshotTable(table: string, token: string): Promise<boolean> {
  const params = new URLSearchParams({ select: "*", limit: "500", offset: "0" });
  if (TABLES_WITH_ID.has(table)) {
    params.set("order", "id.asc");
  } else if (table === "qualyflow_profiles") {
    params.set("order", "user_id.asc");
  } else if (table === "qualyflow_user_settings") {
    params.set("order", "user_id.asc");
  }

  const collected: Record<string, unknown>[] = [];

  for (let offset = 0; offset < 20000; offset += 500) {    params.set("offset", String(offset));
    params.set("limit", "500");
    const request = new Request(`${backendUrl}/rest/v1/${table}?${params.toString()}`, {
      headers: {
        apikey: backendKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    let response: Response;
    try {
      response = await nativeFetchTimed(request, 20_000);
    } catch {
      return false;
    }
    if (response.status === 404) {
      return true;
    }
    if (!response.ok) {
      // 4xx costuma ser RLS/tabela: não derruba o modo local por isso.
      return response.status < 500;
    }
    const rows = (await response.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) {
      return false;
    }
    collected.push(...rows);
    if (rows.length < 500) {
      break;
    }
  }

  if (collected.length > 0) {
    await writeRows(table, collected);
  }
  return true;
}

let lastSnapshotAt = 0;
const dirtyTables = new Set<string>();
let dirtyTimer: number | null = null;

/**
 * Depois de uma gravação online, atualiza a cópia local daquela tabela para que
 * uma queda de nuvem logo em seguida não devolva dados antigos.
 */
function markTableDirty(url: string): void {
  if (offline) {
    return;
  }
  let table = "";
  try {
    table = new URL(url).pathname.replace(/^\/rest\/v1\//, "").replace(/\/$/, "");
  } catch {
    return;
  }
  if (!SNAPSHOT_TABLES.includes(table)) {
    return;
  }
  dirtyTables.add(table);
  if (dirtyTimer !== null) {
    window.clearTimeout(dirtyTimer);
  }
  dirtyTimer = window.setTimeout(() => {
    dirtyTimer = null;
    void flushDirtyTables();
  }, 2500);
}

async function flushDirtyTables(): Promise<void> {
  if (offline) {
    return;
  }
  const tables = Array.from(dirtyTables);
  dirtyTables.clear();
  const token = await accessToken();
  if (!token) {
    return;
  }
  for (const table of tables) {
    const ok = await snapshotTable(table, token);
    if (!ok) {
      markOffline("Não foi possível atualizar a cópia local");
      return;
    }
  }
}

async function refreshSnapshot(force = false): Promise<void> {
  if (offline || snapshotting) {
    return;
  }
  if (!force && Date.now() - lastSnapshotAt < 60_000) {
    return;
  }
  // Nunca sobrescrever a cópia local antes de enviar o que foi feito offline.
  if ((await listOutbox()).length > 0) {
    return;
  }
  const token = await accessToken();
  if (!token) {
    return;
  }
  snapshotting = true;
  try {
    for (const table of SNAPSHOT_TABLES) {
      const ok = await snapshotTable(table, token);
      if (!ok) {
        markOffline("Não foi possível atualizar a cópia local");
        return;
      }
    }
    lastSnapshotAt = Date.now();
    await writeMeta("lastSnapshot", lastSnapshotAt);
    updateStatus({ snapshotAt: lastSnapshotAt });
  } finally {
    snapshotting = false;
  }
}

/* -------------------------------------------------------------------- fila */

function isDuplicateError(status: number, body: string): boolean {
  return (
    status === 409 &&
    /23505|duplicate key|já existe|already exists/i.test(body)
  );
}

async function uploadBlob(op: PendingRequest, token: string): Promise<"done" | "retry" | "drop"> {
  if (!op.bucket || !op.path) {
    return "drop";
  }
  const record = await getBlob(`${op.bucket}/${op.path}`);
  if (!record) {
    return "drop";
  }
  const response = await nativeFetchTimed(
    new Request(`${backendUrl}/storage/v1/object/${op.bucket}/${op.path}`, {
      method: "POST",
      headers: {
        apikey: backendKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": record.contentType,
        "x-upsert": "true",
        "cache-control": "3600",
      },
      body: record.blob,
    }),
    120_000,
  );
  if (response.ok) {
    return "done";
  }
  if (isCloudStatus(response.status) || response.status === 401) {
    return "retry";
  }
  return "drop";
}

async function replayRest(op: PendingRequest, token: string): Promise<"done" | "retry" | "drop"> {
  const headers: Record<string, string> = {
    ...op.headers,
    apikey: backendKey,
    Authorization: `Bearer ${token}`,
  };
  if (op.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  const response = await nativeFetchTimed(
    new Request(op.url, {
      method: op.method,
      headers,
      body: op.method === "GET" || op.method === "HEAD" ? undefined : op.body,
    }),
    30_000,
  );
  if (response.ok || response.status === 204) {
    return "done";
  }
  const text = await response.clone().text();
  if (isDuplicateError(response.status, text)) {
    return "done";
  }
  if (isCloudStatus(response.status) || response.status === 401) {
    return "retry";
  }
  return "drop";
}

async function flushOutbox(): Promise<void> {
  if (offline) {
    return;
  }
  const token = await accessToken();
  if (!token) {
    return;
  }
  const pending = await listOutbox();
  let done = 0;
  let dropped = 0;

  for (const op of pending) {
    let result: "done" | "retry" | "drop";
    try {
      result = op.kind === "storage" ? await uploadBlob(op, token) : await replayRest(op, token);
    } catch {
      result = "retry";
    }
    if (result === "retry") {
      markOffline("Sincronização interrompida");
      break;
    }
    if (result === "drop") {
      dropped += 1;
      console.warn("Alteração do modo local não pôde ser enviada", op);
    } else {
      done += 1;
    }
    await removeOutbox(op.id);
  }

  lastSyncMessage =
    done > 0 ? `${done} alteração(ões) sincronizada(s)` : dropped > 0 ? "Algumas alterações não puderam ser enviadas" : "";
  updateStatus({ failed: dropped });
  await refreshPending();
  if (done > 0) {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }
}

/* ------------------------------------------------------------------- saúde */

async function probe(): Promise<boolean> {
  if (!backendUrl) {
    return false;
  }
  try {
    const response = await nativeFetchTimed(
      new Request(`${backendUrl}/auth/v1/health`, { headers: { apikey: backendKey } }),
      8_000,
    );
    if (!response.ok) {
      return false;
    }
  } catch {
    return false;
  }

  markOnline();

  // A sessão pode ter expirado durante a pausa: renova antes de enviar a fila.
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.refreshSession();
  } catch {
    /* segue com a sessão local; a fila para se o servidor recusar */
  }

  await refreshPending();
  await flushOutbox();
  await refreshSnapshot(true);
  window.dispatchEvent(new Event(REFRESH_EVENT));
  return true;
}

export async function syncNow(): Promise<void> {
  const ok = await probe();
  if (!ok) {
    markOffline("A nuvem continua indisponível");
  }
}

/* --------------------------------------------------------- armazenamento */

interface StorageResult<T> {
  data: T;
  error: { message?: string; statusCode?: string | number } | null;
}

type MaybePromise<T> = Promise<T> | T;
type StorageMethod = (...args: unknown[]) => MaybePromise<StorageResult<unknown>>;

interface StorageApi {
  upload: StorageMethod;
  createSignedUrls: StorageMethod;
  createSignedUrl: StorageMethod;
  download: StorageMethod;
  list: StorageMethod;
  remove: StorageMethod;
  [key: string]: unknown;
}

const blobUrls = new Map<string, string>();

function objectUrl(key: string, blob: Blob): string {
  const cached = blobUrls.get(key);
  if (cached) {
    return cached;
  }
  const url = URL.createObjectURL(blob);
  blobUrls.set(key, url);
  return url;
}

async function toBlob(body: unknown, contentType?: string): Promise<Blob> {
  if (body instanceof Blob) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Blob([body], { type: contentType || "application/octet-stream" });
  }
  if (ArrayBuffer.isView(body)) {
    return new Blob([body.buffer as ArrayBuffer], { type: contentType || "application/octet-stream" });
  }
  if (typeof body === "string") {
    return new Blob([body], { type: contentType || "text/plain" });
  }
  return new Blob([], { type: contentType || "application/octet-stream" });
}

function storageErrorLooksOffline(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /fetch|network|timeout|timed out|50[234]|conex/i.test(message);
}

function parseOptions(value: unknown): { contentType?: string; upsert?: boolean } {
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    contentType: typeof record.contentType === "string" ? record.contentType : undefined,
    upsert: record.upsert === true,
  };
}

function wrapFileApi(api: StorageApi, bucket: string, markOfflineNow: () => void): StorageApi {
  const originalUpload = api.upload.bind(api) as StorageMethod;
  const originalSignedUrls = api.createSignedUrls.bind(api) as StorageMethod;
  const originalSignedUrl = api.createSignedUrl.bind(api) as StorageMethod;
  const originalDownload = api.download.bind(api) as StorageMethod;
  const originalList = api.list.bind(api) as StorageMethod;

  const cacheBlob = (path: string, blob: Blob): void => {
    void putBlob(`${bucket}/${path}`, blob, blob.type || "application/octet-stream");
  };

  api.upload = async (pathValue: unknown, bodyValue: unknown, options?: unknown): Promise<StorageResult<unknown>> => {
    const path = String(pathValue);
    const optionsParsed = parseOptions(options);
    const blob = await toBlob(bodyValue, optionsParsed.contentType);

    if (!offline) {
      try {
        const result = (await originalUpload(path, bodyValue, options)) as StorageResult<unknown>;
        if (!result.error) {
          cacheBlob(path, blob);
          return result;
        }
        if (!storageErrorLooksOffline(result.error)) {
          return result;
        }
        markOfflineNow();
      } catch (problem) {
        if (!storageErrorLooksOffline(problem)) {
          throw problem;
        }
        markOfflineNow();
      }
    }

    await putBlob(`${bucket}/${path}`, blob, optionsParsed.contentType || blob.type || "application/octet-stream");
    await enqueue({
      kind: "storage",
      method: "POST",
      url: `${backendUrl}/storage/v1/object/${bucket}/${path}`,
      headers: {},
      bucket,
      path,
      createdAt: Date.now(),
      attempts: 0,
    });
    void refreshPending();
    return {
      data: { path, fullPath: `${bucket}/${path}`, id: crypto.randomUUID() },
      error: null,
    };
  };

  api.createSignedUrls = async (pathsValue: unknown, expiresIn: unknown): Promise<StorageResult<unknown>> => {
    const paths = Array.isArray(pathsValue) ? pathsValue.map(String) : [];

    if (!offline) {
      try {
        const result = (await originalSignedUrls(pathsValue, expiresIn)) as StorageResult<unknown>;
        if (!result.error) {
          const entries = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]) : [];
          entries.forEach((entry) => {
            const path = typeof entry.path === "string" ? entry.path : "";
            const url = typeof entry.signedUrl === "string" ? entry.signedUrl : "";
            if (path && url) {
              void (async () => {
                const existing = await getBlob(`${bucket}/${path}`);
                if (existing) {
                  return;
                }
                try {
                  const response = await nativeFetch(url);
                  if (response.ok) {
                    cacheBlob(path, await response.blob());
                  }
                } catch {
                  /* sem cópia local deste arquivo */
                }
              })();
            }
          });
          return result;
        }
        if (!storageErrorLooksOffline(result.error)) {
          return result;
        }
        markOfflineNow();
      } catch (problem) {
        if (!storageErrorLooksOffline(problem)) {
          throw problem;
        }
        markOfflineNow();
      }
    }

    const data: Record<string, unknown>[] = [];
    for (const path of paths) {
      const record = await getBlob(`${bucket}/${path}`);
      data.push({
        path,
        signedUrl: record ? objectUrl(`${bucket}/${path}`, record.blob) : "",
        error: record ? null : "Arquivo não disponível offline",
      });
    }
    return { data, error: null };
  };

  api.createSignedUrl = async (pathValue: unknown, expiresIn: unknown): Promise<StorageResult<unknown>> => {
    const path = String(pathValue);
    if (!offline) {
      try {
        const result = (await originalSignedUrl(path, expiresIn)) as StorageResult<unknown>;
        if (!result.error) {
          const data = result.data as { signedUrl?: string } | null;
          if (data?.signedUrl) {
            void (async () => {
              const existing = await getBlob(`${bucket}/${path}`);
              if (existing) {
                return;
              }
              try {
                const response = await nativeFetch(data.signedUrl as string);
                if (response.ok) {
                  cacheBlob(path, await response.blob());
                }
              } catch {
                /* sem cópia local deste arquivo */
              }
            })();
          }
          return result;
        }
        if (!storageErrorLooksOffline(result.error)) {
          return result;
        }
        markOfflineNow();
      } catch (problem) {
        if (!storageErrorLooksOffline(problem)) {
          throw problem;
        }
        markOfflineNow();
      }
    }

    const record = await getBlob(`${bucket}/${path}`);
    if (!record) {
      return { data: null, error: { message: "Arquivo não disponível offline" } };
    }
    return { data: { signedUrl: objectUrl(`${bucket}/${path}`, record.blob) }, error: null };
  };

  api.download = async (pathValue: unknown): Promise<StorageResult<unknown>> => {
    const path = String(pathValue);
    if (!offline) {
      try {
        const result = (await originalDownload(path)) as StorageResult<unknown>;
        if (!result.error) {
          const blob = result.data as Blob | null;
          if (blob) cacheBlob(path, blob);
          return result;
        }
        if (!storageErrorLooksOffline(result.error)) {
          return result;
        }
        markOfflineNow();
      } catch (problem) {
        if (!storageErrorLooksOffline(problem)) {
          throw problem;
        }
        markOfflineNow();
      }
    }
    const record = await getBlob(`${bucket}/${path}`);
    return record ? { data: record.blob, error: null } : { data: null, error: { message: "Arquivo não disponível offline" } };
  };

  api.list = async (prefixValue: unknown, options?: unknown): Promise<StorageResult<unknown>> => {
    if (!offline) {
      try {
        const result = (await originalList(prefixValue, options)) as StorageResult<unknown>;
        if (!result.error) {
          return result;
        }
        if (!storageErrorLooksOffline(result.error)) {
          return result;
        }
        markOfflineNow();
      } catch (problem) {
        if (!storageErrorLooksOffline(problem)) {
          throw problem;
        }
        markOfflineNow();
      }
    }
    const prefix = `${bucket}/${String(prefixValue ?? "")}`;
    const paths = await listBlobPaths();
    const items = paths
      .filter((path) => path.startsWith(prefix))
      .map((path) => ({
        name: path.slice(prefix.length),
        id: path,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {},
      }));
    return { data: items, error: null };
  };

  return api;
}

function installStorageFallback(client: {
  storage: { from: (bucket: string) => StorageApi };
}): void {
  const storage = client.storage;
  const prototype = Object.getPrototypeOf(storage) as { from: (bucket: string) => StorageApi };
  const originalFrom = prototype.from;
  prototype.from = function patchedFrom(this: unknown, bucket: string) {
    const api = originalFrom.call(this, bucket);
    return wrapFileApi(api, bucket, () => markOffline("Armazenamento indisponível"));
  };
}

/* ------------------------------------------------------------------ inicial */

async function boot(): Promise<void> {
  const clientModule = await import("@/integrations/supabase/client");
  backendUrl = clientModule.SUPABASE_URL;
  backendKey = clientModule.SUPABASE_PUBLISHABLE_KEY;
  const host = new URL(backendUrl).hostname.split(".")[0];
  sessionKey = `sb-${host}-auth-token`;

  installStorageFallback(clientModule.supabase as unknown as { storage: { from: (bucket: string) => StorageApi } });
  await refreshPending();

  const savedSnapshot = await readMeta<number>("lastSnapshot");
  if (typeof savedSnapshot === "number") {
    lastSnapshotAt = savedSnapshot;
    updateStatus({ snapshotAt: savedSnapshot });
  }

  if (navigator.storage && typeof navigator.storage.persist === "function") {
    void navigator.storage.persist().catch(() => undefined);
  }

  clientModule.supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      void refreshSnapshot();
    }
  });

  void refreshSnapshot();
  snapshotTimer = window.setInterval(() => {
    void refreshSnapshot();
  }, SNAPSHOT_INTERVAL);

  window.addEventListener("online", () => {
    void probe();
  });
}

function install(): void {
  window.fetch = patchedFetch as typeof fetch;
  ready = boot()
    .catch(() => {
      markOffline("Preparando modo contingência");
    })
    .then(() => undefined);
}

install();

export function startOfflineServices(): void {
  if (!ready) {
    return;
  }
  void ready.then(() => {
    void refreshPending().then(() => {
      if (!offline && status.pending > 0) {
        void syncNow();
      }
    });
    void refreshSnapshot();
    if (isCloudDown()) {
      markOffline();
    }
  });
}

export function pendingChanges(): number {
  return status.pending;
}

export function lastSyncResult(): string {
  return lastSyncMessage;
}

export function localMeta(key: string): Promise<unknown> {
  return readMeta(key);
}
