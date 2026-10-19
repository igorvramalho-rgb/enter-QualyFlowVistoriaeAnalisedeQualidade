import type { AnalysisRecord } from "@/lib/analysis";
import { formatDateTimeBR } from "@/lib/fields";

/** Rótulo da última importação, usado nos chips do cabeçalho da tela. */
export function lastAnalysisLabel(analyses: AnalysisRecord[]): string {
  const ultima = analyses
    .map((item) => item.analyzedAt)
    .sort()
    .at(-1);
  return ultima ? `Última análise: ${formatDateTimeBR(ultima)}` : "Nenhuma análise registrada";
}
