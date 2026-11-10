import { importAuditorBatch, type BatchResult } from "@/lib/auditor-save";
import { invalidateAuditorCache, type CellKey } from "@/lib/auditor";

/**
 * Fila de importação em nível de módulo: continua rodando e mantém o progresso
 * mesmo se o usuário sair da célula e voltar. Sem isso, a navegação perdia o
 * estado da importação no meio.
 */

export interface QueueState {
  running: boolean;
  cell: CellKey | null;
  done: number;
  total: number;
  name: string;
  result: BatchResult | null;
  error: string;
}

let state: QueueState = {
  running: false,
  cell: null,
  done: 0,
  total: 0,
  name: "",
  result: null,
  error: "",
};

const listeners = new Set<() => void>();

export function getQueueState(): QueueState {
  return state;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(patch: Partial<QueueState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function stopImport(): void {
  cancelar = true;
}

let cancelar = false;

export async function startImport(files: File[], cell: CellKey, ocr: boolean): Promise<void> {
  if (state.running) {
    return;
  }

  cancelar = false;
  emit({ running: true, cell, done: 0, total: files.length, name: "", result: null, error: "" });

  try {
    const result = await importAuditorBatch({
      files,
      cell,
      ocr,
      onProgress: (progress) => emit({ done: progress.done, total: progress.total, name: progress.name }),
      shouldCancel: () => cancelar,
    });
    invalidateAuditorCache();
    emit({ running: false, result });
  } catch (problem) {
    emit({
      running: false,
      error: problem instanceof Error ? problem.message : "Falha na importação",
    });
  }
}
