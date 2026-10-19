import type { InstitutionalHeader, LogoSettings } from "@/lib/report-settings";
import { DEFAULT_INSTITUTIONAL_HEADER, DEFAULT_LOGOS } from "@/lib/report-settings";
import type { ReportTemplateId } from "@/lib/report-templates";
import { getTemplate } from "@/lib/report-templates";

export interface PhotoEntry {
  dataUrl: string;
  include: boolean;
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
