/**
 * Armazenamento local do modo contingência.
 *
 * Guarda uma cópia das tabelas, os arquivos (PDF/fotos) e a fila de operações
 * pendentes. IndexedDB é o preferido; se o navegador bloquear, um espelho em
 * memória mantém o sistema funcionando até recarregar a página.
 */

export interface PendingRequest {
  id?: number;
  kind: "rest" | "storage";
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bucket?: string;
  path?: string;
  createdAt: number;
  attempts: number;
}

const DB_NAME = "qualyflow-contingencia";
const DB_VERSION = 1;
const TABLES = "tables";
const BLOBS = "blobs";
const OUTBOX = "outbox";
const META = "meta";

interface BlobRecord {
  blob: Blob;
  contentType: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TABLES)) {
        db.createObjectStore(TABLES);
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS);
      }
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/* Espelho em memória: usado quando o IndexedDB não está disponível. */
const memory = {
  tables: new Map<string, unknown[]>(),
  blobs: new Map<string, BlobRecord>(),
  outbox: [] as PendingRequest[],
  meta: new Map<string, unknown>(),
  nextId: 1,
};

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let tx: IDBTransaction;
        try {
          tx = db.transaction(store, mode);
        } catch {
          resolve(null);
          return;
        }
        const objectStore = tx.objectStore(store);
        let request: IDBRequest<T>;
        try {
          request = action(objectStore);
        } catch {
          resolve(null);
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      }),
  );
}

export async function readRows<T>(table: string): Promise<T[]> {
  const rows = await run<T[]>(TABLES, "readonly", (store) => store.get(table) as IDBRequest<T[]>);
  if (Array.isArray(rows)) {
    return rows;
  }
  return (memory.tables.get(table) as T[] | undefined) ?? [];
}

export async function writeRows<T>(table: string, rows: T[]): Promise<void> {
  memory.tables.set(table, rows);
  const db = await openDb();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(TABLES, "readwrite");
      tx.objectStore(TABLES).put(rows, table);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearRows(table: string): Promise<void> {
  await writeRows(table, []);
}

export async function putBlob(path: string, blob: Blob, contentType: string): Promise<void> {
  const record: BlobRecord = { blob, contentType: contentType || blob.type || "application/octet-stream", updatedAt: Date.now() };
  memory.blobs.set(path, record);
  const db = await openDb();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(BLOBS, "readwrite");
      tx.objectStore(BLOBS).put(record, path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getBlob(path: string): Promise<BlobRecord | null> {
  const record = await run<BlobRecord>(BLOBS, "readonly", (store) => store.get(path) as IDBRequest<BlobRecord>);
  if (record && record.blob) {
    return record;
  }
  return memory.blobs.get(path) ?? null;
}

export async function listBlobPaths(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>(BLOBS, "readonly", (store) => store.getAllKeys());
  const fromDb = (keys ?? []).map((key) => String(key));
  const all = new Set([...fromDb, ...memory.blobs.keys()]);
  return Array.from(all);
}

export async function enqueue(request: PendingRequest): Promise<number> {
  const record: PendingRequest = { ...request, createdAt: request.createdAt || Date.now(), attempts: request.attempts ?? 0 };
  const key = await run<IDBValidKey>(OUTBOX, "readwrite", (store) => store.add(record));
  if (typeof key === "number") {
    return key;
  }
  const id = memory.nextId;
  memory.nextId += 1;
  memory.outbox.push({ ...record, id });
  return id;
}

export async function listOutbox(): Promise<PendingRequest[]> {
  const rows = await run<PendingRequest[]>(OUTBOX, "readonly", (store) => store.getAll());
  if (Array.isArray(rows) && rows.length > 0) {
    return rows;
  }
  return [...memory.outbox];
}

export async function removeOutbox(id: number | undefined): Promise<void> {
  if (id === undefined) {
    return;
  }
  await run(OUTBOX, "readwrite", (store) => store.delete(id));
  memory.outbox = memory.outbox.filter((item) => item.id !== id);
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const value = await run<T>(META, "readonly", (store) => store.get(key) as IDBRequest<T>);
  if (value !== null && value !== undefined) {
    return value;
  }
  return (memory.meta.get(key) as T | undefined) ?? null;
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  memory.meta.set(key, value);
  await run(META, "readwrite", (store) => store.put(value, key));
}

export async function clearLocalData(): Promise<void> {
  memory.tables.clear();
  memory.blobs.clear();
  memory.outbox = [];
  memory.meta.clear();
  const db = await openDb();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([TABLES, BLOBS, OUTBOX, META], "readwrite");
      tx.objectStore(TABLES).clear();
      tx.objectStore(BLOBS).clear();
      tx.objectStore(OUTBOX).clear();
      tx.objectStore(META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
