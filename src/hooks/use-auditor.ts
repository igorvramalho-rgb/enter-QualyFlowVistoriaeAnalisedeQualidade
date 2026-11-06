import { useCallback, useEffect, useState } from "react";
import { fetchAuditorCounts, type AuditorCounts } from "@/lib/auditor";

/** Contagens do módulo, com recarga manual. */
export function useAuditorCounts() {
  const [counts, setCounts] = useState<AuditorCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCounts(await fetchAuditorCounts());
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Falha ao carregar os indicadores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { counts, loading, error, refresh };
}
