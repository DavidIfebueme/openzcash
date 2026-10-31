import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { backOf, placeOf } from "@/lib/design-routes";
import { Q4 } from "@/lib/coinholder/q4";
import config from "../../../../next.config";
const reader = vi.hoisted(() => ({ readQ4: vi.fn() }));
vi.mock("@/lib/coinholder/q4-server", () => reader);
vi.mock("@/lib/coinholder/zcg-history-server", () => ({ readZcgHistory: vi.fn().mockResolvedValue({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
import Page from "./page";
import Detail from "./[number]/page";
import { GET } from "@/app/api/coinholders/proposals/route";

describe("Q4 entry and source failure", () => {
  it("keeps the list and details in the Coinholder navigation", () => {
    expect(placeOf(Q4.href)?.app.id).toBe("coinholders");
    expect(Q4.href).toBe("/coinholders/proposals");
    expect(placeOf(Q4.href)?.page?.label).toBe("Proposals");
    expect(backOf(`${Q4.href}/70`)).toEqual({ href: Q4.href, label: "Proposals" });
  });
  it("only redirects known historical rounds, leaving the new Q4 page reachable", async () => {
    const redirects = await config.redirects!();
    expect(redirects).toContainEqual({ source: "/coinholders/q3-2026", destination: "/coinholders/results?round=q3-2026", permanent: true });
    expect(redirects).toContainEqual({ source: "/coinholders/q4-2026", destination: "/coinholders/proposals", permanent: true });
    expect(redirects).toContainEqual({ source: "/coinholders/q4-2026/:number", destination: "/coinholders/proposals/:number", permanent: true });
    expect(redirects.some((r) => r.source === Q4.href || r.source.includes("/coinholders/:round"))).toBe(false);
  });
  it("shows unavailable instead of a zero count and the API returns 503", async () => {
    reader.readQ4.mockResolvedValue({ status: "unavailable", fetchedAt: null, proposals: null });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Proposals are temporarily unavailable");
    expect(html).not.toContain("No proposals yet");
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).totals).toBeNull();
    const detail = renderToStaticMarkup(await Detail({ params: Promise.resolve({ number: "70" }) }));
    expect(detail).toContain("This submission could not be checked");
  });
  it("distinguishes a checked empty list from source failure", async () => {
    reader.readQ4.mockResolvedValue({ status: "current", fetchedAt: "2026-10-30T12:00:00Z", proposals: [] });
    expect(renderToStaticMarkup(await Page())).toContain("No proposals yet");
    expect((await GET()).status).toBe(200);
  });
});
