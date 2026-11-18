import { EmptyPhoto } from "@/components/report/empty-photo";
import { GeotagStamp } from "@/components/report/geotag-stamp";
import { resolveCaption, type PhotoMap, type ReportValues } from "@/lib/report-document";
import type { ReportTemplate } from "@/lib/report-templates";

interface Props {
  template: ReportTemplate;
  values: ReportValues;
  photos: PhotoMap;
}

const GRUPOS = [
  { titulo: "SERVIÇO RECLAMADO", slots: ["reclamado1", "reclamado2"] },
  { titulo: "SERVIÇO EXECUTADO", slots: ["executado1", "executado2"] },
];

/**
 * Modelo "Fiscalizar Pendências Pós 60" — ficha de campo em uma página A4:
 * dados do protocolo e 4 fotos (2 do serviço reclamado, 2 do executado).
 */
export function ReportSheetPendencias({ template, values, photos }: Props) {
  const valor = (id: string) => (values[id] ?? "").trim();

  const foto = (slotId: string) => {
    const slot = template.photoSlots.find((item) => item.id === slotId);
    const photo = photos[slotId];
    const legenda = resolveCaption(photo?.caption, slot?.caption ?? "");
    return { photo, legenda };
  };

  return (
    <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
      {/* Cabeçalho */}
      <div className="sheet-table">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="border border-[hsl(var(--sheet-line))] px-[3mm] py-[2.5mm]">
                <p className="text-center text-[13px] font-bold uppercase leading-tight">
                  {template.documentTitle}
                </p>
                <p className="text-center text-[8.5px] uppercase leading-tight">
                  RELATÓRIO DE CAMPO E FICHA DE VISTORIA COM FOTOS
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dados */}
      <div className="mt-[3mm]">
        <table className="w-full border-collapse text-[9px]">
          <tbody>
            <tr>
              <td className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm]">
                <span className="font-bold uppercase">PROTOCOLO / </span>
                <span className="uppercase">{valor("protocolo")}</span>
              </td>
              <td className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm]">
                <span className="font-bold uppercase">O.S. Nº: </span>
                <span className="uppercase">{valor("os")}</span>
              </td>
            </tr>
            <tr>
              <td className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm] align-top">
                <span className="font-bold uppercase">ENDEREÇO / LOGRADOURO:</span>
                <br />
                <span className="uppercase">{valor("endereco")}</span>
              </td>
              <td className="w-[52%] border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm] align-top">
                <span className="font-bold uppercase">BAIRRO / REFERÊNCIA:</span>
                <br />
                <span className="uppercase">{valor("bairro")}</span>
              </td>
            </tr>
            <tr>
              <td className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm]">
                <span className="font-bold uppercase">DATA FISCALIZAÇÃO:</span>{" "}
                <span>{valor("dataFiscalizacao")}</span>
              </td>
              <td className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm]">
                <span className="font-bold uppercase">STATUS DA FISCALIZAÇÃO:</span>{" "}
                <span>{valor("statusFiscalizacao")}</span>
              </td>
            </tr>
            <tr>
              <td
                colSpan={2}
                className="border border-[hsl(var(--sheet-line))] px-[2.5mm] py-[1.6mm]"
              >
                <span className="font-bold uppercase">FOTOS DE REFERÊNCIA DE CAMPO</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Fotos: reclamado × executado */}
      <div className="mt-[3mm] grid flex-1 grid-cols-2 gap-x-[6mm]">
        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo} className="flex flex-col">
            <div className="grid grid-cols-2 gap-x-[3mm]">
              {grupo.slots.map((slotId) => {
                const { photo, legenda } = foto(slotId);
                return (
                  <div
                    key={slotId}
                    className="sheet-frame relative aspect-[4/3] overflow-hidden"
                  >
                    {photo?.dataUrl ? (
                      <div
                        role="img"
                        aria-label={legenda}
                        className="sheet-photo-frame sheet-photo-frame--cover absolute inset-0"
                        style={{ backgroundImage: `url(${photo.dataUrl})` }}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={legenda}
                          crossOrigin="anonymous"
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
                );
              })}
            </div>

            <p className="mt-[1.5mm] text-center text-[10px] font-bold uppercase tracking-wide">
              {grupo.titulo}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-[6mm] text-center text-[7.5px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        Fiscalização de campo · Célula da Qualidade
      </p>
    </article>
  );
}
