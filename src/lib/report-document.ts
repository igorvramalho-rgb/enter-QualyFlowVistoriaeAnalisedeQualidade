import type { GeotagData } from "@/lib/geotag";
import type { InstitutionalHeader, LogoSettings } from "@/lib/report-settings";
import { DEFAULT_INSTITUTIONAL_HEADER, DEFAULT_LOGOS } from "@/lib/report-settings";
import type { ReportTemplateId } from "@/lib/report-templates";
import { getTemplate } from "@/lib/report-templates";

export interface PhotoEntry {
  dataUrl: string;
  include: boolean;
  /** Legenda editada pelo usuário; vazio usa a legenda padrão do modelo. */
  caption?: string;
  /** Marca de data/local (GPS) impressa sobre a foto. */
  geotag?: GeotagData;
  /** Liga/desliga a marca só nesta foto. */
  showGeotag?: boolean;
}

/** Configuração da marca de data/local aplicada às fotos novas. */
export interface GeotagSettings {
  enabled: boolean;
  defaults: GeotagData;
}

/** Legenda que vai para a folha: a editada ou a padrão do modelo. */
export function resolveCaption(caption: string | undefined, fallback: string): string {
  const custom = caption?.trim();
  return custom && custom.length > 0 ? custom : fallback;
}

export type PhotoMap = Record<string, PhotoEntry>;

export type ReportValues = Record<string, string>;

export interface ReportDraft {
  id: string;
  name: string;
  templateId: ReportTemplateId;
  values: ReportValues;
  photos: PhotoMap;
  objeto: string;
  /** Observação impressa logo abaixo dos dados de cabeçalho (só quando preenchida). */
  observacoes?: string;
  /** Marca de data/local das fotos. */
  geotag?: GeotagSettings;
  createdAt: string;
  updatedAt: string;
}

export interface QualyflowSettings {
  header: InstitutionalHeader;
  logos: LogoSettings;
}

export const DEFAULT_SETTINGS: QualyflowSettings = {
  header: DEFAULT_INSTITUTIONAL_HEADER,
  logos: DEFAULT_LOGOS,
};

/**
 * Une as configurações salvas com os padrões, garantindo que logos e cabeçalho
 * sempre existam (um valor ausente não pode quebrar a folha).
 */
export function normalizeSettings(value: Partial<QualyflowSettings> | undefined): QualyflowSettings {
  return {
    header: { ...DEFAULT_INSTITUTIONAL_HEADER, ...(value?.header ?? {}) },
    logos: { ...DEFAULT_LOGOS, ...(value?.logos ?? {}) },
  };
}

/** Compatibilidade com rascunhos salvos quando o campo se chamava "FV". */
export function migrateDraftValues(values: ReportValues | undefined): ReportValues {
  if (!values || !values.fv || values.fac) {
    return values ?? {};
  }
  const { fv, ...rest } = values;
  return { ...rest, fac: fv };
}

export function emptyPhotoMap(): PhotoMap {
  return {};
}

/** Slots que entram na impressão: têm foto ou o usuário ainda não os removeu. */
export function includedSlots(templateId: string, photos: PhotoMap) {
  const template = getTemplate(templateId);
  return template.photoSlots.filter((slot) => {
    const entry = photos[slot.id];
    if (!entry) {
      return slot.includeByDefault;
    }
    return entry.include;
  });
}

export function countFilledPhotos(templateId: string, photos: PhotoMap): number {
  return includedSlots(templateId, photos).filter((slot) => Boolean(photos[slot.id]?.dataUrl)).length;
}

export function draftLabel(templateId: string, values: ReportValues): string {
  const template = getTemplate(templateId);
  const endereco = values.endereco?.trim();
  const os = values.os?.trim();
  const parts = [template.shortTitle];
  if (os) {
    parts.push(`OS ${os}`);
  }
  if (endereco) {
    parts.push(endereco);
  }
  return parts.join(" • ");
}
