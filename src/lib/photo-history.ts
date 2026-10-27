/**
 * Histórico de versões das fotos.
 *
 * Cada recorte, ajuste ou restauração gera **um arquivo novo** no armazenamento.
 * Sem limite, o histórico cresce a cada edição e multiplica arquivos no bucket.
 * A regra abaixo limita apenas o que é **gravado daqui para frente**: nenhum
 * histórico já salvo é reescrito e nenhum arquivo é apagado.
 */

/** Quantas versões anteriores ficam disponíveis para "Desfazer". */
export const HISTORY_LIMIT = 3;

/**
 * Acrescenta caminhos ao histórico e mantém somente as últimas versões.
 * Caminhos vazios são ignorados e repetições consecutivas não duplicam.
 */
export function pushHistory(
  history: string[] | undefined,
  ...paths: (string | undefined | null)[]
): string[] {
  const next = [...(history ?? [])];

  for (const path of paths) {
    if (!path) {
      continue;
    }
    if (next[next.length - 1] === path) {
      continue;
    }
    next.push(path);
  }

  return next.slice(-HISTORY_LIMIT);
}

/** Última versão disponível para desfazer (sem alterar o histórico). */
export function lastHistory(history: string[] | undefined): string | undefined {
  return history && history.length > 0 ? history[history.length - 1] : undefined;
}

/** Remove a última versão depois de desfazer. */
export function popHistory(history: string[] | undefined): string[] {
  return (history ?? []).slice(0, -1);
}
