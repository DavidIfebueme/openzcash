import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ quote: vi.fn() }));
vi.mock("@/lib/pricing/live-price", () => ({ currentZecUsdQuote: mocks.quote }));
import { GET } from "./route";

const quote = {
  cents: 153271, source: "CoinGecko", sourceUrl: "https://api.coingecko.com/api/v3/simple/price",
  quotedAt: "2026-09-26T04:32:20.000Z", fetchedAt: "2026-09-26T04:34:38.622Z", stale: false,
};
beforeEach(() => { vi.clearAllMocks(); });
describe("Public ZEC quote", () => {
  it("returns dollars per ZEC with the original quote and retrieval times", async () => {
    mocks.quote.mockResolvedValue(quote);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ asset: "ZEC", currency: "USD", quote: { usd: 1532.71, quotedAt: quote.quotedAt, fetchedAt: quote.fetchedAt, stale: false, source: "CoinGecko" } });
  });
  it("does not redate a cached quote or hide its stale flag", async () => {
    mocks.quote.mockResolvedValue({ ...quote, stale: true });
    expect(await (await GET()).json()).toMatchObject({ quote: { usd: 1532.71, quotedAt: quote.quotedAt, fetchedAt: quote.fetchedAt, stale: true } });
  });
  it("reports a genuine outage without inventing a zero price", async () => {
    mocks.quote.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.quote).toBeNull();
    expect(body.note).toContain("Do not invent");
  });
});
