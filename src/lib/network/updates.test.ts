import { describe, expect, it, vi } from "vitest";
import type { NetworkBlock, NetworkCore } from "./types";
import { newBlockHashes } from "./updates";

const observedAt = Date.parse("2026-10-11T01:00:00Z");

function block(height: number, hash = `block-${height}`, status = "PENDING"): NetworkBlock {
  return { height, hash, status, time: "2026-10-11T01:00:00Z", txCount: 1,
    sizeBytes: 1_630, pool: "Unknown", feesZec: 0 };
}

function core(recentBlocks: NetworkBlock[], overrides: Partial<NetworkCore> = {}): NetworkCore {
  const height = Math.max(0, ...recentBlocks.map((block) => block.height));
  return {
    fetchedAt: "2026-10-11T01:00:00Z", stale: false, height, chainTip: height,
    indexedHeight: height, synced: true, lastBlockAt: "2026-10-11T01:00:00Z",
    targetBlockSeconds: 75, difficulty: 1, averageDifficulty: 1, solrateGsols: 1,
    averageBlockSeconds: 75, averageTxsPerBlock: 1, averageFeesZecPerBlock: 0,
    sampleBlocks: recentBlocks.length, totalSupplyZec: 1, poolTotalZec: 1,
    shieldedZec: 0, shieldedPercent: 0, pools: [], recentBlocks,
    emission: { blockSubsidyZec: 1.5625, minerSubsidyZec: 1.25,
      nextHalvingHeight: null, blocksRemaining: null, estimatedHalvingAt: null,
      eraProgressPercent: null, nextBlockSubsidyZec: null },
    ...overrides,
  };
}

describe("Network block arrival signals", () => {
  it("does not announce a first reading, missing data, or an identical cached refresh", () => {
    const snapshot = core([block(100), block(99)]);
    expect(newBlockHashes(null, snapshot, observedAt)).toEqual([]);
    expect(newBlockHashes(snapshot, null, observedAt)).toEqual([]);
    expect(newBlockHashes(snapshot, { ...snapshot, recentBlocks: [...snapshot.recentBlocks] }, observedAt)).toEqual([]);
  });

  it("returns only new heights and hashes, newest first, regardless of response order", () => {
    const previous = core([block(100), block(99)]);
    const current = core([block(101), block(99), block(103), block(102), block(100), block(102)]);
    expect(newBlockHashes(previous, current, observedAt)).toEqual(["block-103", "block-102", "block-101"]);
  });

  it("suppresses stale current data and catch-up bursts from a stale previous reading", () => {
    const previous = core([block(100)]);
    const current = core([block(101), block(100)]);
    expect(newBlockHashes(previous, { ...current, stale: true }, observedAt)).toEqual([]);
    expect(newBlockHashes({ ...previous, stale: true }, current, observedAt)).toEqual([]);
  });

  it("does not announce a backward tip or a replacement at the same height", () => {
    const previous = core([block(100), block(99)]);
    expect(newBlockHashes(previous, core([block(99), block(98)]), observedAt)).toEqual([]);
    expect(newBlockHashes(previous, core([block(100, "replacement-100"), block(99)]), observedAt)).toEqual([]);
  });

  it("suppresses a forward tip if overlapping block hashes reveal a reorganization", () => {
    const previous = core([block(100), block(99)]);
    const current = core([block(101), block(100, "replacement-100"), block(99)]);
    expect(newBlockHashes(previous, current, observedAt)).toEqual([]);
  });

  it("uses the highest previously observed height and never announces stale block rows", () => {
    const previous = core([block(100), block(99)], { height: 105 });
    const current = core([block(107, "stale-107", "STALE"), block(106), block(105), block(104)]);
    expect(newBlockHashes(previous, current, observedAt)).toEqual(["block-106"]);
  });

  it("does not mutate source order and rejects recycled hashes at a higher height", () => {
    const previous = core([block(100)]);
    const current = core([block(101), block(102, "block-100")]);
    const sourceOrder = current.recentBlocks.map((item) => item.hash);
    expect(newBlockHashes(previous, current, observedAt)).toEqual(["block-101"]);
    expect(current.recentBlocks.map((item) => item.hash)).toEqual(sourceOrder);
  });

  it("does not announce an old baseline on recovery, then resumes signals from the fresh recovery reading", () => {
    const previous = core([block(100)], {
      fetchedAt: new Date(observedAt - 120_001).toISOString(),
    });
    const recovery = core([block(101), block(100)]);
    expect(newBlockHashes(previous, recovery, observedAt)).toEqual([]);
    const nextAt = observedAt + 30_000;
    const next = core([block(102), block(101), block(100)], {
      fetchedAt: new Date(nextAt).toISOString(),
    });
    expect(newBlockHashes(recovery, next, nextAt)).toEqual(["block-102"]);
  });

  it("rejects old current data and keeps the exact two-minute freshness boundary inclusive", () => {
    const previous = core([block(100)]);
    const oldCurrent = core([block(101), block(100)], {
      fetchedAt: new Date(observedAt - 120_001).toISOString(),
    });
    expect(newBlockHashes(previous, oldCurrent, observedAt)).toEqual([]);
    const atBoundary = new Date(observedAt - 120_000).toISOString();
    expect(newBlockHashes({ ...previous, fetchedAt: atBoundary },
      { ...oldCurrent, fetchedAt: atBoundary }, observedAt)).toEqual(["block-101"]);
  });

  it("rejects invalid dates and future-dated readings instead of assuming a live baseline", () => {
    const previous = core([block(100)]);
    const current = core([block(101), block(100)]);
    for (const fetchedAt of ["invalid", new Date(observedAt + 1).toISOString()]) {
      expect(newBlockHashes({ ...previous, fetchedAt }, current, observedAt)).toEqual([]);
      expect(newBlockHashes(previous, { ...current, fetchedAt }, observedAt)).toEqual([]);
    }
    expect(newBlockHashes(previous, current, NaN)).toEqual([]);
  });

  it("uses the observation clock by default", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(observedAt);
    try {
      expect(newBlockHashes(core([block(100)]), core([block(101), block(100)]))).toEqual(["block-101"]);
    } finally { clock.mockRestore(); }
  });
});
