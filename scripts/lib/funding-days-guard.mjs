/**
 * Published days are append-only: a source that rewrites or drops history must
 * stop the refresh for a human to review, never reach production unattended.
 * Returns the reason to refuse, or null when `next` only adds days.
 */
export function historyRewrite(previous, next) {
  if (next.length < previous.length) {
    return `series shrank from ${previous.length} to ${next.length} days`;
  }
  const index = previous.findIndex(
    (row, i) => JSON.stringify(row) !== JSON.stringify(next[i]),
  );
  return index === -1 ? null : `published day ${previous[index][0]} changed`;
}
