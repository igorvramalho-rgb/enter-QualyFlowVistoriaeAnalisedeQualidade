import * as pdfjs from "pdfjs-dist";

/**
 * OCR **local no navegador** (tesseract.js + WASM). Nenhum documento sai da
 * máquina: apenas os arquivos do modelo de idioma são baixados de CDN pública
 * na primeira execução e ficam no cache do navegador.
 *
 * Usado somente nas páginas sem camada de texto aproveitável.
 */

export interface OcrPageResult {
  page: number;
  text: string;
  confidence: number;
  /** Milissegundos gastos na página. */
  durationMs: number;
}

export interface OcrOptions {
  onProgress?: (stage: string, page: number, total: number) => void;
  shouldCancel?: () => boolean;
  /** Escala de renderização da página antes do OCR (2 = ~150 dpi). */
  scale?: number;
  maxPages?: number;
}

const OCR_TEXT_MIN = 40;

/** Quantidade de caracteres úteis da página (para decidir se precisa de OCR). */
export function usableTextLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function pageNeedsOcr(text: string): boolean {
  return usableTextLength(text) < OCR_TEXT_MIN;
}

interface TesseractWorker {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
}

/**
 * Executa OCR nas páginas indicadas e devolve o texto reconhecido por página.
 * O processamento roda página a página, permitindo progresso e cancelamento.
 */
export async function ocrPdfPages(
  file: File,
  paginaTextos: string[],
  options: OcrOptions = {},
): Promise<OcrPageResult[]> {
  const { onProgress, shouldCancel, scale = 2, maxPages = 60 } = options;

  const precisa = paginaTextos
    .map((text, index) => ({ page: index + 1, text }))
    .filter((item) => pageNeedsOcr(item.text))
    .slice(0, maxPages);

  if (precisa.length === 0) {
    return [];
  }

  const { createWorker } = await import("tesseract.js");
  const worker = (await createWorker("por")) as unknown as TesseractWorker;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdfDocument = await loadingTask.promise;
  const resultados: OcrPageResult[] = [];

  try {
    for (let index = 0; index < precisa.length; index += 1) {
      if (shouldCancel?.()) {
        break;
      }

      const { page } = precisa[index];
      onProgress?.("ocr", index + 1, precisa.length);
      const startedAt = Date.now();

      const pdfPage = await pdfDocument.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) {
        continue;
      }

      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      pdfPage.cleanup();

      resultados.push({
        page,
        text: data.text ?? "",
        confidence: Math.round(data.confidence ?? 0),
        durationMs: Date.now() - startedAt,
      });
    }
  } finally {
    await worker.terminate().catch(() => undefined);
    await loadingTask.destroy().catch(() => undefined);
  }

  return resultados;
}
