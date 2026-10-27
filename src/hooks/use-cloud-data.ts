import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/auth-context";
import { migrateRecordFields, type AnalysisRecord } from "@/lib/analysis";
import {
  countAnalyses,
  countReports,
  deleteAllAnalyses,
  deleteAnalysis,
  deleteReport,
  fetchAnalyses,
  fetchReports,
  fetchSettings,
  fetchUserSettings,
  pruneMyReports,
  saveAnalyses,
  saveAnalysis,
  saveReport,
  saveSettings,
  saveUserSettings,
} from "@/lib/cloud";
import {
  DEFAULT_SETTINGS,
  migrateDraftValues,
  normalizeSettings,
  type QualyflowSettings,
  type ReportDraft,
} from "@/lib/report-document";
import { readStorage, STORAGE_KEYS } from "@/lib/storage";

const REFRESH_EVENT = "qualyflow:refresh";

/**
 * Cache em memória das vistorias: ao voltar para a tela os dados aparecem na
 * hora e a busca em segundo plano só confirma. Sem isso, cada entrada zerava a
 * lista e mostrava o carregamento de novo.
 */
interface AnalysesCache {
  userId: string;
  rows: AnalysisRecord[];
  at: number;
}

let analysesCache: AnalysesCache | null = null;
const MIGRATION_FLAG = "qualyflow:cloud-migrated:v1";

function errorDescription(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function subscribeRefresh(refresh: () => void): () => void {
  const handler = () => refresh();
  window.addEventListener(REFRESH_EVENT, handler);
  return () => window.removeEventListener(REFRESH_EVENT, handler);
}

/* ------------------------------------------------------------------ relatórios */

export function useCloudReports() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchReports();
      setDrafts(rows);
    } catch (error) {
      toast.error("Não foi possível carregar os relatórios da nuvem", {
        description: errorDescription(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    void refresh();
    return subscribeRefresh(() => void refresh());
  }, [user, refresh]);

  const save = useCallback(async (draft: ReportDraft) => {
    try {
      const saved = await saveReport(draft);
      setDrafts((previous) => {
        const others = previous.filter((item) => item.id !== saved.id);
        return [saved, ...others].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
      return saved;
    } catch (error) {
      toast.error("Não foi possível salvar o relatório na nuvem", {
        description: errorDescription(error),
      });
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteReport(id);
      setDrafts((previous) => previous.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir o relatório", { description: errorDescription(error) });
      return false;
    }
  }, []);

  const pruneExcess = useCallback(
    async (keep = 2) => {
      if (!user) {
        return null;
      }
      try {
        const result = await pruneMyReports(user.id, keep);
        if (result.deleted > 0) {
          await refresh();
        }
        return result;
      } catch (error) {
        toast.error("Não foi possível limpar os relatórios antigos", {
          description: errorDescription(error),
        });
        return null;
      }
    },
    [user, refresh],
  );

  return { drafts, loading, save, remove, refresh, pruneExcess };
}

/* -------------------------------------------------------------------- vistorias */

export function useCloudAnalyses() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchAnalyses();
      setAnalyses(rows);
      if (user) {
        analysesCache = { userId: user.id, rows, at: Date.now() };
      }
    } catch (error) {
      toast.error("Não foi possível carregar as vistorias da nuvem", {
        description: errorDescription(error),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    // Mostra o que já foi carregado nesta sessão e atualiza em segundo plano.
    if (analysesCache && analysesCache.userId === user.id) {
      setAnalyses(analysesCache.rows);
      setLoading(false);
    }
    void refresh();
    return subscribeRefresh(() => void refresh());
  }, [user, refresh]);

  const addMany = useCallback(async (records: AnalysisRecord[]) => {
    try {
      const saved = await saveAnalyses(records);
      setAnalyses((previous) => [...saved, ...previous]);
      return saved;
    } catch (error) {
      toast.error("Não foi possível salvar as vistorias na nuvem", {
        description: errorDescription(error),
      });
      return [];
    }
  }, []);

  const save = useCallback(async (record: AnalysisRecord) => {
    try {
      const saved = await saveAnalysis(record);
      setAnalyses((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
      return saved;
    } catch (error) {
      toast.error("Não foi possível salvar a revisão na nuvem", {
        description: errorDescription(error),
      });
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteAnalysis(id);
      setAnalyses((previous) => previous.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      toast.error("Não foi possível excluir a vistoria", { description: errorDescription(error) });
      return false;
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await deleteAllAnalyses();
      setAnalyses([]);
      return true;
    } catch (error) {
      toast.error("Não foi possível limpar a base", { description: errorDescription(error) });
      return false;
    }
  }, []);

  return { analyses, loading, addMany, save, remove, clear, refresh };
}

/* ---------------------------------------------------------------- configurações */

export function useCloudSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<QualyflowSettings>(DEFAULT_SETTINGS);
  const [personalizado, setPersonalizado] = useState(false);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const mine = user ? await fetchUserSettings(user.id) : null;
      if (mine) {
        setSettings(mine);
        setPersonalizado(true);
      } else {
        const shared = await fetchSettings();
        setSettings(shared);
        setPersonalizado(false);
      }
    } catch (error) {
      toast.error("Não foi possível carregar as logos da nuvem", {
        description: errorDescription(error),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void refresh();
    return subscribeRefresh(() => void refresh());
  }, [user, refresh]);

  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const update = useCallback((next: QualyflowSettings) => {
    const normalized = normalizeSettings(next);
    setSettings(normalized);

    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      const request = user
        ? saveUserSettings(user.id, normalized)
        : saveSettings(normalized);

      void request
        .then(() => setPersonalizado(true))
        .catch((error: unknown) => {
          toast.error("Não foi possível salvar as logos na nuvem", {
            description: errorDescription(error),
          });
        });
    }, 700);
  }, [user]);

  return { settings, loading, update, refresh, personalizado };
}

/* --------------------------------------------------------- migração da base local */

export function useLegacyCloudMigration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || window.localStorage.getItem(MIGRATION_FLAG)) {
      return;
    }

    const run = async () => {
      const localDrafts = readStorage<ReportDraft[]>(STORAGE_KEYS.drafts, []);
      const localAnalyses = readStorage<AnalysisRecord[]>(STORAGE_KEYS.analyses, []);
      const localSettings = readStorage<QualyflowSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);

      if (localDrafts.length === 0 && localAnalyses.length === 0) {
        window.localStorage.setItem(MIGRATION_FLAG, "empty");
        return;
      }

      const [reportsInCloud, analysesInCloud] = await Promise.all([countReports(), countAnalyses()]);
      if (reportsInCloud > 0 || analysesInCloud > 0) {
        window.localStorage.setItem(MIGRATION_FLAG, "skipped");
        return;
      }

      for (const draft of localDrafts) {
        await saveReport({ ...draft, values: migrateDraftValues(draft.values) });
      }
      await saveAnalyses(
        localAnalyses.map((record) => ({ ...record, fields: migrateRecordFields(record.fields) })),
      );
      await saveSettings(normalizeSettings(localSettings));

      window.localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
      window.dispatchEvent(new Event(REFRESH_EVENT));
      toast.success("Dados deste computador enviados para a nuvem", {
        description: `${localDrafts.length} relatório(s) e ${localAnalyses.length} vistoria(s).`,
      });
    };

    void run().catch(() => {
      /* tenta novamente na próxima sessão */
    });
  }, [user]);
}
