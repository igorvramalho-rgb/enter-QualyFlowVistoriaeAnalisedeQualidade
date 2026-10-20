import { EmptyPhoto } from "@/components/report/empty-photo";
import { formatDateBR } from "@/lib/fields";
import type { PhotoMap, QualyflowSettings, ReportValues } from "@/lib/report-document";
import { GeotagStamp } from "@/components/report/geotag-stamp";
import { includedSlots, resolveCaption } from "@/lib/report-document";
import type { ReportTemplate } from "@/lib/report-templates";

interface ReportSheetPos60Props {
  template: ReportTemplate;
  values: ReportValues;
  photos: PhotoMap;
  settings: QualyflowSettings;
  objeto?: string;
  observacoes?: string;
}

const COLUMN_WIDTHS = ["17%", "12%", "22%", "13%", "24%", "12%"];

/**
 * Réplica da folha "RELATÓRIO FOTOGRÁFICO - DEVOLUTIVA PÓS 60": logos Sabesp e
 * Consórcio Nova Norte, objeto, tabela de 6 colunas e grade 2x3 com legendas.
 */
export function ReportSheetPos60({
  template,
  values,
  photos,
  settings,
  objeto,
  observacoes,
}: ReportSheetPos60Props) {
  const tableFields = template.fields.filter((field) => !field.outsideTable);
  const contratada = template.fields.find((field) => field.id === "contratada");
  const slots = includedSlots(template.id, photos);
  const objetoText = objeto?.trim() ? objeto : template.objeto;

  return (
    <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
      <div className="sheet-frame flex flex-1 flex-col p-[6mm]">
        <div className="flex items-start justify-between">
          <img
            src={settings.logos.sabesp}
            alt="Sabesp"
            className="h-[16mm] w-auto object-contain"
          />
          {template.consortiumLogo && (
            <img
              src={settings.logos.consortium}
              alt="Consórcio Nova Norte"
              className="h-[13mm] w-auto object-contain"
            />
          )}
        </div>

        <h1 className="mt-[7mm] text-center text-[13px] font-bold tracking-[0.02em]">
          {template.documentTitle}
        </h1>

        <p className="mt-[5mm] text-justify text-[10.5px] leading-snug">
          <span className="font-bold">Objeto: </span>
          {objetoText}
        </p>

        {contratada && (
          <p className="mt-[4mm] text-[10.5px]">
            <span className="font-bold">{contratada.label}: </span>
            {values.contratada}
          </p>
        )}

        <table className="sheet-table mt-[4mm] table-fixed">
          <colgroup>
            {tableFields.map((field, index) => (
              <col key={field.id} style={{ width: COLUMN_WIDTHS[index] ?? "auto" }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              {tableFields.map((field) => (
                <td key={field.id} className="sheet-label px-[2mm] py-[1.2mm] text-[9.5px] align-top">
                  {field.label}
                </td>
              ))}
            </tr>
            <tr>
              {tableFields.map((field) => (
                <td key={field.id} className="px-[2mm] py-[1.6mm] text-[10px] align-top leading-tight">
                  {field.type === "date" ? formatDateBR(values[field.id]) : values[field.id]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {observacoes?.trim() ? (
          <div className="mt-[3mm] border border-sheet-line px-[2mm] py-[1.5mm]">
            <p className="text-[10px] font-bold">Observações</p>
            <p className="mt-[0.8mm] whitespace-pre-wrap text-[10px] leading-snug">
              {observacoes}
            </p>
          </div>
        ) : null}

        <div className="mt-[5mm] grid min-h-[138mm] flex-1 grid-cols-2 grid-rows-3 gap-x-[5mm] gap-y-[4mm]">
          {slots.map((slot) => {
            const photo = photos[slot.id];
            const slotCaption = resolveCaption(photo?.caption, slot.caption);
            return (
              <figure key={slot.id} className="flex min-h-0 flex-col">
                <div className="sheet-frame relative min-h-0 flex-1 overflow-hidden">
                  {photo?.dataUrl ? (
                    <div
                      role="img"
                      aria-label={slotCaption}
                      className="sheet-photo-frame sheet-photo-frame--cover absolute inset-0"
                      style={{ backgroundImage: `url(${photo.dataUrl})` }}
                    >
                      <img
                        src={photo.dataUrl}
                        alt={slotCaption}
                        className="sheet-photo-img sheet-photo-img--cover"
                      />
                      {photo.showGeotag !== false && <GeotagStamp geotag={photo.geotag} />}
                    </div>
                  ) : (
                    <div className="absolute inset-0">
                      <EmptyPhoto />
                    </div>
                  )}
                </div>
                <figcaption className="mt-[1.4mm] text-[10px] uppercase leading-tight">
                  {slotCaption}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </article>
  );
}
