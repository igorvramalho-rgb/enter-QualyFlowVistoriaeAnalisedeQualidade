/**
 * Leitura de GPS das fotos (EXIF) e formatação da marca de data/local usada
 * nos relatórios: `21/07/2026 15:07:42`, `23,4932S 46,5915W`, endereço/bairro/cidade.
 */

export interface GeotagData {
  dataHora: string;
  coordenadas: string;
  endereco: string;
  bairro: string;
  cidade: string;
}

export function emptyGeotag(): GeotagData {
  return { dataHora: "", coordenadas: "", endereco: "", bairro: "", cidade: "" };
}

export function hasGeotagContent(geotag: GeotagData | undefined): boolean {
  if (!geotag) {
    return false;
  }
  return Object.values(geotag).some((value) => value.trim().length > 0);
}

/** "21/07/2026 15:07:42" a partir de agora (editável depois). */
export function nowStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** `23,4932S 46,5915W` — vírgula decimal e hemisfério, como no padrão das fotos. */
export function formatCoordinates(latitude: number, longitude: number): string {
  const format = (value: number, positive: string, negative: string) => {
    const hemisphere = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(4).replace(".", ",")}${hemisphere}`;
  };
  return `${format(latitude, "N", "S")} ${format(longitude, "E", "W")}`;
}

interface ExifGps {
  latitude: number;
  longitude: number;
}

/** Lê o GPS do EXIF de um JPEG (melhor esforço; retorna null quando não existe). */
export async function readPhotoGps(file: File): Promise<ExifGps | null> {
  if (!/jpe?g$/i.test(file.name) && file.type !== "image/jpeg") {
    return null;
  }

  try {
    const buffer = new DataView(await file.arrayBuffer());
    if (buffer.getUint16(0) !== 0xffd8) {
      return null;
    }

    let offset = 2;
    while (offset + 4 < buffer.byteLength) {
      const marker = buffer.getUint16(offset);
      const length = buffer.getUint16(offset + 2);

      // APP1 (EXIF)
      if (marker === 0xffe1) {
        const exifStart = offset + 4;
        if (buffer.getUint32(exifStart) !== 0x45786966) {
          offset += 2 + length;
          continue;
        }
        return parseExifGps(buffer, exifStart + 6);
      }

      if ((marker & 0xff00) !== 0xff00) {
        break;
      }
      offset += 2 + length;
    }
  } catch {
    return null;
  }

  return null;
}

function parseExifGps(view: DataView, tiffStart: number): ExifGps | null {
  const little = view.getUint16(tiffStart) === 0x4949;
  const read16 = (offset: number) => view.getUint16(tiffStart + offset, little);
  const read32 = (offset: number) => view.getUint32(tiffStart + offset, little);

  if (read16(2) !== 0x002a) {
    return null;
  }

  const ifd0 = read32(4);
  const gpsPointer = findGpsPointer(view, tiffStart, ifd0, read16, read32, little);
  if (gpsPointer === null) {
    return null;
  }

  const gpsIfd = gpsPointer;
  const entries = read16(gpsIfd);
  let latitude: number | null = null;
  let longitude: number | null = null;
  let latitudeRef = "N";
  let longitudeRef = "E";

  for (let index = 0; index < entries; index += 1) {
    const entry = gpsIfd + 2 + index * 12;
    const tag = read16(entry);
    const count = read32(entry + 4);
    const valueOffset = read32(entry + 8);

    if (tag === 1 || tag === 3) {
      const degrees = readRational(view, tiffStart + valueOffset, little);
      const minutes = readRational(view, tiffStart + valueOffset + 8, little);
      const seconds = count >= 3 ? readRational(view, tiffStart + valueOffset + 16, little) : 0;
      const decimal = degrees + minutes / 60 + seconds / 3600;
      if (tag === 1) {
        latitude = decimal;
      } else {
        longitude = decimal;
      }
    }

    if (tag === 2 || tag === 4) {
      const ref = String.fromCharCode(view.getUint8(tiffStart + entry + 8));
      if (tag === 2) {
        latitudeRef = ref;
      } else {
        longitudeRef = ref;
      }
    }
  }

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude: latitudeRef.toUpperCase() === "S" ? -latitude : latitude,
    longitude: longitudeRef.toUpperCase() === "W" ? -longitude : longitude,
  };
}

function findGpsPointer(
  view: DataView,
  tiffStart: number,
  ifd0: number,
  read16: (offset: number) => number,
  read32: (offset: number) => number,
  little: boolean,
): number | null {
  const entries = read16(ifd0);

  for (let index = 0; index < entries; index += 1) {
    const entry = ifd0 + 2 + index * 12;
    if (read16(entry) === 0x8825) {
      return read32(entry + 8);
    }
  }

  // Sem ponteiro GPS no IFD0: nada a ler
  void view;
  void tiffStart;
  void little;
  return null;
}

function readRational(view: DataView, offset: number, little: boolean): number {
  const numerator = view.getUint32(offset, little);
  const denominator = view.getUint32(offset + 4, little);
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}
