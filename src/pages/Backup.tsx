import { useState } from "react";
import { Archive, CheckCircle2, Database, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import { buildAnalysisMatrix } from "@/lib/analysis-export";
import {
  backupInstructions,
  buildBackup,
  finalizeBackup,
  validateBackup,
  type BackupPackage,
} from "@/lib/backup";
import { downloadCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/xlsx-export";

/** Backup integral do sistema — disponível apenas para o gestor. */
export default function Backup() {
  const { user, profile } = useAuth();
  const [pacote, setPacote] = useState<BackupPackage | null>(null);
  const [busy, setBusy] = useState(false);

  if (!(profile?.role === "gestor" && profile?.status === "ativo")) {
    return <Navigate to="/emissor" replace />;
  }

  const gerar = async () => {
    setBusy(true);
    try {
      const bruto = await buildBackup(profile.username || user?.email || "gestor");
      const completo = finalizeBackup(bruto);
      const validacao = validateBackup(completo);

      setPacote(completo);
      toast.success("Backup gerado", {
        description: validacao.ok
          ? `Integridade conferida (${completo.integridade.assinatura})`
          : `Atenção: ${validacao.problemas.length} divergência(s) de integridade`,
      });
    } catch (error) {
      toast.error("Não foi possível gerar o backup", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const baixarJson = () => {
    if (!pacote) {
      return;
    }
    const conteudo = JSON.stringify({ ...pacote, recuperacao: backupInstructions(pacote) }, null, 2);
    const blob = new Blob([conteudo], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qualyflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const baixarExcel = async () => {
    if (!pacote) {
      return;
    }
    const { headers, rows } = buildAnalysisMatrix(pacote.tabelas.analyses);
    await downloadXlsx(`qualyflow-vistorias-${new Date().toISOString().slice(0, 10)}`, "Vistorias", headers, rows);
  };

  const baixarCsv = () => {
    if (!pacote) {
      return;
    }
    const headers = ["ID", "Nome", "Modelo", "OS", "FAC", "Endereço", "Data", "Atualizado em"];
    const rows = pacote.tabelas.reports.map((draft) => [
      draft.id,
      draft.name,
      draft.templateId,
      draft.values.os ?? "",
      draft.values.fac ?? "",
      draft.values.endereco ?? "",
      draft.values.dataVistoria || draft.values.data || "",
      draft.updatedAt,
    ]);
    downloadCsv(`qualyflow-relatorios-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Archive}
        title="Backup e recuperação"
        description="Exportação integral dos dados do sistema. As fotografias ficam no armazenamento privado e são relacionadas no manifesto com links assinados."
        chips={[
          { icon: Database, label: "5 tabelas" },
          { icon: Archive, label: "Manifesto de fotos" },
        ]}
        actions={
          <Button type="button" variant="glow" onClick={() => void gerar()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Gerar backup
          </Button>
        }
      />

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Como o backup funciona</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>• JSON integral com as cinco tabelas, preservando identificadores e relacionamentos.</li>
          <li>• Manifesto de fotos (relatório, campo, caminho e link assinado de 12 h).</li>
          <li>• Excel das vistorias e CSV dos relatórios para conferência humana.</li>
          <li>• Bloco de instruções de recuperação dentro do próprio arquivo JSON.</li>
          <li>• Nenhuma senha, token ou chave é incluído no pacote.</li>
        </ul>
      </Card>

      {pacote && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Pacote pronto
              </p>
              <p className="text-xs text-muted-foreground">
                Integridade {pacote.integridade.assinatura} • gerado em{" "}
                {new Date(pacote.geradoEm).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="glow" size="sm" onClick={baixarJson}>
                <Download className="h-4 w-4" />
                Baixar JSON
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={() => void baixarExcel()}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel das vistorias
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={baixarCsv}>
                <Download className="h-4 w-4" />
                CSV dos relatórios
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(pacote.contagens).map(([chave, total]) => (
              <div key={chave} className="rounded-lg border border-glass-border/40 bg-glass/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{chave}</p>
                <p className="text-lg font-semibold text-foreground">{total}</p>
              </div>
            ))}
          </div>

          {pacote.avisos.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
              {pacote.avisos.map((aviso) => (
                <li key={aviso}>• {aviso}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
