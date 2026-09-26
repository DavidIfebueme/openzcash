import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ markets: vi.fn(), quote: vi.fn() }));
vi.mock("@/app/api/markets/route", () => ({ GET: mocks.markets }));
vi.mock("@/lib/pricing/live-price", () => ({ currentZecUsdQuote: mocks.quote }));
import { lookupPublicData } from "./data";

describe("Zarvis price lookup", () => {
  it("gets a dated quote without waiting for the full market dashboard", async () => {
    mocks.quote.mockResolvedValue({ cents: 153271, source: "CoinGecko", sourceUrl: "https://api.coingecko.com/api/v3/simple/price", quotedAt: "2026-09-26T04:32:20.000Z", fetchedAt: "2026-09-26T04:34:38.622Z", stale: false });
    const result = await lookupPublicData({ topic: "price", query: "" }, new AbortController().signal);
    const data = JSON.parse(result.content);
    expect(data.error).toBeUndefined();
    expect(data.data).toMatchObject({ asset: "ZEC", currency: "USD", quote: { usd: 1532.71, stale: false, quotedAt: "2026-09-26T04:32:20.000Z" } });
    expect(result.source?.url).toBe("https://openzcash.org/api/zec-price");
    expect(mocks.quote).toHaveBeenCalledTimes(1);
    expect(mocks.markets).not.toHaveBeenCalled();
  });
});
