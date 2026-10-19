import { Check } from "lucide-react";
import { EmptyPhoto } from "@/components/report/empty-photo";
import { formatDateBR, upper } from "@/lib/fields";
import type { PhotoEntry } from "@/lib/report-document";
import type { QualyflowSettings } from "@/lib/report-document";
import { SGZ_SITUACOES, type ReportPhotoSlot } from "@/lib/report-templates";
import type { ReportValues } from "@/lib/report-document";
import { cn } from "@/lib/utils";

interface ReportSheetSgzProps {
  values: ReportValues;
  photo?: PhotoEntry;
  slot: ReportPhotoSlot;
  photoNumber: number;
  pageNumber: number;
  totalPages: number;
  settings: QualyflowSettings;
}

/**
 * Réplica da folha "DEMANDA SGZ - 156": moldura, cabeçalho institucional,
 * tabela DADOS DA VISTORIA e uma foto por página.
 */
export function ReportSheetSgz({
  values,
  photo,
  slot,
  photoNumber,
  pageNumber,
  totalPages,
  settings,
}: ReportSheetSgzProps) {
  const endereco = upper(values.endereco);
  const caption = endereco
    ? `FOTO Nº ${photoNumber}: ${endereco} - ${slot.caption}`
    : `FOTO Nº ${photoNumber}: ${slot.caption}`;

  return (
    <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
      <div className="sheet-frame flex flex-1 flex-col">
        <table className="sheet-table">
          <tbody>
            <tr>
              <td className="w-[32%] px-[4mm] py-[3mm] text-center align-middle">
                <img
                  src={settings.logos.sabesp}
                  alt="Sabesp"
                  className="mx-auto h-[22mm] w-auto object-contain"
                />
              </td>
              <td className="p-0 align-top">
                <div className="border-b border-sheet-line px-[3mm] py-[2mm] text-center text-[11px] font-bold leading-tight">
                  {settings.header.title}
                </div>
                <div className="border-b border-sheet-line px-[3mm] py-[2mm] text-center text-[10.5px] leading-tight">
                  {settings.header.division}
                </div>
                <div className="px-[3mm] py-[2mm] text-center text-[10px] leading-snug">
                  <div>{settings.header.addressLine}</div>
                  <div>{settings.header.phoneLine1}</div>
                  <div>{settings.header.phoneLine2}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="sheet-table">
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="sheet-label px-[2mm] py-[1.6mm] text-center text-[10.5px] tracking-[0.06em]"
              >
                DADOS DA VISTORIA
              </td>
            </tr>
            <tr>
              <td className="sheet-label w-[22%] px-[2mm] py-[2mm] text-[10.5px]">Endereço</td>
              <td colSpan={3} className="px-[2mm] py-[2mm] text-[11px]">
                {values.endereco}
              </td>
            </tr>
            <tr>
              <td className="sheet-label px-[2mm] py-[2mm] text-[10.5px]">Data da Vistoria</td>
              <td className="w-[28%] px-[2mm] py-[2mm] text-[11px]">
                {formatDateBR(values.dataVistoria)}
              </td>
              <td className="sheet-label w-[22%] px-[2mm] py-[2mm] text-[10.5px]">Protocolo SGZ</td>
              <td className="px-[2mm] py-[2mm] text-[11px]">{values.protocoloSgz}</td>
            </tr>
            <tr>
              <td className="sheet-label px-[2mm] py-[2mm] text-[10.5px]">Nº O.S.</td>
              <td className="px-[2mm] py-[2mm] text-[11px]">{values.os}</td>
              <td className="sheet-label px-[2mm] py-[2mm] text-[10.5px]">Origem da Demanda</td>
              <td className="px-[2mm] py-[2mm] text-[11px]">{values.origemDemanda}</td>
            </tr>
            <tr>
              <td className="sheet-label px-[2mm] py-[2mm] text-[10.5px] align-middle">
                Prazo para Conclusão
              </td>
              <td className="px-[2mm] py-[2mm] text-[11px] align-middle">{values.prazo}</td>
              <td className="sheet-label px-[2mm] py-[2mm] text-[10.5px] align-middle">
                Situação Atual
              </td>
              <td className="px-[2mm] py-[2mm] text-[10.5px]">
                <ul className="space-y-[1.2mm]">
                  {SGZ_SITUACOES.map((option) => {
                    const selected = values.situacao === option;
                    return (
                      <li key={option} className="flex items-center gap-[2mm] leading-tight">
                        <span
                          className={cn(
                            "flex h-[3.4mm] w-[3.4mm] shrink-0 items-center justify-center border border-sheet-line",
                          )}
                        >
                          {selected && <Check className="h-[2.8mm] w-[2.8mm]" strokeWidth={3.5} />}
                        </span>
                        <span>{option}</span>
                      </li>
                    );
                  })}
                </ul>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="sheet-photo-box m-[3mm] flex flex-1 items-center justify-center overflow-hidden p-[3mm]">
          {photo?.dataUrl ? (
            <img
              src={photo.dataUrl}
              alt={slot.caption}
              className="h-full w-full object-contain"
            />
          ) : (
            <EmptyPhoto />
          )}
        </div>
      </div>

      <div className="mt-[4mm] text-center">
        <p className="text-[11px] font-bold uppercase">{caption}</p>
        <p className="mt-[1mm] text-[9.5px]">
          Relatório de Vistoria Fotográfica — Página {pageNumber} de {totalPages}
        </p>
      </div>
    </article>
  );
}
