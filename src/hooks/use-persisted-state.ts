import { useCallback, useEffect, useState } from "react";

/**
 * Estado de interface que sobrevive à navegação e ao recarregamento da página.
 *
 * Usado pelos filtros da análise: sem isso, cada entrada na tela zerava seleção
 * de polo, status, tipo, período, ordenação e tamanho de página.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      /* armazenamento indisponível ou JSON inválido: usa o padrão */
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignora cota cheia ou modo privado */
    }
  }, [key, state]);

  const update = useCallback((value: T | ((previous: T) => T)) => {
    setState(value);
  }, []);

  return [state, update];
}
