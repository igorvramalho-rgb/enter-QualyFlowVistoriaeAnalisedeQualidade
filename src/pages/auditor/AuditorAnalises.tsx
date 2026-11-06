import { AuditorShell } from "@/components/auditor/auditor-shell";
import Analista from "@/pages/Analista";

/**
 * Área de Análises do Qualy Auditor — reaproveita integralmente o motor do
 * Analista BI (importação de PDFs/planilhas, extração, indicadores e tabela).
 * A tabela qualyflow_analyses permanece intacta.
 */
export default function AuditorAnalises() {
  return (
    <AuditorShell>
      <Analista />
    </AuditorShell>
  );
}
