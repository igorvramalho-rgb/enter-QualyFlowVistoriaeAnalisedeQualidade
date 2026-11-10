import { jsPDF } from "jspdf";

/**
 * Relatório gerencial em PDF vetorial (sem captura de tela).
 * Layout A4, 3 páginas: resumo, análise por célula e motivos/conclusão.
 */

export interface BiCell {
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

const M = 14; // margem
const W = 210;
const H = 297;

const NAVY: [number, number, number] = [15, 42, 74];
const SLATE: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [30, 41, 59];
const GREEN: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [220, 38, 38];
const LIGHT: [number, number, number] = [226, 232, 240];

function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function capa(doc: jsPDF, data: BiPdfData) {
  setFill(doc, NAVY);
  doc.rect(0, 0, W, 34, "F");
  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("QUALY AUDITOR  ·  INTELIGÊNCIA DE FISCALIZAÇÃO", M, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("RELATÓRIO GERENCIAL DA FISCALIZAÇÃO", M, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Período: ${data.periodo}   ·   Regiões: Vila Maria e Santana`, M, 28);

  const kpis: [string, number, [number, number, number]][] = [
    ["FV/OS únicas", data.totalUnicas, INK],
    ["Conformes", data.conformes, GREEN],
    ["Não conformes", data.naoConformes, RED],
    ["Pendências abertas", data.pendentes, [180, 83, 9]],
  ];

  const boxW = (W - M * 2 - 9) / 4;
  kpis.forEach(([label, value, color], index) => {
    const x = M + index * (boxW + 3);
    doc.setDrawColor(210, 216, 224);
    doc.setLineWidth(0.2);
    doc.rect(x, 40, boxW, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setText(doc, SLATE);
    doc.text(label.toUpperCase(), x + 3, 46);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setText(doc, color);
    doc.text(String(value), x + 3, 55);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, NAVY);
  doc.text("RESUMO EXECUTIVO", M, 70);
  doc.setDrawColor(15, 42, 74);
  doc.setLineWidth(0.4);
  doc.line(M, 71.5, W - M, 71.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, INK);
  const linhas = doc.splitTextToSize(data.resumo, W - M * 2) as string[];
  doc.text(linhas, M, 77);

  let y = 77 + linhas.length * 4.2 + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, NAVY);
  doc.text("DISTRIBUIÇÃO DAS FV/OS POR CÉLULA", M, y);
  doc.setDrawColor(15, 42, 74);
  doc.setLineWidth(0.4);
  doc.line(M, y + 1.5, W - M, y + 1.5);

  y += 8;
  const barX = M + 62;
  const barW = W - M - barX - 16;

  data.cells.forEach((cell) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(doc, INK);
    const rotulo = doc.splitTextToSize(cell.label, 58) as string[];
    doc.text(rotulo[0], M, y + 3.5);

    setFill(doc, LIGHT);
    doc.rect(barX, y, barW, 5, "F");
    setFill(doc, NAVY);
    doc.rect(barX, y, (barW * Math.max(0, Math.min(100, cell.pct))) / 100, 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, INK);
    doc.text(String(cell.total), W - M - 12, y + 3.8, { align: "right" });
    doc.setFont("helvetica", "normal");
    setText(doc, SLATE);
    doc.text(`${cell.pct}%`, W - M, y + 3.8, { align: "right" });

    y += 8;
  });
}

function paginaCelulas(doc: jsPDF, data: BiPdfData) {
  doc.addPage();

  setText(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ANÁLISE POR CÉLULA DE TRABALHO", M, 18);
  setText(doc, SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Período: ${data.periodo}`, M, 23);

  doc.setDrawColor(15, 42, 74);
  doc.setLineWidth(0.4);
  doc.line(M, 25, W - M, 25);

  let y = 32;

  data.cells.forEach((cell, index) => {
    const altura = 40;
    if (y + altura > H - 20) {
      return;
    }

    doc.setDrawColor(214, 220, 228);
    doc.setLineWidth(0.2);
    doc.rect(M, y, W - M * 2, altura);

    // faixa lateral
    setFill(doc, NAVY);
    doc.rect(M, y, 1.6, altura, "F");

    setText(doc, INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${String(index + 1).padStart(2, "0")}  ${cell.label}`, M + 5, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, SLATE);
    doc.text(`${cell.total} FV/OS  ·  ${cell.pct}% do total`, W - M - 5, y + 7, { align: "right" });

    // barra empilhada
    const barX = M + 5;
    const barW = W - M * 2 - 10;
    const barY = y + 11;
    setFill(doc, LIGHT);
    doc.rect(barX, barY, barW, 4, "F");

    const pctConforme = cell.total > 0 ? (cell.conformes / cell.total) * 100 : 0;
    const pctNao = cell.total > 0 ? (cell.naoConformes / cell.total) * 100 : 0;
    if (pctConforme > 0) {
      setFill(doc, GREEN);
      doc.rect(barX, barY, (barW * pctConforme) / 100, 4, "F");
    }
    if (pctNao > 0) {
      setFill(doc, RED);
      doc.rect(barX + (barW * pctConforme) / 100, barY, (barW * pctNao) / 100, 4, "F");
    }
    const restante = Math.max(0, 100 - pctConforme - pctNao);
    if (restante > 0) {
      setFill(doc, NAVY);
      doc.rect(barX + (barW * (pctConforme + pctNao)) / 100, barY, (barW * restante) / 100, 4, "F");
    }

    doc.setFontSize(7);
    setText(doc, SLATE);
    doc.text(
      `Conforme: ${cell.conformes}   |   Não conforme: ${cell.naoConformes}   |   Em aberto: ${Math.max(
        0,
        cell.total - cell.conformes - cell.naoConformes,
      )}   |   Devoluções: ${cell.devolucoes}`,
      barX,
      y + 20,
    );

    doc.setFontSize(7.5);
    setText(doc, INK);
    const frase = doc.splitTextToSize(cell.analise, barW) as string[];
    doc.text(frase.slice(0, 3), barX, y + 26);

    if (cell.servicos.length > 0) {
      doc.setFontSize(6.5);
      setText(doc, SLATE);
      doc.text(`Serviços: ${cell.servicos.join("  ·  ")}`, barX, y + 37);
    }

    y += altura + 4;
  });
}

function paginaMotivos(doc: jsPDF, data: BiPdfData) {
  doc.addPage();

  setText(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MOTIVOS DE NÃO AVALIAÇÃO", M, 18);
  doc.setDrawColor(15, 42, 74);
  doc.setLineWidth(0.4);
  doc.line(M, 20.5, W - M, 20.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, SLATE);
  doc.text(
    "Serviços registrados na célula N/A (endereço não localizado, impedimento, divergência etc.).",
    M,
    25,
  );

  let y = 32;
  const totalMotivos = data.motivos.reduce((soma, item) => soma + item.total, 0);
  const maximo = Math.max(...data.motivos.map((item) => item.total), 1);

  if (data.motivos.length === 0) {
    setText(doc, SLATE);
    doc.setFontSize(8);
    doc.text("Nenhum motivo registrado no período.", M, y);
    y += 10;
  } else {
    data.motivos.slice(0, 10).forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(doc, INK);
      const rotulo = doc.splitTextToSize(item.motivo, 78) as string[];
      doc.text(rotulo[0], M, y + 3);

      const barX = M + 82;
      const barW = W - M - barX - 14;
      setFill(doc, LIGHT);
      doc.rect(barX, y, barW, 4, "F");
      setFill(doc, NAVY);
      doc.rect(barX, y, (barW * item.total) / maximo, 4, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(doc, INK);
      doc.text(String(item.total), W - M, y + 3.5, { align: "right" });

      y += 8;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, SLATE);
    doc.text(`${totalMotivos} ocorrência(s) registrada(s) no período.`, M, y + 2);
    y += 12;
  }

  setText(doc, NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CONCLUSÃO GERENCIAL", M, y + 6);
  doc.setDrawColor(15, 42, 74);
  doc.line(M, y + 7.5, W - M, y + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, INK);
  const conclusao = doc.splitTextToSize(data.conclusao, W - M * 2) as string[];
  doc.text(conclusao, M, y + 13);
}

function rodapes(doc: jsPDF, data: BiPdfData) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 216, 224);
    doc.setLineWidth(0.2);
    doc.line(M, H - 14, W - M, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setText(doc, SLATE);
    doc.text("Criado por Igor Ramalho  ·  Qualy Auditor", M, H - 9);
    doc.text(`Página ${page} de ${total}  ·  ${data.emitidoEm}`, W - M, H - 9, { align: "right" });
  }
}

export function buildBiPdf(data: BiPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  capa(doc, data);
  paginaCelulas(doc, data);
  paginaMotivos(doc, data);
  rodapes(doc, data);
  return doc;
}
