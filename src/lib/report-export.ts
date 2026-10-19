import { formatDateBR, slugify } from "@/lib/fields";
import type { ReportValues } from "@/lib/report-document";
import { getTemplate } from "@/lib/report-templates";

export function printReport(): void {
  window.print();
}

/**
 * Download do relatório em PDF.
 *
 * A captura usa a porta de impressão (cópia natural das folhas A4 fora do shell)
 * temporariamente posicionada fora da tela — a pré-visualização na tela é
 * escalada e por isso não serve como fonte da captura. O html2pdf só é baixado
 * quando o usuário pede o arquivo.
 */
export async function downloadReportPdf(fileName: string): Promise<void> {
  const portal = document.getElementById("print-portal");
  if (!portal || portal.childElementCount === 0) {
    throw new Error("Gere o relatório antes de baixar o PDF.");
  }

  portal.classList.add("exporting");
  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const { default: html2pdf } = await import("html2pdf.js");

    await html2pdf()
      .set({
        margin: 0,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: portal.scrollWidth,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(portal)
      .save();
  } finally {
    portal.classList.remove("exporting");
  }
}

export function buildReportFileName(templateId: string, values: ReportValues): string {
  const template = getTemplate(templateId);
  const parts = ["relatorio", slugify(template.shortTitle)];
  if (values.os?.trim()) {
    parts.push(slugify(values.os));
  }
  if (values.endereco?.trim()) {
    parts.push(slugify(values.endereco).slice(0, 40));
  }
  const dateValue = values.dataVistoria || values.data;
  if (dateValue) {
    parts.push(formatDateBR(dateValue).replace(/\//g, "-"));
  }
  return `${parts.filter(Boolean).join("-")}.pdf`;
}
