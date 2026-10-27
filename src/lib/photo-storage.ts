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

/**
 * O bucket é privado: o acesso é feito por **links assinados com validade**.
 * 12 horas cobrem um turno de trabalho; ao reabrir o relatório os links são
 * renovados automaticamente.
 */
const SIGNED_TTL_SECONDS = 60 * 60 * 12;

export function isExternalSource(path: string | undefined): boolean {
  return Boolean(path && /^https?:|^data:|^blob:/.test(path));
}

/** Assina um conjunto de caminhos em uma única chamada. */
export async function signPhotoUrls(paths: (string | undefined)[]): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(paths.filter((path): path is string => Boolean(path) && !isExternalSource(path))),
  );

  if (unique.length === 0) {
    return {};
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, SIGNED_TTL_SECONDS);

  if (error) {
    throw new Error(`Não foi possível liberar as fotos: ${error.message}`);
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((item, index) => {
    const path = item?.path ?? unique[index];
    if (path && item?.signedUrl) {
      map[path] = item.signedUrl;
    }
  });

  return map;
}

export async function signPhotoUrl(path: string | undefined): Promise<string | null> {
  if (isExternalSource(path)) {
    return path ?? null;
  }
  const signed = await signPhotoUrls([path]);
  return path ? signed[path] ?? null : null;
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

  const url = await signPhotoUrl(path);
  if (!url) {
    throw new Error("Não foi possível liberar a foto enviada.");
  }

  return { path, url };
}
