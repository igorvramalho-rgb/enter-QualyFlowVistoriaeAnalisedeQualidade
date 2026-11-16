import { supabase } from "@/integrations/supabase/client";
import { loadCycles } from "@/lib/cycles";

/**
 * Comparativo entre ciclos (ex.: Pós 60 mai–jul × jul–set): mostra a evolução de
 * um período para o outro, sem misturar as bases.
 */

export interface CycleStat {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  casos: number;
  conformes: number;
  naoConformes: number;
  devolucoes: number;
  emFiscalizacao: number;
  refazer: number;
  respondidos: number;
  rpa: number;
  naoAvaliado: number;
  pctConforme: number;
}

export async function fetchCycleComparison(): Promise<CycleStat[]> {
  const ciclos = await loadCycles(true);

  const { data, error } = await supabase
    .from("qa_cases")
    .select("cycle_id, outcome, cell, returned_count")
    .limit(5000);

  if (error) {
    return [];
  }

  const porCiclo = new Map<string, CycleStat>();
  for (const ciclo of ciclos) {
    porCiclo.set(ciclo.id, {
      id: ciclo.id,
      name: ciclo.name,
      startDate: ciclo.startDate,
      endDate: ciclo.endDate,
      casos: 0,
      conformes: 0,
      naoConformes: 0,
      devolucoes: 0,
      emFiscalizacao: 0,
      refazer: 0,
      respondidos: 0,
      rpa: 0,
      naoAvaliado: 0,
      pctConforme: 0,
    });
  }

  for (const row of data ?? []) {
    const ciclo = row.cycle_id ? porCiclo.get(row.cycle_id) : undefined;
    if (!ciclo) {
      continue;
    }
    ciclo.casos += 1;
    ciclo.devolucoes += row.returned_count ?? 0;
    if (row.outcome === "conforme") ciclo.conformes += 1;
    if (row.outcome === "nao_conforme") ciclo.naoConformes += 1;
    if (row.cell === "fiscalizacao") ciclo.emFiscalizacao += 1;
    if (row.cell === "refazer") ciclo.refazer += 1;
    if (row.cell === "respondidos") ciclo.respondidos += 1;
    if (row.cell === "rpa") ciclo.rpa += 1;
    if (row.cell === "nao_avaliado") ciclo.naoAvaliado += 1;
  }

  const lista = Array.from(porCiclo.values()).map((ciclo) => ({
    ...ciclo,
    pctConforme: ciclo.casos > 0 ? Math.round((ciclo.conformes / ciclo.casos) * 100) : 0,
  }));

  // Mais antigo primeiro (para ler a evolução da esquerda para a direita).
  return lista.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
