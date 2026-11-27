import type ExcelJS from "exceljs";
import type { AuditorRedo, AuditorReport, CaseRow, CellKey } from "@/lib/auditor";
import { CELLS, REDO_STATUS } from "@/lib/auditor";
import { daysSince } from "@/lib/auditor";
import { deriveNumbersFromFileName, formatDateBR, formatDateTimeBR } from "@/lib/fields";
import { resolveAddress, type AddressIndex } from "@/lib/address-index";
import { corDaSerie, graficoBarrasCelulas } from "@/lib/auditor-bi-charts";

/**
 * Excel gerencial do Painel BI — gerado 100% no navegador (nenhuma API, nenhum
 * token). Cada célula vira uma aba, com cabeçalho corporativo, filtro e
 * congelamento da primeira linha.
 */

const NAVY = "FF0B1F3A";
const CYAN = "FF22D3EE";
const LINE = "FFD9E2EC";
const ZEBRA = "FFF4F7FA";

/** O Excel não aceita * ? : \\ / [ ] no nome da aba. */
function nomeAba(nome: string): string {
  const limpo = nome.replace(/[*?:\\/[\]]/g, "-").replace(/\s+/g, " ").trim();
  return (limpo || "Aba").slice(0, 31);
}

const COLUNAS = [
  { header: "FV", key: "fac", width: 12 },
  { header: "OS", key: "os", width: 16 },
  { header: "Endereço", key: "address", width: 52 },
  { header: "Tipo de serviço", key: "serviceType", width: 36 },
  { header: "Situação", key: "cell", width: 28 },
];

export interface BiExcelData {
  /** Índice para completar o endereço por FV/OS quando o caso estiver sem. */
  enderecos?: AddressIndex;
  /** Leitura gerencial do período (texto que acompanha os gráficos). */
  leitura?: string;
  /** Comparativo entre ciclos (um período por linha). */
  comparativo?: {
    name: string;
    startDate: string;
    endDate: string;
    casos: number;
    devolucoes: number;
  }[];
  periodo: string;
  medicao: string;
  emitidoEm: string;
  kpis: {
    recebidas: number;
    analisadas: number;
    aguardando: number;
    fiscalizacao: number;
    relatorios: number;
    refazerTotal: number;
    refazerPendentes: number;
    corrigidos: number;
    devolucoes: number;
    encerradas: number;
  };
  cells: { key: CellKey; label: string; total: number; devolucoes: number; pct: number }[];
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

  }
}

const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e", "del"]);

/** Padroniza o endereço: espaços, vírgulas e iniciais maiúsculas. */
export function formatarEndereco(valor: string): string {
  const limpo = valor.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  if (!limpo) {
    return "—";
  }
  return limpo
    .toLowerCase()
    .split(" ")
    .map((palavra, indice) => {
      if (indice > 0 && CONECTORES.has(palavra.replace(/[,.]/g, ""))) {
        return palavra;
      }
      return palavra.replace(/(^|[-.,/])([a-zà-ú])/g, (_, separador, letra) => separador + letra.toUpperCase());
    })
    .join(" ");
}

function linhaCaso(row: CaseRow, indice?: AddressIndex) {
  // Sem FV/OS no cadastro, usa o que o nome do arquivo informa (mesma regra da importação).
  const doNome = deriveNumbersFromFileName(row.fileName ?? "");
  const endereco = indice ? resolveAddress(row, indice) : row.address;
  return {
    fac: row.fac || doNome.fac || "—",
    os: row.os || doNome.os || "—",
    address: formatarEndereco(endereco ? endereco : ""),
    serviceType: row.serviceType || "—",
    cell: CELLS[row.cell]?.label ?? row.cell,
    devolucoes: row.returnedCount,
  };
}

function abaCasos(
  workbook: ExcelJS.Workbook,
  nome: string,
  rows: CaseRow[],
  indice?: AddressIndex,
) {
  const sheet = workbook.addWorksheet(nomeAba(nome), {
    properties: { defaultRowHeight: 18 },
  });
  sheet.columns = COLUNAS;
  rows.forEach((row) => sheet.addRow(linhaCaso(row, indice)));
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
  {
    const devolutivas = devolutivasDetalhe(data.cells);
    sheet.addRow({ indicador: "Executados", valor: devolutivas.respondidos, obs: "célula Executados" });
    sheet.addRow({ indicador: "Defesa Técnica", valor: devolutivas.rpa, obs: "" });
    sheet.addRow({ indicador: "E.F", valor: devolutivas.ef, obs: "fiscalização especial" });
    sheet.addRow({
      indicador: "Devolutivas (soma das três)",
      valor: devolutivas.total,
      obs: "Executados + Defesa Técnica + E.F",
    });
  }
  sheet.addRow({ indicador: "Relatórios enviados", valor: data.kpis.relatorios, obs: "" });
  sheet.addRow({ indicador: "Serviços a refazer", valor: data.kpis.refazerTotal, obs: "" });
  sheet.addRow({ indicador: "Pendentes de refazer", valor: data.kpis.refazerPendentes, obs: "" });
  sheet.addRow({ indicador: "Correções concluídas", valor: data.kpis.corrigidos, obs: "" });
  sheet.addRow({ indicador: "Devoluções da AlphaGeos", valor: data.kpis.devolucoes, obs: "" });
  sheet.addRow({ indicador: "Tratativas encerradas", valor: data.kpis.encerradas, obs: "" });
  sheet.addRow({});
  sheet.addRow({ indicador: "Por célula", valor: "", obs: "" });
  celulasDoRelatorio(data.cells).forEach((cell) => {
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

function abaComparativo(workbook: ExcelJS.Workbook, data: BiExcelData) {
  const sheet = workbook.addWorksheet(nomeAba("Comparativo de ciclos"));
  sheet.columns = [
    { header: "Ciclo", key: "nome", width: 28 },
    { header: "Início", key: "inicio", width: 14 },
    { header: "Fim", key: "fim", width: 14 },
    { header: "FV/OS", key: "casos", width: 10 },
    { header: "Devoluções", key: "devolucoes", width: 12 },
    { header: "Variação (FV/OS)", key: "variacao", width: 16 },
  ];

  const linhas = data.comparativo ?? [];
  linhas.forEach((linha, indice) => {
    const anterior = indice > 0 ? linhas[indice - 1] : null;
    sheet.addRow({
      nome: linha.name,
      inicio: linha.startDate ? formatDateBR(linha.startDate) : "",
      fim: linha.endDate ? formatDateBR(linha.endDate) : "",
      casos: linha.casos,
      devolucoes: linha.devolucoes,
      variacao: anterior ? linha.casos - anterior.casos : "",
    });
  });

  estiloCabecalho(sheet);
  finalizarTabela(sheet, linhas.length, 6);
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


/**
 * Células que entram no relatório (Não executado fica fora da apresentação).
 * O percentual é recalculado sobre o que é exibido, então a coluna fecha em 100%.
 */
function celulasDoRelatorio(cells: BiExcelData["cells"]): BiExcelData["cells"] {
  const visiveis = cells.filter((cell) => cell.key !== "nao_executado");
  const total = visiveis.reduce((soma, cell) => soma + cell.total, 0);
  return total > 0
    ? visiveis.map((cell) => ({ ...cell, pct: Math.round((cell.total / total) * 100) }))
    : visiveis;
}

interface DevolutivasDetalhe {
  respondidos: number;
  ef: number;
  rpa: number;
  total: number;
}

/** Devolutivas = Executados + Defesa Técnica + E.F (as células seguem separadas). */
function devolutivasDetalhe(cells: BiExcelData["cells"]): DevolutivasDetalhe {
  const totalDe = (key: CellKey) => cells.find((cell) => cell.key === key)?.total ?? 0;
  const respondidos = totalDe("respondidos");
  const ef = totalDe("sae");
  const rpa = totalDe("rpa");
  return { respondidos, ef, rpa, total: respondidos + ef + rpa };
}

const PAINEL_NAVY = "FF0B1F3A";
const PAINEL_NAVY_SOFT = "FF14304F";
const PAINEL_CARD = "FFF4F8FD";
const PAINEL_BORDER = "FFD9E2EC";

/** PNG do canvas pronto para o ExcelJS (sem o prefixo data URL). */
function pngBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

function pintarBloco(
  sheet: ExcelJS.Worksheet,
  topo: number,
  esquerda: number,
  fundo: number,
  direita: number,
  cor: string,
) {
  for (let linha = topo; linha <= fundo; linha += 1) {
    for (let coluna = esquerda; coluna <= direita; coluna += 1) {
      sheet.getCell(linha, coluna).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cor },
      };
    }
  }
}

/**
 * Primeira aba: painel visual para apresentação.
 * Tudo é desenhado no navegador (canvas) e entra no arquivo como imagem —
 * nenhuma nuvem, nenhum token, nenhum serviço externo.
 */
function abaPainel(workbook: ExcelJS.Workbook, data: BiExcelData) {
  const sheet = workbook.addWorksheet("Painel BI", {
    properties: { defaultRowHeight: 15, tabColor: { argb: PAINEL_NAVY } },
  });

  sheet.columns = [
    { width: 26 },
    { width: 12 },
    { width: 13 },
    { width: 14 },
    { width: 12 },
    { width: 13 },
    { width: 8 },
    { width: 26 },
    { width: 12 },
    { width: 13 },
    { width: 14 },
    { width: 16 },
  ];

  // Faixa do título.
  pintarBloco(sheet, 1, 1, 2, 12, PAINEL_NAVY);
  sheet.mergeCells("A1:L2");
  const titulo = sheet.getCell("A1");
  titulo.value = "PAINEL BI · QUALY AUDITOR";
  titulo.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
  titulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 16;

  pintarBloco(sheet, 3, 1, 3, 12, PAINEL_NAVY_SOFT);
  sheet.mergeCells("A3:L3");
  const subtitulo = sheet.getCell("A3");
  subtitulo.value = `Período: ${data.periodo}   ·   Medição iniciada em: ${data.medicao}   ·   Emitido em: ${data.emitidoEm}`;
  subtitulo.font = { size: 10, color: { argb: "FFE2F2FB" } };
  subtitulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(3).height = 20;

  // Cartões de indicadores (Devolutivas = Executados + Defesa Técnica + E.F).
  const indicadores = [
    { label: "FV/OS ÚNICAS", valor: data.kpis.recebidas, nota: "cada FV/OS conta uma vez", colunas: 4 },
    {
      label: "DEVOLUTIVAS",
      valor: devolutivasDetalhe(data.cells).total,
      nota: "Executados + Defesa Técnica + E.F",
      colunas: 4,
    },
    { label: "DEVOLUÇÕES", valor: data.kpis.devolucoes, nota: "retornos da AlphaGeos", colunas: 4 },
  ];

  let colunaIndicador = 1;
  indicadores.forEach((item) => {
    const esquerda = colunaIndicador;
    const direita = esquerda + item.colunas - 1;
    colunaIndicador = direita + 1;

    sheet.mergeCells(5, esquerda, 5, direita);
    const label = sheet.getCell(5, esquerda);
    label.value = item.label;
    label.font = { bold: true, size: 8, color: { argb: "FF64748B" } };
    label.alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells(6, esquerda, 6, direita);
    const valor = sheet.getCell(6, esquerda);
    valor.value = item.valor;
    valor.font = { bold: true, size: 20, color: { argb: PAINEL_NAVY } };
    valor.alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells(7, esquerda, 7, direita);
    const nota = sheet.getCell(7, esquerda);
    nota.value = item.nota;
    nota.font = { size: 8, color: { argb: "FF64748B" } };
    nota.alignment = { horizontal: "center", vertical: "middle" };

    pintarBloco(sheet, 5, esquerda, 7, direita, PAINEL_CARD);
    for (let coluna = esquerda; coluna <= direita; coluna += 1) {
      sheet.getCell(7, coluna).border = {
        bottom: { style: "medium", color: { argb: "FF22D3EE" } },
      };
    }
  });

  sheet.getRow(5).height = 14;
  sheet.getRow(6).height = 30;
  sheet.getRow(7).height = 14;

  // Gráfico principal (barras por célula). É o único ponto que depende do
  // canvas do navegador: se falhar, o painel continua válido sem a imagem.
  const cellsRelatorio = celulasDoRelatorio(data.cells);
  let cursor = 9;

  try {
    const barras = graficoBarrasCelulas(
      {
        titulo: "FV/OS por célula operacional",
        subtitulo: "Volume tratado no período, com participação de cada célula",
        series: cellsRelatorio.map((cell, indice) => ({
          label: cell.label,
          valor: cell.total,
          cor: corDaSerie(indice, cell.key),
        })),
        rodape: `${data.kpis.recebidas} FV/OS únicas avaliadas`,
      },
      1000,
      380,
    );

    const idBarras = workbook.addImage({ base64: pngBase64(barras), extension: "png" });
    sheet.addImage(idBarras, {
      tl: { col: 0, row: cursor - 1 },
      ext: { width: 1000, height: 380 },
      editAs: "oneCell",
    });
    cursor += 20;
  } catch {
    /* segue sem o gráfico */
  }

  // Leitura gerencial.
  if (data.leitura) {
    pintarBloco(sheet, cursor + 1, 1, cursor + 1, 12, PAINEL_NAVY);
    sheet.mergeCells(cursor + 1, 1, cursor + 1, 12);
    const rotulo = sheet.getCell(cursor + 1, 1);
    rotulo.value = "LEITURA DO PERÍODO";
    rotulo.font = { bold: true, size: 9, color: { argb: "FFE2F2FB" } };
    rotulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(cursor + 1).height = 18;

    sheet.mergeCells(cursor + 2, 1, cursor + 2, 12);
    const texto = sheet.getCell(cursor + 2, 1);
    texto.value = data.leitura;
    texto.font = { size: 10, color: { argb: "FF1E293B" } };
    texto.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    sheet.getRow(cursor + 2).height = 58;
    cursor += 3;
  }

  // Tabela que sustenta os gráficos.
  const inicioTabela = cursor + 1;
  const cabecalho = sheet.getRow(inicioTabela);
  const colunasTabela = ["Célula", "FV/OS", "% do total", "Devoluções"];
  colunasTabela.forEach((valor, indice) => {
    const cell = cabecalho.getCell(indice + 1);
    cell.value = valor;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAINEL_NAVY } };
    cell.alignment = { vertical: "middle", horizontal: indice === 0 ? "left" : "center" };
  });
  cabecalho.height = 20;

  cellsRelatorio.forEach((cell, indice) => {
    const linha = sheet.getRow(inicioTabela + 1 + indice);
    const valores = [cell.label, cell.total, `${cell.pct}%`, cell.devolucoes];
    valores.forEach((valor, coluna) => {
      const alvo = linha.getCell(coluna + 1);
      alvo.value = valor;
      alvo.font = { size: 9, color: { argb: "FF1E293B" } };
      alvo.alignment = { vertical: "middle", horizontal: coluna === 0 ? "left" : "center" };
      alvo.border = { bottom: { style: "thin", color: { argb: PAINEL_BORDER } } };
      if (indice % 2 === 1) {
        alvo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
    });
  });

  // Fechamento: mostra a composição e a soma de Devolutivas.
  const devolutivas = devolutivasDetalhe(data.cells);
  const linhaComposicao = inicioTabela + cellsRelatorio.length + 1;
  sheet.mergeCells(linhaComposicao, 1, linhaComposicao, 4);
  const composicao = sheet.getCell(linhaComposicao, 1);
  composicao.value = `Devolutivas = Executados (${devolutivas.respondidos}) + Defesa Técnica (${devolutivas.rpa}) + E.F (${devolutivas.ef})`;
  composicao.font = { size: 9, color: { argb: "FF64748B" } };
  composicao.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(linhaComposicao).height = 16;

  const linhaTotal = linhaComposicao + 1;
  sheet.mergeCells(linhaTotal, 1, linhaTotal, 3);
  const rotuloTotal = sheet.getCell(linhaTotal, 1);
  rotuloTotal.value = "DEVOLUTIVAS (SOMA DAS TRÊS)";
  rotuloTotal.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
  rotuloTotal.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  rotuloTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAINEL_NAVY } };
  const celulaTotal = sheet.getCell(linhaTotal, 4);
  celulaTotal.value = devolutivas.total;
  celulaTotal.font = { bold: true, size: 12, color: { argb: PAINEL_NAVY } };
  celulaTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAINEL_CARD } };
  celulaTotal.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(linhaTotal).height = 20;

  return sheet;
}

/** Monta o arquivo .xlsx com todas as abas formatadas. */
export async function buildAuditorWorkbook(data: BiExcelData): Promise<Blob> {
  // Carregado só na exportação: não pesa na abertura do painel.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Qualy Auditor";
  workbook.created = new Date();

  abaPainel(workbook, data);
  abaResumo(workbook, data);

  abaCasos(workbook, "Base FV-OS", data.cases, data.enderecos);
  celulasDoRelatorio(data.cells).forEach((cell) => {
    abaCasos(
      workbook,
      cell.label,
      data.cases.filter((row) => row.cell === cell.key),
      data.enderecos,
    );
  });

  if ((data.comparativo ?? []).length > 0) {
    abaComparativo(workbook, data);
  }

  abaRefazer(workbook, data);
  abaRelatorios(workbook, data);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
