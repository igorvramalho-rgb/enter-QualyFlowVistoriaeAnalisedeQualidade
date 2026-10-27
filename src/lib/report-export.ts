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

    let pageCount = 0;

    for (let index = 0; index < sheets.length; index += 1) {
      const canvas = await html2canvas(sheets[index], {
        // ≈290 dpi na folha A4: mantém a nitidez das fotos e do texto no PDF
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      // Uma folha pode passar de A4 quando a observação é longa. Uma sobra de
      // até 7 mm é absorvida em uma única página (compressão imperceptível);
      // acima disso o conteúdo é fatiado em páginas inteiras, sem cortar texto.
      const heightInMm = (canvas.height / canvas.width) * 210;
      const sliceHeight = Math.floor((297 / 210) * canvas.width);
      const slices = heightInMm <= 304 ? 1 : Math.ceil(canvas.height / sliceHeight);

      for (let slice = 0; slice < slices; slice += 1) {
        const offsetY = slice * sliceHeight;
        const height = Math.min(sliceHeight, canvas.height - offsetY);
        if (height <= 0) {
          continue;
        }

        let source = canvas;
        if (slices > 1) {
          const part = document.createElement("canvas");
          part.width = canvas.width;
          part.height = height;
          const context = part.getContext("2d");
          if (!context) {
            continue;
          }
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, height);
          context.drawImage(canvas, 0, offsetY, canvas.width, height, 0, 0, canvas.width, height);
          source = part;
        }

        if (pageCount > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(
          source.toDataURL("image/jpeg", 0.96),
          "JPEG",
          0,
          0,
          210,
          slices === 1 ? 297 : (height / canvas.width) * 210,
          undefined,
          "FAST",
        );
        pageCount += 1;
      }
    }

    return { pdf, pages: pageCount };
  } finally {
    host.classList.remove("exporting");
    portal.classList.remove("exporting");
  }
}

export type PdfSaveResult = "saved" | "cancelled" | "unconfirmed";

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

/**
 * O seletor de arquivos do navegador **não funciona dentro de iframe de outra
 * origem** (caso da pré-visualização): o Chrome lança SecurityError. Também não
 * existe em contexto inseguro. Nesses casos caímos no download tradicional.
 */
export function isFilePickerAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker || !window.isSecureContext) {
    return false;
  }
  try {
    // Em iframe (inclusive de mesma origem, como a pré-visualização) o seletor
    // é bloqueado; o download por link continua permitido.
    return window.self === window.top;
  } catch {
    return false;
  }
}

/**
 * Grava o PDF e devolve o que o navegador conseguiu confirmar:
 * - "saved": arquivo escrito no disco (File System Access API);
 * - "cancelled": o usuário cancelou;
 * - "unconfirmed": download disparado sem confirmação possível.
 */
export async function saveReportPdfFile(fileName: string): Promise<PdfSaveResult> {
  const { pdf } = await buildReportDocument();
  const blob = pdf.output("blob") as Blob;
  const name = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  const baixarSemConfirmacao = (): PdfSaveResult => {
    pdf.save(name);
    return "unconfirmed";
  };

  if (!isFilePickerAvailable()) {
    return baixarSemConfirmacao();
  }

  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) {
    return baixarSemConfirmacao();
  }

  let handle: Awaited<ReturnType<NonNullable<FilePickerWindow["showSaveFilePicker"]>>>;
  try {
    handle = await picker({
      suggestedName: name,
      types: [{ description: "Documento PDF", accept: { "application/pdf": [".pdf"] } }],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    // Bloqueio por origem/iframe ou permissão: entrega o arquivo pelo download
    // tradicional em vez de falhar. Sem confirmação, a retenção não roda.
    if (
      error instanceof DOMException &&
      (error.name === "SecurityError" || error.name === "NotAllowedError")
    ) {
      return baixarSemConfirmacao();
    }
    throw error;
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  } catch {
    // Falha ao gravar no destino escolhido: garante uma cópia por download.
    return baixarSemConfirmacao();
  }
}

export async function downloadReportPdf(fileName: string): Promise<void> {
  const { pdf } = await buildReportDocument();
  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

/**
 * Nome do arquivo gerado, sempre na ordem **FAC → OS → endereço**.
 * Nenhum dos três é omitido: se o campo estiver vazio, entra "nao-informado".
 * O modelo e a data vão no fim, para identificação e ordenação da pasta.
 * Ex.: fac-70172-os-2626203004-rua-teste-100-pos-60-via-31-07-2026.pdf
 */
export function buildReportFileName(templateId: string, values: ReportValues): string {
  const template = getTemplate(templateId);
  const semInformacao = "nao-informado";

  const fac = values.fac?.trim() ? slugify(values.fac) : semInformacao;
  const os = values.os?.trim() ? slugify(values.os) : semInformacao;
  const endereco = values.endereco?.trim()
    ? slugify(values.endereco).slice(0, 45).replace(/-+$/, "")
    : semInformacao;

  const parts = [
    `fac-${fac}`,
    `os-${os}`,
    endereco,
    slugify(template.shortTitle),
  ];

  const dateValue = values.dataVistoria || values.data;
  if (dateValue) {
    parts.push(formatDateBR(dateValue).replace(/\//g, "-"));
  }

  return `${parts.filter(Boolean).join("-")}.pdf`;
}
