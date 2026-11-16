import type { AuditorReport, CaseRow } from "@/lib/auditor";
import { deriveNumbersFromFileName } from "@/lib/fields";

/**
 * Índice de endereços por FV (FAC) e por OS.
 *
 * Serve para o Excel conseguir o endereço mesmo quando a tratativa está sem o
 * campo: procura em todas as fontes já cadastradas (tratativas, PDFs importados
 * e relatórios do Emissor) pelo número da FV ou da OS.
 */

export interface AddressIndex {
  porFac: Map<string, string>;
  porOs: Map<string, string>;
}

export interface DocumentAddressSource {
  fields: Record<string, string>;
  fileName: string;
}

function guardar(mapa: Map<string, string>, chave: string, endereco: string) {
  const valor = endereco.trim();
  const atual = mapa.get(chave);
  if (!chave || !valor) {
    return;
  }
  // Mantém o endereço mais completo (com número) quando há mais de um.
  if (!atual || valor.length > atual.length) {
    mapa.set(chave, valor);
  }
}

export function buildAddressIndex(input: {
  cases: CaseRow[];
  documents: DocumentAddressSource[];
  reports: AuditorReport[];
}): AddressIndex {
  const porFac = new Map<string, string>();
  const porOs = new Map<string, string>();

  for (const row of input.cases) {
    if (row.address) {
      guardar(porFac, row.fac, row.address);
      guardar(porOs, row.os, row.address);
    }
  }

  for (const doc of input.documents) {
    const doNome = deriveNumbersFromFileName(doc.fileName ?? "");
    const fac = (doc.fields?.fac ?? "").trim() || doNome.fac;
    const os = (doc.fields?.os ?? "").trim() || doNome.os;
    const endereco = (doc.fields?.endereco ?? "").trim();
    if (!endereco) {
      continue;
    }
    guardar(porFac, fac, endereco);
    guardar(porOs, os, endereco);
  }

  for (const report of input.reports) {
    const valores = report.values ?? {};
    const doNome = deriveNumbersFromFileName(valores.arquivo ?? "");
    const fac = (valores.fac ?? "").trim() || doNome.fac;
    const os = (valores.os ?? "").trim() || doNome.os;
    const endereco = (valores.endereco ?? "").trim();
    if (!endereco) {
      continue;
    }
    guardar(porFac, fac, endereco);
    guardar(porOs, os, endereco);
  }

  return { porFac, porOs };
}

/** Endereço da própria tratativa; se faltar, busca por FV e depois por OS. */
export function resolveAddress(row: CaseRow, index: AddressIndex): string {
  const proprio = (row.address ?? "").trim();
  if (proprio) {
    return proprio;
  }
  const porFac = index.porFac.get((row.fac ?? "").trim());
  if (porFac) {
    return porFac;
  }
  return index.porOs.get((row.os ?? "").trim()) ?? "";
}
