import { ReportSheetPos60 } from "@/components/report/report-sheet-pos60";
import { ReportSheetSgz } from "@/components/report/report-sheet-sgz";
import { includedSlots, type PhotoMap, type QualyflowSettings, type ReportValues } from "@/lib/report-document";
import { getTemplate } from "@/lib/report-templates";

interface ReportDocumentViewProps {
  templateId: string;
  values: ReportValues;
  photos: PhotoMap;
  objeto?: string;
  observacoes?: string;
  settings: QualyflowSettings;
}

/**
 * Conjunto de folhas A4 do relatório atual, usado na pré-visualização e na
 * porta de impressão (mesmo componente, sem duplicar layout).
 */
export function ReportDocumentView({
  templateId,
  values,
  photos,
  objeto,
  observacoes,
  settings,
}: ReportDocumentViewProps) {
  const template = getTemplate(templateId);

  if (template.layout === "pos60") {
    return (
      <ReportSheetPos60
        template={template}
        values={values}
        photos={photos}
        settings={settings}
        objeto={objeto}
        observacoes={observacoes}
      />
    );
  }

  const slots = includedSlots(template.id, photos);

  return (
    <>
      {slots.map((slot, index) => {
        const slotIndex = template.photoSlots.findIndex((candidate) => candidate.id === slot.id);
        return (
          <ReportSheetSgz
            key={slot.id}
            values={values}
            slot={slot}
            photo={photos[slot.id]}
            photoNumber={slotIndex + 1}
            pageNumber={index + 1}
            totalPages={slots.length}
            settings={settings}
            observacoes={observacoes}
          />
        );
      })}
    </>
  );
}
