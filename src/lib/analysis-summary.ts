import type { AnalysisRecord } from "@/lib/analysis";
import { formatDateTimeBR } from "@/lib/fields";

/** Rótulo da última importação, usado nos chips do cabeçalho da tela. */
export function lastAnalysisLabel(analyses: AnalysisRecord[]): string {
  const datas = analyses.map((item) => item.analyzedAt).sort();
  const ultima = datas.length > 0 ? datas[datas.length - 1] : undefined;
  return ultima ? `Última análise: ${formatDateTimeBR(ultima)}` : "Nenhuma análise registrada";
}
