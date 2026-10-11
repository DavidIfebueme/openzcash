import type { NetworkCore } from "./types";

/** Newly observed forward blocks, excluding refreshes and reorganized chains. */
export function newBlockHashes(
  previous: NetworkCore | null,
  current: NetworkCore | null,
  observedAt: number = Date.now(),
): string[] {
  if (!previous || !current || previous.stale || current.stale) return [];
  const previousAt = Date.parse(previous.fetchedAt);
  const currentAt = Date.parse(current.fetchedAt);
  const recent = (at: number) => Number.isFinite(at) && Number.isFinite(observedAt)
    && observedAt - at >= 0 && observedAt - at <= 120_000;
  if (!recent(previousAt) || !recent(currentAt)) return [];
  if (current.height < previous.height) return [];

  const previousBlocks = previous.recentBlocks.filter((block) => block.status?.toUpperCase() !== "STALE");
  const currentBlocks = current.recentBlocks.filter((block) => block.status?.toUpperCase() !== "STALE");
  const previousMaxHeight = Math.max(previous.height, ...previousBlocks.map((block) => block.height));
  const currentMaxHeight = Math.max(current.height, ...currentBlocks.map((block) => block.height));
  if (currentMaxHeight <= previousMaxHeight) return [];

  const previousByHeight = new Map(previousBlocks.map((block) => [block.height, block.hash]));
  if (currentBlocks.some((block) => previousByHeight.has(block.height)
    && previousByHeight.get(block.height) !== block.hash)) return [];

  const previousHashes = new Set(previousBlocks.map((block) => block.hash));
  return [...new Set(currentBlocks
    .filter((block) => block.height > previousMaxHeight && !previousHashes.has(block.hash))
    .sort((a, b) => b.height - a.height)
    .map((block) => block.hash))];
}
