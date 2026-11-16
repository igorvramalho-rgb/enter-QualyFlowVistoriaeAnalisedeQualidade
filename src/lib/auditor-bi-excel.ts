import type ExcelJS from "exceljs";
import type { AuditorRedo, AuditorReport, CaseRow, CellKey } from "@/lib/auditor";
import { CELLS, REDO_STATUS } from "@/lib/auditor";
import { daysSince } from "@/lib/auditor";
import { deriveNumbersFromFileName, formatDateBR, formatDateTimeBR } from "@/lib/fields";

/**
 * Excel gerencial do Painel BI — gerado 100% no navegador (nenhuma API, nenhum
 * token). Cada célula vira uma aba, com cabeçalho corporativo, filtro e
 * congelamento da primeira linha.
 */

const NAVY = "FF0B1F3A";
const CYAN = "FF22D3EE";
const LINE = "FFD9E2EC";
const ZEBRA = "FFF4F7FA";
const GREEN = "FF047857";
const RED = "FFB91C1C";

/** O Excel não aceita * ? : \\ / [ ] no nome da aba. */
function nomeAba(nome: string): string {
  const limpo = nome.replace(/[*?:\\/[\]]/g, "-").replace(/\s+/g, " ").trim();
  return (limpo || "Aba").slice(0, 31);
}

const COLUNAS = [
  { header: "FV", key: "fac", width: 12 },
  { header: "OS", key: "os", width: 16 },
  { header: "Endereço", key: "address", width: 46 },
  { header: "Município", key: "municipality", width: 18 },
  { header: "Localidade", key: "locality", width: 20 },
  { header: "Tipo de serviço", key: "serviceType", width: 34 },
  { header: "Célula", key: "cell", width: 24 },
  { header: "Resultado", key: "outcome", width: 14 },
  { header: "Devoluções", key: "devolucoes", width: 12 },
];

export interface BiExcelData {
  periodo: string;
  medicao: string;
  emitidoEm: string;
  kpis: {
    recebidas: number;
    analisadas: number;
    aguardando: number;
    fiscalizacao: number;
    conforme: number;
    naoConforme: number;
    relatorios: number;
    refazerTotal: number;
    refazerPendentes: number;
    corrigidos: number;
    devolucoes: number;
    encerradas: number;
  };
  cells: { key: CellKey; label: string; total: number; conformes: number; naoConformes: number; devolucoes: number; pct: number }[];
  cases: CaseRow[];
  redo: AuditorRedo[];
  reports: AuditorReport[];
}

function estiloCabecalho(sheet: ExcelJS.Worksheet) {
  const cabecalho = sheet.getRow(1);
  cabecalho.height = 26;
  cabecalho.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "medium", color: { argb: CYAN } } };
  });
}

function finalizarTabela(sheet: ExcelJS.Worksheet, totalLinhas: number, ultimaColuna: number) {
  if (totalLinhas > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalLinhas + 1, column: ultimaColuna } };
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (let linha = 2; linha <= totalLinhas + 1; linha += 1) {
    const row = sheet.getRow(linha);
    row.height = 18;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
      if (linha % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      cell.alignment = { vertical: "middle" };
    });

    const resultado = row.getCell(8);
    const texto = String(resultado.value ?? "");
    if (texto === "conforme") {
      resultado.font = { color: { argb: GREEN }, bold: true };
    } else if (texto === "nao_conforme") {
      resultado.font = { color: { argb: RED }, bold: true };
    }
  }
}

function valorResultado(outcome: string): string {
  if (outcome === "conforme") return "conforme";
  if (outcome === "nao_conforme") return "nao_conforme";
  return "pendente";
}

function linhaCaso(row: CaseRow) {
  // Sem FV/OS no cadastro, usa o que o nome do arquivo informa (mesma regra da importação).
  const doNome = deriveNumbersFromFileName(row.fileName ?? "");
  return {
    fac: row.fac || doNome.fac || "",
    os: row.os || doNome.os || "",
    address: row.address,
    municipality: row.municipality,
    locality: row.locality,
    serviceType: row.serviceType,
    cell: CELLS[row.cell]?.label ?? row.cell,
    outcome: valorResultado(row.outcome),
    devolucoes: row.returnedCount,
  };
}

function abaCasos(workbook: ExcelJS.Workbook, nome: string, rows: CaseRow[]) {
  const sheet = workbook.addWorksheet(nomeAba(nome), {
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = COLUNAS;
  rows.forEach((row) => sheet.addRow(linhaCaso(row)));
  estiloCabecalho(sheet);
  finalizarTabela(sheet, rows.length, COLUNAS.length);
  return sheet;
}

function abaResumo(workbook: ExcelJS.Workbook, data: BiExcelData) {
  const sheet = workbook.addWorksheet(nomeAba("Resumo"));
  sheet.columns = [
    { header: "Indicador", key: "indicador", width: 38 },
    { header: "Valor", key: "valor", width: 20 },
    { header: "Observação", key: "obs", width: 44 },
  ];

  sheet.addRow({ indicador: "Período de emissão", valor: data.periodo, obs: "filtro aplicado no painel" });
  sheet.addRow({ indicador: "Medição iniciada em", valor: data.medicao, obs: "" });
  sheet.addRow({ indicador: "Emitido em", valor: data.emitidoEm, obs: "gerado no navegador, sem uso de IA" });
  sheet.addRow({});
  sheet.addRow({ indicador: "FV/OS únicas", valor: data.kpis.recebidas, obs: "cada FV/OS conta uma vez" });
  sheet.addRow({ indicador: "Analisadas", valor: data.kpis.analisadas, obs: "" });
  sheet.addRow({ indicador: "Aguardando análise", valor: data.kpis.aguardando, obs: "" });
  sheet.addRow({ indicador: "Em fiscalização", valor: data.kpis.fiscalizacao, obs: "" });
  sheet.addRow({ indicador: "Conformes", valor: data.kpis.conforme, obs: "" });
  sheet.addRow({ indicador: "Não conformes", valor: data.kpis.naoConforme, obs: "" });
  sheet.addRow({ indicador: "Relatórios enviados", valor: data.kpis.relatorios, obs: "" });
  sheet.addRow({ indicador: "Serviços a refazer", valor: data.kpis.refazerTotal, obs: "" });
  sheet.addRow({ indicador: "Pendentes de refazer", valor: data.kpis.refazerPendentes, obs: "" });
  sheet.addRow({ indicador: "Correções concluídas", valor: data.kpis.corrigidos, obs: "" });
  sheet.addRow({ indicador: "Devoluções da AlphaGeos", valor: data.kpis.devolucoes, obs: "" });
  sheet.addRow({ indicador: "Tratativas encerradas", valor: data.kpis.encerradas, obs: "" });
  sheet.addRow({});
  sheet.addRow({ indicador: "Por célula", valor: "", obs: "" });
  data.cells.forEach((cell) => {
    sheet.addRow({ indicador: cell.label, valor: cell.total, obs: `${cell.pct}% do total` });
  });

  estiloCabecalho(sheet);
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (let linha = 2; linha <= sheet.rowCount; linha += 1) {
    const row = sheet.getRow(linha);
    row.getCell(1).font = { bold: true, color: { argb: NAVY } };
    row.getCell(2).alignment = { horizontal: "left" };
  }

  return sheet;
}

function abaRefazer(workbook: ExcelJS.Workbook, data: BiExcelData) {
  const sheet = workbook.addWorksheet(nomeAba("Controle de refazer"));
  sheet.columns = [
    { header: "FV", key: "fac", width: 12 },
    { header: "OS", key: "os", width: 16 },
    { header: "Item", key: "item", width: 10 },
    { header: "Equipe", key: "equipe", width: 22 },
    { header: "Encarregado", key: "encarregado", width: 24 },
    { header: "Situação", key: "situacao", width: 26 },
    { header: "Encaminhado", key: "enviado", width: 14 },
    { header: "Programado", key: "programado", width: 14 },
    { header: "Concluído", key: "concluido", width: 14 },
    { header: "Dias", key: "dias", width: 10 },
  ];

  const porCaso = new Map(data.cases.map((row) => [row.id, row]));
  data.redo.forEach((item) => {
    const caso = porCaso.get(item.caseId);
    sheet.addRow({
      fac: caso?.fac ?? "",
      os: caso?.os ?? "",
      item: item.itemCode,
      equipe: item.teamType,
      encarregado: item.foreman,
      situacao: REDO_STATUS[item.status] ?? item.status,
      enviado: item.sentAt ? formatDateBR(item.sentAt) : "",
      programado: item.scheduledAt ? formatDateBR(item.scheduledAt) : "",
      concluido: item.finishedAt ? formatDateBR(item.finishedAt) : "",
      dias: daysSince(item.sentAt) ?? "",
    });
  });

  estiloCabecalho(sheet);
  finalizarTabela(sheet, data.redo.length, 10);
  return sheet;
}

function abaRelatorios(workbook: ExcelJS.Workbook, data: BiExcelData) {
  const sheet = workbook.addWorksheet(nomeAba("Relatórios"));
  sheet.columns = [
    { header: "FV", key: "fac", width: 12 },
    { header: "OS", key: "os", width: 16 },
    { header: "Modelo", key: "modelo", width: 26 },
    { header: "Situação", key: "status", width: 20 },
    { header: "Enviado em", key: "enviado", width: 20 },
  ];

  const porCaso = new Map(data.cases.map((row) => [row.id, row]));
  data.reports.forEach((item) => {
    const caso = porCaso.get(item.caseId);
    sheet.addRow({
      fac: caso?.fac ?? "",
      os: caso?.os ?? "",
      modelo: item.templateId,
      status: item.status === "enviado" ? "enviado" : "rascunho",
      enviado: item.sentAt ? formatDateTimeBR(item.sentAt) : "",
    });
  });

  estiloCabecalho(sheet);
  finalizarTabela(sheet, data.reports.length, 5);
  return sheet;
}

/** Monta o arquivo .xlsx com todas as abas formatadas. */
export async function buildAuditorWorkbook(data: BiExcelData): Promise<Blob> {
  // Carregado só na exportação: não pesa na abertura do painel.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Qualy Auditor";
  workbook.created = new Date();

  abaResumo(workbook, data);

  abaCasos(workbook, "Base FV-OS", data.cases);
  data.cells.forEach((cell) => {
    abaCasos(
      workbook,
      cell.label,
      data.cases.filter((row) => row.cell === cell.key),
    );
  });

  abaRefazer(workbook, data);
  abaRelatorios(workbook, data);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
