import { DEFAULT_SETTINGS } from "@/lib/report-document";
import { normalizeNcType, POLOS, STATUS_LABELS, type AnalysisRecord } from "@/lib/analysis";
import { comparePolo } from "@/lib/analysis";
import { formatDateBR, percent } from "@/lib/fields";

interface BiReportSheetsProps {
  analyses: AnalysisRecord[];
  generatedBy?: string;
}

interface PoloRow {
  polo: string;
  total: number;
  conforme: number;
  emAndamento: number;
  naoConforme: number;
  naoAvaliado: number;
  pendente: number;
}

function summarize(analyses: AnalysisRecord[]): {
  total: number;
  conforme: number;
  emAndamento: number;
  naoConforme: number;
  naoAvaliado: number;
  pendente: number;
  polos: PoloRow[];
} {
  const base = new Map<string, PoloRow>();
  POLOS.forEach((polo) =>
    base.set(polo, {
      polo,
      total: 0,
      conforme: 0,
      emAndamento: 0,
      naoConforme: 0,
      naoAvaliado: 0,
      pendente: 0,
    }),
  );

  const totals = { total: 0, conforme: 0, emAndamento: 0, naoConforme: 0, naoAvaliado: 0, pendente: 0 };

  analyses.forEach((record) => {
    const key = record.fields.polo?.trim() || "Não informado";
    const row =
      base.get(key) ??
      {
        polo: key,
        total: 0,
        conforme: 0,
        emAndamento: 0,
        naoConforme: 0,
        naoAvaliado: 0,
        pendente: 0,
      };

    totals.total += 1;
    row.total += 1;

    if (record.status === "conforme") {
      totals.conforme += 1;
      row.conforme += 1;
    } else if (record.status === "em_andamento") {
      totals.emAndamento += 1;
      row.emAndamento += 1;
    } else if (record.status === "nao_conforme") {
      totals.naoConforme += 1;
      row.naoConforme += 1;
    } else if (record.status === "nao_avaliado") {
      totals.naoAvaliado += 1;
      row.naoAvaliado += 1;
    } else {
      totals.pendente += 1;
      row.pendente += 1;
    }

    base.set(key, row);
  });

  return {
    ...totals,
    polos: Array.from(base.values()).sort((a, b) => comparePolo(a.polo, b.polo)),
  };
}

function topMotives(analyses: AnalysisRecord[], limit = 12) {
  const map = new Map<string, number>();
  analyses.forEach((record) => {
    const motivo = normalizeNcType(record.fields.tipoNaoConformidade);
    if (motivo) {
      map.set(motivo, (map.get(motivo) ?? 0) + 1);
    }
  });
  return Array.from(map.entries())
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function byEvaluationDate(analyses: AnalysisRecord[], limit = 10) {
  const map = new Map<string, { data: string; total: number; naoConforme: number; naoAvaliado: number }>();
  analyses.forEach((record) => {
    const data = record.fields.data?.trim() || "Sem data";
    const entry = map.get(data) ?? { data, total: 0, naoConforme: 0, naoAvaliado: 0 };
    entry.total += 1;
    if (record.status === "nao_conforme") {
      entry.naoConforme += 1;
    }
    if (record.status === "nao_avaliado") {
      entry.naoAvaliado += 1;
    }
    map.set(data, entry);
  });

  return Array.from(map.values())
    .sort((a, b) => {
      const left = a.data.split("/").reverse().join("");
      const right = b.data.split("/").reverse().join("");
      return right.localeCompare(left);
    })
    .slice(0, limit);
}

function Bar({ value, total, tone }: { value: number; total: number; tone: string }) {
  const width = total > 0 ? Math.max(value > 0 ? 2 : 0, Math.round((value / total) * 100)) : 0;
  return (
    <span className="block h-[2.4mm] w-full bg-sheet-head">
      <span className="block h-full" style={{ width: `${width}%`, backgroundColor: tone }} />
    </span>
  );
}

/**
 * Relatório gerencial do módulo Analista, em folhas A4 prontas para impressão
 * e exportação em PDF (mesmo mecanismo do Emissor).
 */
export function BiReportSheets({ analyses, generatedBy }: BiReportSheetsProps) {
  const summary = summarize(analyses);
  const motives = topMotives(analyses);
  const dates = byEvaluationDate(analyses);
  const geradoEm = new Date().toLocaleString("pt-BR");
  const logos = DEFAULT_SETTINGS.logos;

  const statusRows: { label: string; value: number; color: string }[] = [
    { label: "Conforme", value: summary.conforme, color: "#10B981" },
    { label: "Em andamento", value: summary.emAndamento, color: "#F59E0B" },
    { label: "Não conforme", value: summary.naoConforme, color: "#DC2626" },
    { label: "Não avaliado", value: summary.naoAvaliado, color: "#7C3AED" },
    { label: STATUS_LABELS.pendente, value: summary.pendente, color: "#64748B" },
  ];

  const kpis = [
    { label: "Vistorias analisadas", value: String(summary.total) },
    { label: "Concluídas", value: `${percent(summary.conforme, summary.total)}%` },
    { label: "Não conformidades", value: String(summary.naoConforme) },
    { label: "Em andamento", value: String(summary.emAndamento) },
    { label: "Não avaliados (N/A)", value: String(summary.naoAvaliado) },
    { label: "Polos com vistorias", value: String(summary.polos.filter((polo) => polo.total > 0).length) },
  ];

  return (
    <>
      {/* Folha 1 — indicadores gerais */}
      <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
        <div className="sheet-frame flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-sheet-line px-[4mm] py-[3mm]">
            <img src={logos.sabesp} alt="Sabesp" className="h-[14mm] w-auto object-contain" />
            <div className="flex-1 text-center">
              <p className="text-[13px] font-bold uppercase tracking-wide">
                Relatório Gerencial — Analista BI
              </p>
              <p className="text-[10px]">Vistorias de fiscalização • Gestão de Qualidade</p>
            </div>
            {logos.consortium && (
              <img src={logos.consortium} alt="Consórcio Nova Norte" className="h-[12mm] w-auto object-contain" />
            )}
          </div>

          <div className="flex flex-wrap justify-between gap-1 border-b border-sheet-line px-[4mm] py-[1.5mm] text-[9.5px]">
            <span>Gerado em: {geradoEm}</span>
            <span>Responsável: {generatedBy || "—"}</span>
            <span>Base: {summary.total} vistoria(s)</span>
          </div>

          <table className="sheet-table mt-[3mm]">
            <tbody>
              <tr>
                <td colSpan={6} className="sheet-label px-[2mm] py-[1.4mm] text-center text-[10px]">
                  INDICADORES GERAIS
                </td>
              </tr>
              <tr>
                {kpis.map((kpi) => (
                  <td key={kpi.label} className="px-[2mm] py-[2mm] text-center align-middle">
                    <p className="text-[9px] uppercase leading-tight text-sheet-muted">{kpi.label}</p>
                    <p className="text-[15px] font-bold leading-tight">{kpi.value}</p>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <table className="sheet-table mt-[3mm]">
            <thead>
              <tr>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-left text-[9.5px]" style={{ width: "26%" }}>
                  Polo
                </th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Vistorias</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Conforme</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Em andamento</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Não conforme</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Não avaliado</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">% conclusão</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-[2mm] py-[1mm] text-[9px] font-semibold uppercase">
                  Resumo por polo
                </td>
              </tr>
              {summary.polos.map((polo) => (
                <tr key={polo.polo}>
                  <td className="px-[2mm] py-[1.4mm] text-[9.5px]">{polo.polo}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{polo.total}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{polo.conforme}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{polo.emAndamento}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{polo.naoConforme}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{polo.naoAvaliado}</td>
                  <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px] font-semibold">
                    {percent(polo.conforme, polo.total)}%
                  </td>
                </tr>
              ))}
              <tr>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-[9.5px]">TOTAL</td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">{summary.total}</td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">{summary.conforme}</td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">
                  {summary.emAndamento}
                </td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">
                  {summary.naoConforme}
                </td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">
                  {summary.naoAvaliado}
                </td>
                <td className="sheet-label px-[2mm] py-[1.4mm] text-center text-[9.5px]">
                  {percent(summary.conforme, summary.total)}%
                </td>
              </tr>
            </tbody>
          </table>

          <table className="sheet-table mt-[4mm]">
            <tbody>
              <tr>
                <td colSpan={3} className="sheet-label px-[2mm] py-[1.2mm] text-center text-[10px]">
                  DISTRIBUIÇÃO POR STATUS
                </td>
              </tr>
              {statusRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-[2mm] py-[1.6mm] text-[9.5px]" style={{ width: "30%" }}>
                    {row.label}
                  </td>
                  <td className="px-[2mm] py-[1.6mm]" style={{ width: "52%" }}>
                    <Bar value={row.value} total={summary.total} tone={row.color} />
                  </td>
                  <td className="px-[2mm] py-[1.6mm] text-[9.5px]" style={{ width: "18%" }}>
                    {row.value} ({percent(row.value, summary.total)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-auto border-t border-sheet-line px-[4mm] py-[2mm] text-center text-[8.5px]">
            QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade — Página 1 de 2
          </div>
        </div>
      </article>

      {/* Folha 2 — motivos e datas */}
      <article className="print-sheet mx-auto flex flex-col px-[10mm] py-[8mm] font-sheet">
        <div className="sheet-frame flex flex-1 flex-col">
          <div className="border-b border-sheet-line px-[4mm] py-[2.5mm] text-center">
            <p className="text-[12px] font-bold uppercase tracking-wide">
              Motivos de não conformidade e datas de avaliação
            </p>
            <p className="text-[9px]">Base de {summary.total} vistoria(s) • gerado em {geradoEm}</p>
          </div>

          <table className="sheet-table mt-[3mm]">
            <thead>
              <tr>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-left text-[9.5px]" style={{ width: "8%" }}>
                  #
                </th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-left text-[9.5px]">Motivo apontado</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]" style={{ width: "14%" }}>
                  Vistorias
                </th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]" style={{ width: "14%" }}>
                  % das NC
                </th>
              </tr>
            </thead>
            <tbody>
              {motives.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-[2mm] py-[3mm] text-center text-[9.5px]">
                    Nenhum motivo de não conformidade registrado na base.
                  </td>
                </tr>
              ) : (
                motives.map((item, index) => (
                  <tr key={item.motivo}>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9px]">{index + 1}</td>
                    <td className="px-[2mm] py-[1.4mm] text-[9px] leading-snug">{item.motivo}</td>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{item.total}</td>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">
                      {percent(item.total, summary.naoConforme)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <table className="sheet-table mt-[4mm]">
            <thead>
              <tr>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-left text-[9.5px]">
                  Data de avaliação
                </th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Vistorias</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Não conforme</th>
                <th className="sheet-label px-[2mm] py-[1.2mm] text-center text-[9.5px]">Não avaliado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-[2mm] py-[1mm] text-[9px] font-semibold uppercase">
                  Vistorias por data de avaliação
                </td>
              </tr>
              {dates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-[2mm] py-[3mm] text-center text-[9.5px]">
                    Sem datas de avaliação registradas.
                  </td>
                </tr>
              ) : (
                dates.map((item) => (
                  <tr key={item.data}>
                    <td className="px-[2mm] py-[1.4mm] text-[9.5px]">
                      {item.data === "Sem data" ? item.data : formatDateBR(item.data)}
                    </td>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{item.total}</td>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{item.naoConforme}</td>
                    <td className="px-[2mm] py-[1.4mm] text-center text-[9.5px]">{item.naoAvaliado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-[3mm] border border-sheet-line px-[3mm] py-[2mm] text-[8.5px] leading-snug">
            <span className="font-bold">Critério de classificação: </span>
            Conforme = avaliação aprovada; Não conforme = item reprovado no PDF de fiscalização; Não
            avaliado = status N/A, inspeção impossibilitada, não executado ou não localizado; Em andamento
            = obra/provisório; Pendente = dados insuficientes no PDF.
          </div>

          <div className="mt-auto border-t border-sheet-line px-[4mm] py-[2mm] text-center text-[8.5px]">
            QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade — Página 2 de 2
          </div>
        </div>
      </article>
    </>
  );
}
