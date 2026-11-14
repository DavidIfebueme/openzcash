type Dated<T> = { data: T | null; stale: boolean };

/**
 * Detail line of a native-swap highlight card (Maya, THORChain): lifetime
 * volume plus what the network itself says about trading. A pool can stay
 * "available" while its chain is halted, so trading is never implied without
 * a current network read.
 */
export function nativeSwapDetail(
  history: Dated<{ volumeAllTimeUsd: number }>,
  network: Dated<{ paused: boolean }>,
  format: (usd: number) => string,
  fallback: string,
): string {
  const status =
    network.data && !network.stale
      ? network.data.paused
        ? " · trading paused"
        : ""
      : " · status unavailable";
  if (!history.data) return `${fallback}${status}`;
  return `${format(history.data.volumeAllTimeUsd)} all-time${history.stale ? " · saved" : ""}${status}`;
}
