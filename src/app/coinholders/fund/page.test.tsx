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
    expect(html).not.toContain("ZEC a block since");
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

  it("quotes the 25-second rate and the moved halving once the tip is past NU7", async () => {
    sources.balance.mockResolvedValue({ zat: 14737287000000n, height: 3569378, snap: { capturedAt: "2026-11-12T15:22:00Z" } });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("plus 0.06249999 ZEC a block since");
    expect(html).toContain("0.06249999 ZEC every block");
    expect(html).toContain("6,132,390");
    expect(html).not.toContain("0.1875");
    expect(html).not.toContain("4,406,400");
  });
});
