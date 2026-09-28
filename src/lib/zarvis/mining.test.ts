import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { MINING_SOURCE, miningAnswer, miningSnapshot } from "./mining";
const now = Date.UTC(2026, 8, 28, 12);
const fixture = () => ({
  info: { best_block: 3_500_000, chain_tip: 3_500_000, status: "synced" },
  recent_blocks: Array.from({ length: 20 }, (_, i) => ({ height: 3_500_000 - i, time: now / 1000 - i * 75, difficulty: 300_000_000 + i * 100_000, status: "PENDING" })),
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Dated public mining estimates", () => {
  it("calculates the publisher's 20-block estimate with the actual sampled range", () => {
    const data = miningSnapshot(fixture(), now);
    expect(data.solrate).toBeCloseTo(300_950_000 * 8192 / 75, 4);
    expect(data).toMatchObject({ unit: "Sol/s", blockCount: 20, fromHeight: 3_499_981, toHeight: 3_500_000, stale: false });
    expect(data.observedTo).toBe("2026-09-28T12:00:00.000Z");
  });
  it.each(["missing", "duplicate", "gap", "unsynced", "lag", "stale-block", "future", "invalid"])("rejects a misleading sample: %s", kind => {
    const data = fixture();
    if (kind === "missing") data.recent_blocks.pop();
    if (kind === "duplicate") data.recent_blocks[1] = data.recent_blocks[0];
    if (kind === "gap") data.recent_blocks[19].height--;
    if (kind === "unsynced") data.info.status = "syncing";
    if (kind === "lag") data.info.chain_tip += 10;
    if (kind === "stale-block") data.recent_blocks[0].status = "STALE";
    if (kind === "future") data.recent_blocks[0].time += 1000;
    if (kind === "invalid") data.recent_blocks[0].difficulty = Infinity;
    expect(() => miningSnapshot(data, now)).toThrow();
  });
  it("keeps delayed readings distinct from current ones, even if freshly retrieved", () => {
    vi.useFakeTimers(); vi.setSystemTime(now + 60 * 60_000);
    const data = miningSnapshot(fixture(), now + 60 * 60_000);
    expect(data.stale).toBe(true);
    const text = miningAnswer(JSON.stringify({ data }), true);
    expect(text).toContain("desatualizada"); expect(text).toContain("UTC");
    expect(text).not.toContain("Hashrate estimado da rede Zcash:");
  });
  it("includes the source, date and averaging window without conflating units", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const text = miningAnswer(JSON.stringify({ data: miningSnapshot(fixture(), now) }), false);
    expect(text).toContain("GSol/s"); expect(text).toContain("20 blocks"); expect(text).toContain("UTC");
    expect(text).toContain(MINING_SOURCE); expect(text).toContain("not a machine count or a 24-hour average");
  });
  it.each(["{}", '{"data":{"solrate":0}}', "invalid"])("reports unavailable data without claiming a zero or fabricated estimate: %s", content => {
    expect(miningAnswer(content, true)).toContain("Não consegui confirmar");
    expect(miningAnswer(content, false)).not.toContain("**0");
  });
});
describe("Public API boundary", () => {
  beforeEach(() => { vi.resetModules(); });
  it("uses only the fixed endpoint, strips raw block content and caches for a minute", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture()), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const { readMiningSnapshot } = await import("./mining");
    const first = await readMiningSnapshot(new AbortController().signal);
    await readMiningSnapshot(new AbortController().signal);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe(MINING_SOURCE);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Accept: "application/json" } });
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    expect(JSON.stringify(first)).not.toContain("recent_blocks");
  });
  it.each(["http", "html", "oversized", "malformed"])("rejects bad responses: %s", async kind => {
    const response = kind === "http" ? new Response("blocked", { status: 403 })
      : kind === "html" ? new Response("<html>challenge</html>", { headers: { "content-type": "text/html" } })
      : new Response(kind === "oversized" ? "x".repeat(2 * 1024 * 1024 + 1) : "{}", { headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const { readMiningSnapshot } = await import("./mining");
    await expect(readMiningSnapshot(new AbortController().signal)).rejects.toThrow();
  });
  it("honors cancellation without a public request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { readMiningSnapshot } = await import("./mining");
    const abort = new AbortController(); abort.abort();
    await expect(readMiningSnapshot(abort.signal)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
});
