import { supabase } from "@/integrations/supabase/client";
import { CELLS, type CellKey } from "@/lib/auditor";

/**
 * Registro de tentativas duplicadas na importação.
 * O log não guarda o PDF: ele aponta qual arquivo já existia na base para que o
 * operador apague o repetido no computador e limpe o registro aqui.
 */

export interface DuplicateUpload {
  id: string;
  fileName: string;
  existingFileName: string;
  existingCell: string;
  fingerprint: string;
  fac: string;
  os: string;
  origin: "base" | "lote" | "arquivo";
  createdAt: string;
  existingImportedAt: string | null;
}

function rotuloCelula(valor: string): string {
  if (!valor) {
    return "—";
  }
  return CELLS[valor as CellKey]?.label ?? valor;
}

function paraRegistro(row: {
  id: string;
  file_name: string;
  existing_file_name: string;
  existing_cell: string;
  fingerprint: string;
  fac: string;
  os: string;
  origin: string;
  created_at: string;
  existing_imported_at: string | null;
}): DuplicateUpload {
  return {
    id: row.id,
    fileName: row.file_name,
    existingFileName: row.existing_file_name,
    existingCell: row.existing_cell,
    fingerprint: row.fingerprint,
    fac: row.fac,
    os: row.os,
    origin: row.origin === "lote" || row.origin === "arquivo" ? row.origin : "base",
    createdAt: row.created_at,
    existingImportedAt: row.existing_imported_at,
  };
}

export async function fetchDuplicateUploads(): Promise<DuplicateUpload[]> {
  const { data, error } = await supabase
    .from("qa_duplicate_uploads")
    .select("id, file_name, existing_file_name, existing_cell, fingerprint, fac, os, origin, created_at, existing_imported_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(paraRegistro);
}

export async function countDuplicateUploads(): Promise<number> {
  const { count, error } = await supabase
    .from("qa_duplicate_uploads")
    .select("id", { count: "exact", head: true });

  if (error) {
    return 0;
  }
  return count ?? 0;
}

/** Apaga só o registro de duplicidade (documentos e células não são tocados). */
export async function deleteDuplicateUploads(ids?: string[]): Promise<number> {
  if (ids && ids.length > 0) {
    let removidos = 0;
    for (let indice = 0; indice < ids.length; indice += 100) {
      const lote = ids.slice(indice, indice + 100);
      const { error } = await supabase.from("qa_duplicate_uploads").delete().in("id", lote);
      if (error) {
        throw new Error(error.message);
      }
      removidos += lote.length;
    }
    return removidos;
  }

  const total = await countDuplicateUploads();
  const { error } = await supabase
    .from("qa_duplicate_uploads")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");

  if (error) {
    throw new Error(error.message);
  }
  return total;
}

const dataBR = (valor: string | null) => {
  if (!valor) {
    return "";
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleDateString("pt-BR");
};

/** Planilha para localizar e apagar os repetidos no computador. */
export async function buildDuplicatesWorkbook(rows: DuplicateUpload[]): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Qualy Auditor";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Duplicados", {
    properties: { defaultRowHeight: 16, tabColor: { argb: "FFB91C1C" } },
  });

  sheet.columns = [
    { header: "Arquivo duplicado", key: "fileName", width: 46 },
    { header: "Já existia como", key: "existingFileName", width: 46 },
    { header: "Origem", key: "origin", width: 16 },
    { header: "FV", key: "fac", width: 12 },
    { header: "OS", key: "os", width: 16 },
    { header: "Célula do existente", key: "cell", width: 30 },
    { header: "Documento importado em", key: "importedAt", width: 22 },
    { header: "Duplicado detectado em", key: "createdAt", width: 24 },
  ];

  sheet.getRow(1).height = 22;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1F3A" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  rows.forEach((row, indice) => {
    const linha = sheet.addRow({
      fileName: row.fileName,
      existingFileName: row.existingFileName || "—",
      origin:
        row.origin === "lote"
          ? "Mesma FV/OS no lote"
          : row.origin === "arquivo"
            ? "Mesmo arquivo já guardado"
            : "Mesma FV/OS na base",
      fac: row.fac,
      os: row.os,
      cell: rotuloCelula(row.existingCell),
      importedAt: dataBR(row.existingImportedAt),
      createdAt: dataBR(row.createdAt),
    });

    linha.eachCell((cell) => {
      cell.font = { size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      if (indice % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  });

  sheet.autoFilter = { from: "A1", to: `H${Math.max(1, rows.length + 1)}` };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.addRow([]);
  const nota = sheet.addRow([
    "Duplicado = mesmo FV e mesma OS (ou o mesmo arquivo já guardado). Nenhum documento, FV/OS ou célula foi alterado.",
  ]);
  nota.font = { italic: true, size: 9, color: { argb: "FF64748B" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
