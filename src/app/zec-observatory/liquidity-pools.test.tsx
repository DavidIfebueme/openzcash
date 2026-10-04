import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefiPools, type PoolStat } from "@/lib/defi/pools";
import { LiquidityPools } from "./liquidity-pools";

vi.mock("@/lib/defi/pools", () => ({ getDefiPools: vi.fn() }));

const native: PoolStat = {
  venue: "Maya Protocol",
  asset: "ZEC.ZEC",
  url: "https://www.mayascan.org/pool/ZEC.ZEC",
  zecDepth: 250,
  priceUsd: 300,
  tvlUsd: 150_000,
  apyPct: 3.2,
  volume24hUsd: null,
};
const bridged: PoolStat = {
  venue: "NEAR · Rhea Finance",
  asset: "ZEC / wNEAR",
  url: "https://www.geckoterminal.com/near/pools/refv1-6065",
  zecDepth: 100,
  priceUsd: 300,
  tvlUsd: 60_000,
  apyPct: null,
  volume24hUsd: 12_000,
};

beforeEach(() => vi.mocked(getDefiPools).mockReset());

describe("Observatory pool liquidity", () => {
  it("retains per-venue data and sources while distinguishing native and estimated bridged depth", async () => {
    vi.mocked(getDefiPools).mockResolvedValue([native, bridged]);
    const html = renderToStaticMarkup(await LiquidityPools());
    expect(html).toContain("Native ZEC");
    expect(html).toContain("Bridged ZEC on NEAR");
    expect(html).toContain("ZEC depth");
    expect(html).toContain("Est. ZEC depth");
    expect(html).toContain("Est. pool value");
    expect(html).toContain("Reported pool value");
    expect(html).toContain("$150,000");
    expect(html).toContain("$60,000");
    expect(html).toContain("3.20%");
    expect(html).toContain("$12,000");
    expect(html).toContain(`href="${native.url}"`);
    expect(html).toContain(`href="${bridged.url}"`);
    expect(html).toContain('href="/zcg/investments"');
    expect(html).not.toContain("$210,000");
  });

  it("shows unavailable coverage without asserting zero liquidity when every source is missing", async () => {
    vi.mocked(getDefiPools).mockResolvedValue([]);
    const html = renderToStaticMarkup(await LiquidityPools());
    expect(html).toContain("Pool data is unavailable");
    expect(html).not.toContain("$0");
    expect(html).not.toContain("0 ZEC");
    expect(html).not.toContain("Pools live");
  });

  it("does not turn helper fallback zeros into confirmed APY or volume readings", async () => {
    vi.mocked(getDefiPools).mockResolvedValue([
      { ...native, apyPct: 0 },
      { ...bridged, volume24hUsd: 0 },
    ]);
    const html = renderToStaticMarkup(await LiquidityPools());
    expect(html.match(/<dd>Unavailable<\/dd>/g)).toHaveLength(2);
    expect(html).not.toContain("0.00%");
    expect(html).not.toContain("<dd>$0</dd>");
    expect(html).toContain("Coverage is partial");
    expect(html).toContain("may use a saved response");
  });
});
