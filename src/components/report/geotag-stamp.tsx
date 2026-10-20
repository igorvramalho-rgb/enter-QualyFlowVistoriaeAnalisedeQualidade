import { hasGeotagContent, type GeotagData } from "@/lib/geotag";

/**
 * Marca de data/local (GPS) sobre a fotografia, no canto inferior direito,
 * como nas fotos de campo: data/hora, coordenadas, endereço, bairro e cidade.
 */
export function GeotagStamp({ geotag }: { geotag: GeotagData | undefined }) {
  if (!hasGeotagContent(geotag) || !geotag) {
    return null;
  }

  const lines = [
    geotag.dataHora,
    geotag.coordenadas,
    geotag.endereco,
    geotag.bairro,
    geotag.cidade,
  ].filter((line) => line.trim().length > 0);

  return (
    <div className="pointer-events-none absolute bottom-[2mm] right-[2mm] max-w-[80%] text-right">
      {lines.map((line) => (
        <p
          key={line}
          className="text-[9.5px] font-semibold leading-snug text-white"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)" }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
