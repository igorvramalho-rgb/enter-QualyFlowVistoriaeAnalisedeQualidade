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
    <div className="pointer-events-none absolute bottom-[2.5mm] right-[2.5mm] max-w-[88%] text-right">
      {lines.map((line) => (
        <p
          key={line}
          className="text-[11.5px] font-semibold leading-[1.32] text-white"
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            letterSpacing: "0.01em",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.85), 0 0 7px rgba(0, 0, 0, 0.55)",
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
