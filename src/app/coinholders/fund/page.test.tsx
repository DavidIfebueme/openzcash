import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sources = vi.hoisted(() => ({ balance: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/zcash/lockbox-live", () => ({ currentLockboxZec: sources.balance }));
vi.mock("@/lib/pricing/live-price", () => ({ currentZecUsdQuote: sources.quote }));
import Page from "./page";

beforeEach(() => { sources.balance.mockReset(); sources.quote.mockReset().mockResolvedValue(null); });

describe("fund source availability", () => {
  it("keeps the pending round and published payouts available when the balance lookup fails", async () => {
    sources.balance.mockRejectedValue(new Error("Balance source unavailable"));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Balance unavailable");
    expect(html).toContain('aria-label="Q4 2026 schedule"');
    expect(html).toContain("7,887.125");
    expect(html).toContain("Current requests are not approved commitments");
    expect(html).not.toContain("plus 0.1875 ZEC a block since");
  });

  it("still renders a real balance and its provenance without treating current requests as commitments", async () => {
    sources.balance.mockResolvedValue({ zat: 1234500000000n, height: 3500000, snap: { capturedAt: "2026-10-30T12:00:00Z" } });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("12,345");
    expect(html).toContain("3,500,000");
    expect(html).toContain("plus 0.1875 ZEC a block since");
    expect(html).not.toContain("Balance unavailable");
    expect(html).not.toContain("Approved in Q4 2026");
  });
});
