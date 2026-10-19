import { useEffect, useRef, useState } from "react";

/**
 * Escala o conteúdo (folha A4 de 210mm ≈ 794px) para caber no painel de
 * pré-visualização, mantendo o conteúdo em tamanho real no DOM para que a
 * exportação em PDF capture a página em dimensões exatas.
 */
export function useScaledContainer(contentWidth = 794) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) {
        return;
      }
      const available = Math.max(240, outer.clientWidth - 16);
      const nextScale = Math.min(1, Math.max(0.28, available / contentWidth));
      setScale(nextScale);
      setHeight(inner.scrollHeight * nextScale);
      setReady(true);
    };

    update();
    const observer = new ResizeObserver(update);
    if (outerRef.current) {
      observer.observe(outerRef.current);
    }
    if (innerRef.current) {
      observer.observe(innerRef.current);
    }
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [contentWidth]);

  return { outerRef, innerRef, scale, height, ready };
}
