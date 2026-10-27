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

/**
 * Modos de qualidade por foto. **Alta é o padrão de produção** e mantém o
 * comportamento atual; "Padrão" existe para reduzir ~50% do arquivo em fotos em
 * que a legibilidade de detalhe fino não é decisiva (medição em bancada).
 */
export type PhotoQualityMode = "alta" | "padrao";

export const PHOTO_QUALITY: Record<
  PhotoQualityMode,
  { maxSide: number; quality: number; label: string; hint: string }
> = {
  alta: {
    maxSide: 2200,
    quality: 0.9,
    label: "Alta",
    hint: "2200 px — padrão atual, melhor detalhe",
  },
  padrao: {
    maxSide: 1600,
    quality: 0.85,
    label: "Padrão",
    hint: "1600 px — cerca de 50% menor",
  },
};

export const DEFAULT_PHOTO_QUALITY: PhotoQualityMode = "alta";

export function isImageFile(file: File): boolean {  if (file.type.startsWith("image/")) {
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

export interface PhotoAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  exposure: number;
  temperature: number;
  shadows: number;
  highlights: number;
  /** Fator de ampliação de resolução (1 mantém as dimensões). */
  upscale: number;
}

export const NEUTRAL_ADJUSTMENTS: PhotoAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  exposure: 0,
  temperature: 0,
  shadows: 0,
  highlights: 0,
  upscale: 1,
};

export const PHOTO_PRESETS: Record<"leve" | "profissional" | "forte", PhotoAdjustments> = {
  leve: { ...NEUTRAL_ADJUSTMENTS, brightness: 4, contrast: 6, saturation: 6, sharpness: 18, exposure: 4, shadows: 14, highlights: -8 },
  profissional: { ...NEUTRAL_ADJUSTMENTS, brightness: 6, contrast: 14, saturation: 12, sharpness: 38, exposure: 8, temperature: 4, shadows: 24, highlights: -16, upscale: 1.5 },
  forte: { ...NEUTRAL_ADJUSTMENTS, brightness: 10, contrast: 24, saturation: 20, sharpness: 60, exposure: 14, temperature: 6, shadows: 38, highlights: -26, upscale: 2 },
};

export const PRESET_LABELS: Record<keyof typeof PHOTO_PRESETS, string> = {
  leve: "Leve",
  profissional: "Profissional",
  forte: "Forte",
};

const clamp = (value: number) => (value < 0 ? 0 : value > 255 ? 255 : value);

/**
 * Ajustes locais de imagem (sem IA e sem serviços externos): tom, cor, sombras,
 * realces, nitidez por máscara de contraste e ampliação de resolução.
 *
 * As evidências não são alteradas em conteúdo — apenas legibilidade. O arquivo
 * original permanece no armazenamento e pode ser restaurado.
 */
export async function applyPhotoAdjustments(
  dataUrl: string,
  ajustes: PhotoAdjustments,
  { maxSide = 6000, quality = 0.95 }: { maxSide?: number; quality?: number } = {},
): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImageElement(dataUrl);
  const fator = Math.max(1, ajustes.upscale);
  const maiorLado = Math.max(image.naturalWidth, image.naturalHeight);
  const escala = Math.min(fator, maiorLado > 0 ? maxSide / maiorLado : 1);
  const width = Math.max(1, Math.round(image.naturalWidth * Math.max(1, escala)));
  const height = Math.max(1, Math.round(image.naturalHeight * Math.max(1, escala)));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Não foi possível processar a imagem neste navegador.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const imagem = context.getImageData(0, 0, width, height);
  aplicarTomECor(imagem.data, ajustes);
  if (ajustes.sharpness > 0) {
    aplicarNitidez(imagem.data, width, height, ajustes.sharpness);
  }
  context.putImageData(imagem, 0, 0);

  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height };
}

/** Exposição, brilho, contraste, saturação, temperatura, sombras e realces. */
function aplicarTomECor(dados: Uint8ClampedArray, ajustes: PhotoAdjustments) {
  const ganhoExposicao = Math.pow(2, ajustes.exposure / 100);
  const brilho = ajustes.brightness * 1.2;
  const contraste = 1 + ajustes.contrast / 100;
  const saturacao = 1 + ajustes.saturation / 100;
  const temperatura = ajustes.temperature / 100;
  const sombras = ajustes.shadows * 0.35;
  const realces = ajustes.highlights * 0.35;

  for (let index = 0; index < dados.length; index += 4) {
    let r = dados[index] * ganhoExposicao + brilho;
    let g = dados[index + 1] * ganhoExposicao + brilho;
    let b = dados[index + 2] * ganhoExposicao + brilho;

    // sombras e realces guiados pela luminância
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 128 && sombras !== 0) {
      const fator = (1 - lum / 128) * sombras;
      r += fator;
      g += fator;
      b += fator;
    } else if (lum >= 128 && realces !== 0) {
      const fator = ((lum - 128) / 127) * realces;
      r += fator;
      g += fator;
      b += fator;
    }

    // temperatura de cor
    if (temperatura !== 0) {
      r += temperatura * 18;
      b -= temperatura * 18;
    }

    // contraste e saturação
    r = (r - 128) * contraste + 128;
    g = (g - 128) * contraste + 128;
    b = (b - 128) * contraste + 128;

    const cinza = 0.299 * r + 0.587 * g + 0.114 * b;
    dados[index] = clamp(cinza + (r - cinza) * saturacao);
    dados[index + 1] = clamp(cinza + (g - cinza) * saturacao);
    dados[index + 2] = clamp(cinza + (b - cinza) * saturacao);
  }
}

/** Nitidez por máscara de contraste (3×3), proporcional à intensidade. */
function aplicarNitidez(dados: Uint8ClampedArray, width: number, height: number, intensidade: number) {
  const original = new Uint8ClampedArray(dados);
  const peso = (intensidade / 100) * 1.1;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const base = (y * width + x) * 4;
      for (let canal = 0; canal < 3; canal += 1) {
        const i = base + canal;
        const media =
          (original[i - width * 4 - 4] +
            original[i - width * 4] +
            original[i - width * 4 + 4] +
            original[i - 4] +
            original[i] +
            original[i + 4] +
            original[i + width * 4 - 4] +
            original[i + width * 4] +
            original[i + width * 4 + 4]) /
          9;
        dados[i] = clamp(original[i] + peso * (original[i] - media));
      }
    }
  }
}

/**
 * Realce no padrão profissional: amplia com reamostragem de alta qualidade e
 * aplica a predefinição "Profissional" dos Filtros PRO.
 */
export async function enhancePhotoDataUrl(
  dataUrl: string,
  { scale = 1.5, maxSide = 3200, quality = 0.95 } = {},
): Promise<string> {
  const resultado = await applyPhotoAdjustments(
    dataUrl,
    { ...PHOTO_PRESETS.profissional, upscale: scale },
    { maxSide, quality },
  );
  return resultado.dataUrl;
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
