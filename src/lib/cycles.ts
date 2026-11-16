import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ciclos de tratativa — cada leva de Pós 60 (ex.: jul a set/2026) vive no seu
 * próprio ciclo. As células, o BI e as importações trabalham sempre dentro do
 * ciclo selecionado, sem misturar períodos.
 */

export interface AuditCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

const STORAGE_KEY = "qualyflow:ciclo-ativo:v1";

let ciclos: AuditCycle[] = [];
let ativoId: string | null = null;
let carregado = false;
const listeners = new Set<() => void>();

function notificar() {
  listeners.forEach((listener) => listener());
}

export function subscribeCycles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCycles(): AuditCycle[] {
  return ciclos;
}

export function getActiveCycleId(): string | null {
  return ativoId;
}

export function isCyclesLoaded(): boolean {
  return carregado;
}

export function setActiveCycle(id: string | null): void {
  ativoId = id;
  try {
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignora */
  }
  notificar();
}

export async function loadCycles(force = false): Promise<AuditCycle[]> {
  if (carregado && !force) {
    return ciclos;
  }

  const { data, error } = await supabase
    .from("qa_cycles")
    .select("id, name, start_date, end_date, status, created_at")
    .order("start_date", { ascending: false });

  if (error) {
    return ciclos;
  }

  ciclos = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    status: row.status,
    createdAt: row.created_at,
  }));

  carregado = true;

  let guardado: string | null = null;
  try {
    guardado = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    guardado = null;
  }

  if (guardado && ciclos.some((ciclo) => ciclo.id === guardado)) {
    ativoId = guardado;
  } else if (!ativoId || !ciclos.some((ciclo) => ciclo.id === ativoId)) {
    ativoId = ciclos[0]?.id ?? null;
  }

  notificar();
  return ciclos;
}

export async function createCycle(input: {
  name: string;
  startDate: string;
  endDate: string;
}): Promise<AuditCycle | null> {
  const { data, error } = await supabase
    .from("qa_cycles")
    .insert({
      name: input.name.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      status: "aberto",
    })
    .select("id, name, start_date, end_date, status, created_at")
    .single();

  if (error || !data) {
    return null;
  }

  const novo: AuditCycle = {
    id: data.id,
    name: data.name,
    startDate: data.start_date ?? "",
    endDate: data.end_date ?? "",
    status: data.status,
    createdAt: data.created_at,
  };

  ciclos = [novo, ...ciclos];
  carregado = true;
  setActiveCycle(novo.id);
  return novo;
}

/** Hook do ciclo ativo (para as telas reagirem à troca). */
export function useActiveCycle(): string | null {
  return useSyncExternalStore(subscribeCycles, getActiveCycleId, getActiveCycleId);
}

export function useCycles(): AuditCycle[] {
  return useSyncExternalStore(subscribeCycles, getCycles, getCycles);
}
