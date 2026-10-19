import type { jsPDF as JsPdfDocument } from "jspdf";
import { formatDateBR, slugify } from "@/lib/fields";
import type { ReportValues } from "@/lib/report-document";
import { getTemplate } from "@/lib/report-templates";

export function printReport(): void {
  window.print();
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Gera o PDF montando **uma página A4 por folha**. Cada `.print-sheet` é
 * rasterizado individualmente com html2canvas e inserido com jsPDF, evitando
 * o corte automático (que duplicava páginas e partia as fotos).
 *
 * A captura usa a porta de impressão (cópia em tamanho real das folhas): a
 * pré-visualização na tela é escalada e por isso não serve como origem.
 */
export async function buildReportDocument(): Promise<{ pdf: JsPdfDocument; pages: number }> {
  const portal = document.getElementById("print-portal");
  const host = document.getElementById("print-portal-host");
  if (!portal || !host) {
    throw new Error("Gere o relatório antes de baixar o PDF.");
  }

  const sheets = Array.from(portal.querySelectorAll<HTMLElement>(".print-sheet"));
  if (sheets.length === 0) {
    throw new Error("Gere o relatório antes de baixar o PDF.");
  }

  host.classList.add("exporting");
  portal.classList.add("exporting");

  try {
    await waitForImages(portal);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    for (let index = 0; index < sheets.length; index += 1) {
      const canvas = await html2canvas(sheets[index], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const image = canvas.toDataURL("image/jpeg", 0.96);
      if (index > 0) {
        pdf.addPage("a4", "portrait");
      }
      pdf.addImage(image, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    return { pdf, pages: sheets.length };
  } finally {
    host.classList.remove("exporting");
    portal.classList.remove("exporting");
  }
}

export async function downloadReportPdf(fileName: string): Promise<void> {
  const { pdf } = await buildReportDocument();
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
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
