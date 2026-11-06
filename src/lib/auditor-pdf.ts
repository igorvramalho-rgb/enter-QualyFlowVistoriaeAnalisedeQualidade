import { readPdfPageTexts } from "@/lib/pdf-extract";
import { ocrPdfPages, pageNeedsOcr } from "@/lib/pdf-ocr";
import {
  parseAuditorPages,
  type AuditorCaption,
  type AuditorDivergence,
  type AuditorFieldKey,
  type AuditorFieldValue,
  type AuditorItem,
} from "@/lib/auditor-parse";

export {
  AUDITOR_FIELDS,
  type AuditorCaption,
  type AuditorDivergence,
  type AuditorFieldKey,
  type AuditorFieldValue,
  type AuditorItem,
} from "@/lib/auditor-parse";

export interface AuditorExtraction {
  fingerprint: string;
  fileName: string;
  pages: number;
  textAvailable: boolean;
  usedOcr: boolean;
  ocrPages: number[];
  fields: Record<AuditorFieldKey, AuditorFieldValue>;
  items: AuditorItem[];
  captions: AuditorCaption[];
  observations: string;
  divergences: AuditorDivergence[];
}

export interface ExtractOptions {
  ocr?: boolean;
  onProgress?: (page: number, total: number) => void;
  onOcrProgress?: (stage: string, page: number, total: number) => void;
}

async function fileFingerprint(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Leitura assistida do FV: texto primeiro, OCR apenas quando a página não tem
 * camada de texto. A decisão técnica permanece humana.
 */
export async function extractAuditorDocument(
  file: File,
  options: ExtractOptions = {},
): Promise<AuditorExtraction> {
  const fingerprint = await fileFingerprint(file);
  const { pages, total } = await readPdfPageTexts(file, { onProgress: options.onProgress });

  let working = pages;
  let usedOcr = false;
  const ocrPages: number[] = [];

  if (options.ocr && pages.some((page) => pageNeedsOcr(page.text))) {
    const resultados = await ocrPdfPages(
      file,
      pages.map((page) => page.text),
      { onProgress: options.onOcrProgress },
    );

    if (resultados.length > 0) {
      usedOcr = true;
      working = pages.map((page) => {
        const found = resultados.find((item) => item.page === page.page);
        if (!found) {
          return page;
        }
        ocrPages.push(page.page);
        return { page: page.page, text: `${page.text}\n${found.text}`.trim() };
      });
    }
  }

  const textAvailable = working.some((page) => page.text.replace(/\s/g, "").length >= 40);

  const parsed = parseAuditorPages(working, {
    fileName: file.name,
    textAvailable,
    usedOcr,
  });

  return {
    fingerprint,
    fileName: file.name,
    pages: total,
    textAvailable,
    usedOcr,
    ocrPages,
    ...parsed,
  };
}
