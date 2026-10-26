/**
 * Normalização de imagens das vistorias: reduz o lado maior e recomprime em JPEG
 * para que os relatórios caibam no armazenamento local do navegador.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxSide = 2200,
  quality = 0.9,
): Promise<string> {
  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível processar a imagem neste navegador.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }

  return canvas.toDataURL("image/jpeg", quality);
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }
  return /\.(png|jpe?g|webp|bmp|gif|heic|heif)$/i.test(file.name);
}

export function estimateDataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round((base64.length * 3) / 4);
}

function fitWithin(width: number, height: number, maxSide: number) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    return { width, height };
  }
  const ratio = maxSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" aplica a orientação EXIF igual à tag <img> do navegador,
      // evitando fotos giradas no relatório.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* alguns formatos não são suportados por createImageBitmap */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Formato de imagem não suportado."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Realce opcional da foto: amplia com reamostragem de alta qualidade e aplica
 * um ajuste leve de contraste/saturação — melhora a leitura de réguas, trenas,
 * placas e numeração de fachada sem alterar o enquadramento.
 */
export async function enhancePhotoDataUrl(
  dataUrl: string,
  { scale = 1.6, maxSide = 3200, quality = 0.95 } = {},
): Promise<string> {
  const image = await loadImageElement(dataUrl);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const factor = longest > 0 ? Math.min(scale, maxSide / longest) : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * Math.max(1, factor)));
  const height = Math.max(1, Math.round(image.naturalHeight * Math.max(1, factor)));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível processar a imagem neste navegador.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "contrast(1.08) saturate(1.12) brightness(1.03)";
  context.drawImage(image, 0, 0, width, height);
  context.filter = "none";

  return canvas.toDataURL("image/jpeg", quality);
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    image.src = source;
  });
}
