import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { readStorage, subscribeStorage, writeStorage } from "@/lib/storage";

type Updater<T> = T | ((previous: T) => T);

/**
 * Estado persistido no armazenamento local deste navegador, sincronizado entre
 * os componentes que usam a mesma chave.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const fallbackRef = useRef(initialValue);
  const [value, setValue] = useState<T>(() => readStorage(key, fallbackRef.current));

  useEffect(() => {
    setValue(readStorage(key, fallbackRef.current));
    return subscribeStorage(key, () => setValue(readStorage(key, fallbackRef.current)));
  }, [key]);

  const update = useCallback(
    (updater: Updater<T>) => {
      setValue((previous) => {
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(previous) : updater;
        const result = writeStorage(key, next);
        if (!result.ok && result.reason === "quota") {
          toast.error("Armazenamento local cheio", {
            description:
              "Remova fotos ou registros antigos para continuar salvando os dados deste navegador.",
          });
        }
        return next;
      });
    },
    [key],
  );

  return [value, update] as const;
}
