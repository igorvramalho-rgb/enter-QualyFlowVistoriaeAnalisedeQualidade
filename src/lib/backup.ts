import { supabase } from "@/integrations/supabase/client";
import { fetchAnalyses, fetchReports, fetchSettings } from "@/lib/cloud";
import { fetchProfiles } from "@/lib/users";
import type { AppUser } from "@/lib/users";
import type { AnalysisRecord } from "@/lib/analysis";
import type { PhotoEntry, QualyflowSettings, ReportDraft } from "@/lib/report-document";
import { PHOTO_BUCKET } from "@/lib/photo-storage";

export interface PhotoManifestEntry {
  reportId: string;
  reportName: string;
  slot: string;
  path: string;
  originalPath?: string;
  include: boolean;
  /** Link temporário válido por 12 h, para baixar o arquivo enquanto o manifesto é usado. */
  signedUrl?: string;
}

export interface BackupPackage {
  formato: string;
  geradoEm: string;
  geradoPor: string;
  contagens: Record<string, number>;
  integridade: { assinatura: string; tabelas: Record<string, number> };
  avisos: string[];
  tabelas: {
    profiles: AppUser[];
    reports: ReportDraft[];
    analyses: AnalysisRecord[];
    settingsCompartilhadas: QualyflowSettings;
    userSettingsProprias: unknown;
  };
  manifestoFotos: PhotoManifestEntry[];
  /**
   * Limitações declaradas do pacote. Evita confundir o manifesto com uma cópia
   * das fotografias: os arquivos **não** estão dentro do JSON.
   */
  limitacoes: {
    fotosIncluidas: false;
    fotosApenasManifesto: true;
    linksValidadeHoras: number;
    restauracaoTestada: boolean;
  };
}

/** Hash simples (FNV-1a) para conferir a integridade do pacote. */
function checksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function buildBackup(usuario: string): Promise<BackupPackage> {
  const avisos: string[] = [
    "As fotografias NÃO estão dentro deste JSON: o manifesto traz caminho e link assinado de 12 h (temporário).",
    "A restauração do backup ainda não foi testada em ambiente isolado.",
  ];

  const [profiles, reports, analyses, settingsCompartilhadas] = await Promise.all([
    fetchProfiles().catch(() => {
      avisos.push("Perfis não puderam ser exportados (permissão restrita ao gestor).");
      return [] as AppUser[];
    }),
    fetchReports(),
    fetchAnalyses(),
    fetchSettings().catch(() => {
      avisos.push("Configuração compartilhada (logotipos) não pôde ser exportada.");
      return null;
    }),
  ]);

  const { data: userSettings } = await supabase
    .from("qualyflow_user_settings")
    .select("*")
    .limit(500);

  if (!userSettings || userSettings.length === 0) {
    avisos.push(
      "Configurações individuais de outros usuários não são exportadas: a política de acesso permite ler apenas a própria configuração.",
    );
  }

  const manifestoFotos: PhotoManifestEntry[] = reports.flatMap((report) =>
    Object.entries(report.photos as Record<string, PhotoEntry>).map(([slot, entry]) => ({
      reportId: report.id,
      reportName: report.name,
      slot,
      path: entry.path ?? "",
      originalPath: entry.originalPath,
      include: entry.include,
      signedUrl: entry.dataUrl?.startsWith("http") ? entry.dataUrl : undefined,
    })),
  );

  const semArquivo = manifestoFotos.filter((item) => !item.path);
  if (semArquivo.length > 0) {
    avisos.push(
      `${semArquivo.length} foto(s) guardadas no formato antigo (imagem embutida, sem caminho no armazenamento).`,
    );
  }

  return {
    formato: "qualyflow-backup-v1",
    geradoEm: new Date().toISOString(),
    geradoPor: usuario,
    contagens: {
      profiles: profiles.length,
      reports: reports.length,
      analyses: analyses.length,
      fotosReferenciadas: manifestoFotos.length,
      fotosNoArmazenamento: manifestoFotos.filter((item) => item.path).length,
    },
    integridade: {
      assinatura: "",
      tabelas: {
        profiles: profiles.length,
        reports: reports.length,
        analyses: analyses.length,
        fotos: manifestoFotos.length,
      },
    },
    avisos,
    limitacoes: {
      fotosIncluidas: false,
      fotosApenasManifesto: true,
      linksValidadeHoras: 12,
      restauracaoTestada: false,
    },
    tabelas: {
      profiles,
      reports,
      analyses,
      settingsCompartilhadas: settingsCompartilhadas ?? ({} as QualyflowSettings),
      userSettingsProprias: userSettings ?? [],
    },
    manifestoFotos,
  };
}

/** Fecha o pacote com a assinatura de integridade. */
export function finalizeBackup(pacote: BackupPackage): BackupPackage {
  return {
    ...pacote,
    integridade: {
      ...pacote.integridade,
      assinatura: checksum(JSON.stringify(pacote.tabelas)),
    },
  };
}

export function validateBackup(pacote: BackupPackage): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  const assinatura = checksum(JSON.stringify(pacote.tabelas));

  if (assinatura !== pacote.integridade.assinatura) {
    problemas.push("Assinatura de integridade não confere com o conteúdo.");
  }
  Object.entries(pacote.integridade.tabelas).forEach(([tabela, total]) => {
    const encontrado =
      tabela === "fotos"
        ? pacote.manifestoFotos.length
        : (pacote.tabelas as unknown as Record<string, unknown[]>)[tabela]?.length;
    if (encontrado !== total) {
      problemas.push(`Contagem divergente em ${tabela}: esperado ${total}, encontrado ${encontrado}.`);
    }
  });

  return { ok: problemas.length === 0, problemas };
}

/** Instruções que acompanham o pacote, para recuperação das fotografias. */
export function backupInstructions(pacote: BackupPackage): string {
  return [
    "# QualyFlow — instruções de recuperação",
    "",
    `Pacote: ${pacote.formato}`,
    `Gerado em: ${pacote.geradoEm}`,
    `Gerado por: ${pacote.geradoPor}`,
    `Assinatura de integridade: ${pacote.integridade.assinatura}`,
    "",
    "## Conteúdo",
    ...Object.entries(pacote.contagens).map(([chave, total]) => `- ${chave}: ${total}`),
    "",
    "## Dados",
    "- Backup completo em JSON: tabelas, relatórios, vistorias, configurações e manifesto de fotos.",
    "- Planilha de vistorias (Excel) e CSV de relatórios: leitura humana e conferência.",
    "",
    "## Fotografias (importante)",
    `Os arquivos ficam no bucket privado "${PHOTO_BUCKET}" e **não** vão embutidos no JSON.`,
    "O manifesto relata, para cada foto: relatório, campo, caminho e um link assinado válido por 12 horas.",
    "Procedimento de recuperação:",
    "1. Abra o JSON e localize `manifestoFotos`.",
    "2. Baixe cada arquivo pelo campo `signedUrl` antes do vencimento (12 h) e guarde na estrutura de pastas desejada.",
    "3. Se os links expirarem, gere o backup novamente para emitir novos links assinados.",
    "",
    "## Restauração dos dados",
    "1. Use um ambiente separado (nunca produção) para o teste de restauração.",
    "2. Reimporte as tabelas na ordem: profiles → settings → reports → analyses.",
    "3. Confira a assinatura de integridade informada acima.",
    "4. Restaure as fotografias usando caminho + relatório + campo do manifesto.",
    "",
    "## O que este pacote não contém",
    "- Senhas, tokens e chaves de serviço (por segurança).",
    "- Configurações individuais de outros usuários (leitura restrita por política de acesso).",
  ].join("\n");
}
