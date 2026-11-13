import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { MINING_SOURCE, miningAnswer, miningSnapshot } from "./mining";
const now = Date.UTC(2026, 8, 28, 12);
const fixture = () => ({
  info: { best_block: 3_500_000, chain_tip: 3_500_000, status: "synced" },
  recent_blocks: Array.from({ length: 20 }, (_, i) => ({ height: 3_500_000 - i, time: now / 1000 - i * 75, difficulty: 300_000_000 + i * 100_000, status: "PENDING" })),
});
/** After NU7: 25-second blocks and the difficulty the node reported on 2026-11-13. */
const nu7Now = Date.UTC(2026, 10, 13, 16, 30);
const nu7Fixture = () => ({
  info: { best_block: 3_569_411, chain_tip: 3_569_411, status: "synced", target_block_spacing_secs: 25, work_per_difficulty: 8192 },
  recent_blocks: Array.from({ length: 20 }, (_, i) => ({ height: 3_569_411 - i, time: nu7Now / 1000 - i * 25, difficulty: 88_000_000 + i * 100_000, status: "PENDING" })),
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("The estimate on each side of NU7", () => {
  it("divides by the 25-second target spacing once blocks are 25 seconds apart", () => {
    const data = miningSnapshot(nu7Fixture(), nu7Now);
    expect(data.targetSpacingSeconds).toBe(25);
    expect(data.solrate).toBeCloseTo(88_950_000 * 8192 / 25, 4);
    // About 29 GSol/s; dividing by 75 would report a third of the network.
    expect(data.solrate / 1e9).toBeGreaterThan(29);
  });
  it("keeps dividing by 75 for a sample taken before NU7", () => {
    expect(miningSnapshot(fixture(), now).targetSpacingSeconds).toBe(75);
  });
  it("states the divisor it used in every language", () => {
    vi.useFakeTimers(); vi.setSystemTime(nu7Now);
    const content = JSON.stringify({ data: miningSnapshot(nu7Fixture(), nu7Now) });
    expect(miningAnswer(content, "en")).toContain("average difficulty × 8192 ÷ 25, following ZcashInfo's methodology");
    expect(miningAnswer(content, "pt")).toContain("dificuldade média × 8192 ÷ 25, conforme a metodologia do ZcashInfo");
    expect(miningAnswer(content, "es")).toContain("dificultad promedio × 8192 ÷ 25, según la metodología de ZcashInfo");
    expect(miningAnswer(content, "en")).not.toContain("÷ 75");
  });
  it("refuses a sample whose source reports a spacing the consensus rules do not", () => {
    const data = nu7Fixture();
    data.info.target_block_spacing_secs = 75;
    expect(() => miningSnapshot(data, nu7Now)).toThrow("MINING_SPACING_MISMATCH");
  });
  it("refuses a sample whose source reports another work factor", () => {
    const data = nu7Fixture();
    data.info.work_per_difficulty = 4096;
    expect(() => miningSnapshot(data, nu7Now)).toThrow("MINING_SPACING_MISMATCH");
  });
});
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
    const text = miningAnswer(JSON.stringify({ data }), "pt");
    expect(text).toContain("desatualizada"); expect(text).toContain("UTC");
    expect(text).not.toContain("Hashrate estimado da rede Zcash:");
    const es = miningAnswer(JSON.stringify({ data }), "es");
    expect(es).toContain("Última referencia disponible (desactualizada):"); expect(es).toContain("No pude confirmar una lectura actual."); expect(es).toContain("UTC");
    expect(es).not.toContain("Hashrate estimado de la red Zcash:");
  });
  it("carries the same figures, source and caveats in Spanish", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const data = miningSnapshot(fixture(), now);
    const en = miningAnswer(JSON.stringify({ data }), "en"), es = miningAnswer(JSON.stringify({ data }), "es");
    const gsol = en.match(/\*\*([\d.,]+) GSol\/s\*\*/)![1];
    expect(es).toContain(`Hashrate estimado de la red Zcash: **${gsol} GSol/s**`); expect(es).toContain("Dificultad promedio de **20 bloques**");
    expect(es).toContain(`del ${data.fromHeight} al ${data.toHeight}`); expect(es).toContain("Consultado el"); expect(es).toContain(MINING_SOURCE); expect(es).toContain("[Metodología](https://zcashinfo.com/learn/solrate/)");
    expect(es).toContain("dificultad promedio × 8192 ÷ 75, según la metodología de ZcashInfo. No es un conteo de máquinas ni un promedio de 24 horas.");
    expect(es).not.toMatch(/blocks|Retrieved|Metodologia\]/);
  });
  it("includes the source, date and averaging window without conflating units", () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const text = miningAnswer(JSON.stringify({ data: miningSnapshot(fixture(), now) }), "en");
    expect(text).toContain("GSol/s"); expect(text).toContain("20 blocks"); expect(text).toContain("UTC");
    expect(text).toContain(MINING_SOURCE); expect(text).toContain("not a machine count or a 24-hour average");
  });
  it.each(["{}", '{"data":{"solrate":0}}', "invalid"])("reports unavailable data without claiming a zero or fabricated estimate: %s", content => {
    expect(miningAnswer(content, "pt")).toContain("Não consegui confirmar");
    expect(miningAnswer(content, "en")).not.toContain("**0");
    expect(miningAnswer(content, "es")).toContain("No pude confirmar el hashrate actual de la red Zcash."); expect(miningAnswer(content, "es")).toContain("Esto no significa que el hashrate sea cero.");
    expect(miningAnswer(content, "es")).not.toContain("**0");
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
