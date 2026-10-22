import { supabase } from "@/integrations/supabase/client";

/**
 * Fotos das vistorias no armazenamento do projeto. O relatório guarda apenas o
 * caminho do arquivo; a imagem nunca vai embutida nos dados do relatório.
 */
export const PHOTO_BUCKET = "qualyflow-fotos";
const PHOTO_PREFIX = "qualyflow/fotos";

export interface UploadedPhoto {
  path: string;
  url: string;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export function photoPublicUrl(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  if (/^https?:|^data:|^blob:/.test(path)) {
    return path;
  }
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

/** Envia a foto (JPEG já tratado) e devolve caminho + link público. */
export async function uploadPhoto(dataUrl: string): Promise<UploadedPhoto> {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${PHOTO_PREFIX}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(`Não foi possível enviar a foto: ${error.message}`);
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Não foi possível obter o link da foto enviada.");
  }

  return { path, url: data.publicUrl };
}
