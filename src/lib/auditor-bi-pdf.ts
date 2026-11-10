import { jsPDF } from "jspdf";

/**
 * Relatório do Painel BI — uma página, moderna, com o essencial:
 * quantas FV/OS foram avaliadas e como estão distribuídas nas células.
 */

export interface BiCell {
  key?: string;
  label: string;
  total: number;
  conformes: number;
  naoConformes: number;
  devolucoes: number;
  pct: number;
  servicos: string[];
  analise: string;
}

export interface BiPdfData {
  periodo: string;
  /** Data de início da medição (editável antes de gerar). */
  medicaoInicio: string;
  totalUnicas: number;
  conformes: number;
  naoConformes: number;
  pendentes: number;
  cells: BiCell[];
  motivos: { motivo: string; total: number }[];
  resumo: string;
  conclusao: string;
  emitidoEm: string;
}

const W = 210;
const H = 297;
const M = 16;

const NAVY: [number, number, number] = [11, 31, 58];
const INK: [number, number, number] = [30, 41, 59];
const SLATE: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];

const CORES: [number, number, number][] = [
  [29, 78, 216], // fiscalização
  [220, 38, 38], // refazer
  [5, 150, 105], // respondidos
  [124, 58, 237], // RPA
  [100, 116, 139], // N/A
];

function fill(doc: jsPDF, cor: [number, number, number]) {
  doc.setFillColor(cor[0], cor[1], cor[2]);
}

function ink(doc: jsPDF, cor: [number, number, number]) {
  doc.setTextColor(cor[0], cor[1], cor[2]);
}

function cartao(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  cor: [number, number, number],
  rotulo: string,
  valor: number,
  pct: number,
) {
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, "S");

  fill(doc, cor);
  doc.roundedRect(x, y, 2.2, h, 1, 1, "F");

  ink(doc, SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const linhas = doc.splitTextToSize(rotulo.toUpperCase(), w - 12) as string[];
  doc.text(linhas.slice(0, 2), x + 6, y + 7);

  ink(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(String(valor), x + 6, y + 20);

  ink(doc, cor);
  doc.setFontSize(9);
  doc.text(`${pct}%`, x + w - 6, y + 20, { align: "right" });
}

export function buildBiPdf(data: BiPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // Faixa superior
  fill(doc, NAVY);
  doc.rect(0, 0, W, 52, "F");

  ink(doc, [148, 163, 184]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Q U A L Y   A U D I T O R", M, 13);
  doc.text("INTELIGÊNCIA DE FISCALIZAÇÃO", M, 17.5);

  ink(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Foram avaliadas", M, 29);

  doc.setFontSize(34);
  doc.text(String(data.totalUnicas), M, 42);

  const larguraNumero = doc.getTextWidth(String(data.totalUnicas));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("FV/OS", M + larguraNumero + 3, 42);

  doc.setFontSize(7.5);
  ink(doc, [203, 213, 225]);
  doc.text(`PERÍODO DE EMISSÃO: ${data.periodo}`, W - M, 34, { align: "right" });
  doc.text(`MEDIÇÃO INICIADA EM ${data.medicaoInicio}`, W - M, 39, { align: "right" });
  ink(doc, [148, 163, 184]);
  doc.text("VILA MARIA E SANTANA", W - M, 44, { align: "right" });

  // Cartões das células
  let y = 62;
  const largura = (W - M * 2 - 8) / 3;

  data.cells.slice(0, 3).forEach((cell, index) => {
    cartao(doc, M + index * (largura + 4), y, largura, 30, CORES[index], cell.label, cell.total, cell.pct);
  });

  y += 34;
  const largura2 = (W - M * 2 - 4) / 2;
  data.cells.slice(3, 5).forEach((cell, index) => {
    cartao(
      doc,
      M + index * (largura2 + 4),
      y,
      largura2,
      30,
      CORES[index + 3],
      cell.label,
      cell.total,
      cell.pct,
    );
  });

  // Barra empilhada
  y += 42;
  ink(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DISTRIBUIÇÃO DAS FV/OS", M, y);

  y += 4;
  const barraW = W - M * 2;
  const total = data.cells.reduce((soma, cell) => soma + cell.total, 0) || 1;
  let cursor = M;

  fill(doc, LINE);
  doc.rect(M, y, barraW, 9, "F");

  data.cells.forEach((cell, index) => {
    const fraction = cell.total / total;
    if (fraction <= 0) {
      return;
    }
    fill(doc, CORES[index]);
    doc.rect(cursor, y, barraW * fraction, 9, "F");
    cursor += barraW * fraction;
  });

  // Legenda
  y += 16;
  const colunaW = (barraW - 8) / 2;

  data.cells.forEach((cell, index) => {
    const coluna = index % 2;
    const linha = Math.floor(index / 2);
    const x = M + coluna * (colunaW + 8);
    const direita = x + colunaW;
    const yy = y + linha * 6.5;

    fill(doc, CORES[index]);
    doc.roundedRect(x, yy - 2.4, 3.2, 3.2, 0.8, 0.8, "F");

    ink(doc, INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(cell.label, x + 5.5, yy);

    doc.setFont("helvetica", "bold");
    doc.text(`${cell.total}`, direita - 13, yy, { align: "right" });
    doc.setFont("helvetica", "normal");
    ink(doc, SLATE);
    doc.text(`${cell.pct}%`, direita, yy, { align: "right" });
  });

  // Análise
  y += 26;
  ink(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ANÁLISE", M, y);
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, W - M, y + 1.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  ink(doc, INK);
  const texto = doc.splitTextToSize(data.resumo, W - M * 2) as string[];
  doc.text(texto, M, y + 7);

  // Destaques
  y += 8 + texto.length * 4.2 + 8;
  ink(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESTAQUES", M, y);
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.line(M, y + 1.5, W - M, y + 1.5);

  const maior = [...data.cells].sort((a, b) => b.total - a.total)[0];
  const destaques: [string, string][] = [
    ["Célula com maior volume", maior ? `${maior.label} — ${maior.total} (${maior.pct}%)` : "—"],
    ["Conformidades confirmadas", `${data.conformes} FV/OS`],
    ["Não conformidades confirmadas", `${data.naoConformes} FV/OS`],
    ["FV/OS únicas no período", `${data.totalUnicas}`],
  ];

  let dy = y + 8;
  destaques.forEach(([rotulo, valor]) => {
    ink(doc, SLATE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(rotulo, M, dy);

    ink(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.text(valor, W - M, dy, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(M, dy + 1.5, W - M, dy + 1.5);
    dy += 7;
  });

  // Rodapé
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.2);
  doc.line(M, H - 14, W - M, H - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  ink(doc, SLATE);
  doc.text("Criado por Igor Ramalho  ·  Qualy Auditor", M, H - 9);
  doc.text(data.emitidoEm, W - M, H - 9, { align: "right" });

  return doc;
}
