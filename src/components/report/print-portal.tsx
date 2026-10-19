import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Copia as folhas para a porta de impressão (#print-portal), fora do shell da
 * aplicação. Na impressão o shell é ocultado e só as folhas A4 são impressas.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById("print-portal"));
    document.documentElement.classList.add("has-print-sheets");
    return () => document.documentElement.classList.remove("has-print-sheets");
  }, []);

  if (!container) {
    return null;
  }

  return createPortal(children, container);
}
