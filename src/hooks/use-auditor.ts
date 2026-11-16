import { useCallback, useEffect, useState } from "react";
import { cachedCounts, fetchAuditorCounts, type AuditorCounts } from "@/lib/auditor";
import { useActiveCycle } from "@/lib/cycles";

/** Contagens do módulo, com recarga manual. */
export function useAuditorCounts() {
  const ciclo = useActiveCycle();
  const [counts, setCounts] = useState<AuditorCounts | null>(() => cachedCounts());
  const [loading, setLoading] = useState(() => cachedCounts() === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(cachedCounts() === null);
    try {
      setCounts(await fetchAuditorCounts(true, ciclo));
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Falha ao carregar os indicadores");
    } finally {
      setLoading(false);
    }
  }, [ciclo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { counts, loading, error, refresh };
}
