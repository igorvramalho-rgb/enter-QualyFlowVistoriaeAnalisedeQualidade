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
let ativoId: string | null = (() => {
  // Recupera a seleção mesmo antes de os ciclos carregarem da nuvem.
  try {
    return window.localStorage.getItem("qualyflow:ciclo-ativo:v1");
  } catch {
    return null;
  }
})();
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
  if (ativoId) {
    return ativoId;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
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

function paraCiclo(row: {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}): AuditCycle {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Edita nome e período de um ciclo (não mexe nas tratativas). */
export async function updateCycle(
  id: string,
  input: { name: string; startDate: string; endDate: string },
): Promise<AuditCycle | null> {
  const { data, error } = await supabase
    .from("qa_cycles")
    .update({
      name: input.name.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
    })
    .eq("id", id)
    .select("id, name, start_date, end_date, status, created_at")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const atualizado = paraCiclo(data);
  ciclos = ciclos.map((ciclo) => (ciclo.id === id ? atualizado : ciclo));
  carregado = true;
  notificar();
  return atualizado;
}

/** Quantas tratativas estão vinculadas ao ciclo. */
export async function countCycleCases(cycleId: string): Promise<number> {
  const { count } = await supabase
    .from("qa_cases")
    .select("*", { count: "exact", head: true })
    .eq("cycle_id", cycleId);
  return count ?? 0;
}

async function moverCasosDoCiclo(caseIds: string[], destino: string): Promise<number> {
  let movidos = 0;
  for (let indice = 0; indice < caseIds.length; indice += 100) {
    const lote = caseIds.slice(indice, indice + 100);
    const { data, error } = await supabase
      .from("qa_cases")
      .update({ cycle_id: destino })
      .in("id", lote)
      .select("id");
    if (error) {
      throw error;
    }
    movidos += data?.length ?? 0;
  }
  return movidos;
}

export interface DeleteCycleResult {
  ok: boolean;
  moved: number;
  error?: string;
}

/**
 * Exclui um ciclo. As tratativas nunca são apagadas: ou passam para outro ciclo
 * (`moveTo`) ou ficam sem ciclo e podem ser vinculadas depois pelo próprio
 * botão "Vincular sem ciclo".
 */
export async function deleteCycle(id: string, moveTo?: string | null): Promise<DeleteCycleResult> {
  const { data: casos, error: erroCasos } = await supabase
    .from("qa_cases")
    .select("id")
    .eq("cycle_id", id)
    .limit(5000);

  if (erroCasos) {
    return { ok: false, moved: 0, error: erroCasos.message };
  }

  // Exclui primeiro: se o perfil não puder (RLS), nada foi alterado.
  const { data: excluidos, error } = await supabase
    .from("qa_cycles")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, moved: 0, error: error.message };
  }

  if (!excluidos || excluidos.length === 0) {
    return {
      ok: false,
      moved: 0,
      error: "Seu perfil não tem permissão para excluir ciclos. A exclusão é restrita ao gestor.",
    };
  }

  let moved = 0;
  let aviso: string | undefined;
  const caseIds = (casos ?? []).map((row) => row.id);

  if (moveTo && caseIds.length > 0) {
    try {
      moved = await moverCasosDoCiclo(caseIds, moveTo);
    } catch (problema) {
      aviso =
        problema instanceof Error
          ? `Ciclo excluído, mas as tratativas não foram movidas: ${problema.message}`
          : "Ciclo excluído, mas as tratativas não foram movidas.";
    }
  }

  ciclos = ciclos.filter((ciclo) => ciclo.id !== id);
  carregado = true;
  if (getActiveCycleId() === id) {
    setActiveCycle(ciclos[0]?.id ?? null);
  } else {
    notificar();
  }

  return { ok: true, moved, error: aviso };
}

/** Quantas tratativas estão sem ciclo. */
export async function countOrphanCases(): Promise<number> {
  const { count } = await supabase
    .from("qa_cases")
    .select("*", { count: "exact", head: true })
    .is("cycle_id", null);
  return count ?? 0;
}

/** Vincula à força as tratativas que ficaram sem ciclo (importações antigas). */
export async function attachOrphanCases(cycleId: string): Promise<number> {
  const { data, error } = await supabase
    .from("qa_cases")
    .update({ cycle_id: cycleId })
    .is("cycle_id", null)
    .select("id");

  if (error) {
    return 0;
  }
  return data?.length ?? 0;
}

export interface DeleteOrphanResult {
  ok: boolean;
  deleted: number;
  error?: string;
}

/**
 * Exclui definitivamente as tratativas que estão sem ciclo. Os registros
 * ligados ao caso (refazer, relatórios e histórico) saem em cascata. Ação
 * restrita ao gestor pela política de exclusão da tabela.
 */
export async function deleteOrphanCases(): Promise<DeleteOrphanResult> {
  let deleted = 0;

  for (let rodada = 0; rodada < 200; rodada += 1) {
    const { data, error } = await supabase
      .from("qa_cases")
      .select("id")
      .is("cycle_id", null)
      .limit(200);

    if (error) {
      return { ok: false, deleted, error: error.message };
    }

    const ids = (data ?? []).map((row) => row.id);
    if (ids.length === 0) {
      return { ok: true, deleted };
    }

    const { data: apagados, error: erroExclusao } = await supabase
      .from("qa_cases")
      .delete()
      .in("id", ids)
      .select("id");

    if (erroExclusao) {
      return { ok: false, deleted, error: erroExclusao.message };
    }

    if (!apagados || apagados.length === 0) {
      return {
        ok: false,
        deleted,
        error: "Seu perfil não tem permissão para excluir tratativas. A exclusão é restrita ao gestor.",
      };
    }

    deleted += apagados.length;
  }

  return { ok: true, deleted };
}

/** Hook do ciclo ativo (para as telas reagirem à troca). */
export function useActiveCycle(): string | null {
  return useSyncExternalStore(subscribeCycles, getActiveCycleId, getActiveCycleId);
}

export function useCycles(): AuditCycle[] {
  return useSyncExternalStore(subscribeCycles, getCycles, getCycles);
}
