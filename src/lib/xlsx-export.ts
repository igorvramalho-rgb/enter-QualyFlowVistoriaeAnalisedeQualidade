/**
 * Geração de planilha Excel (.xlsx) real via SheetJS, carregada sob demanda
 * para não pesar o carregamento inicial do sistema.
 */
export async function downloadXlsx(
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: string[][],
): Promise<void> {
  const XLSX = await import("xlsx");

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = headers.map((header, index) => ({
    wch: columnWidth(header, rows, index),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

function columnWidth(header: string, rows: string[][], index: number): number {
  const longest = rows.reduce((max, row) => Math.max(max, (row[index] ?? "").length), header.length);
  return Math.min(48, Math.max(12, longest + 2));
}
