import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { backOf, placeOf } from "@/lib/design-routes";
import { Q4 } from "@/lib/coinholder/q4";
import config from "../../../../next.config";
const reader = vi.hoisted(() => ({ readQ4: vi.fn() }));
vi.mock("@/lib/coinholder/q4-server", () => reader);
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
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
  it("offers the form only while submissions are open, then says they are closed", async () => {
    reader.readQ4.mockResolvedValue({ status: "current", fetchedAt: "2026-10-30T12:00:00Z", proposals: [] });
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(Q4.submissionsOpen));
    const open = renderToStaticMarkup(await Page());
    expect(open).toContain("Submit proposal");
    expect(open).toContain("Submissions are open for the next coinholder vote.");
    clock.mockReturnValue(Date.parse(Q4.submissionsClose) + 1);
    const closed = renderToStaticMarkup(await Page());
    expect(closed).not.toContain("Submit proposal");
    expect(closed).toContain("Submissions are closed. Community review opens Nov 16.");
    expect(closed).toContain('data-pose="stand"');
    clock.mockRestore();
  });
  it("distinguishes a checked empty list from source failure", async () => {
    reader.readQ4.mockResolvedValue({ status: "current", fetchedAt: "2026-10-30T12:00:00Z", proposals: [] });
    expect(renderToStaticMarkup(await Page())).toContain("No proposals yet");
    expect((await GET()).status).toBe(200);
  });
  it("adds FPF's forum administration request to the count and total, listed apart from GitHub applications", async () => {
    const proposal = { number: 70, title: "Maya integration", url: "https://github.com/example/70", applicant: "example", organization: null, category: null, summary: null, requestedUsdCents: 5_000_000, createdAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-01T12:00:00Z", body: "" };
    reader.readQ4.mockResolvedValue({ status: "current", fetchedAt: "2026-11-17T12:00:00Z", proposals: [proposal, { ...proposal, number: 71, requestedUsdCents: 1_000_000 }] });
    const html = renderToStaticMarkup(await Page());
    expect(html).toMatch(/<dt>Proposals<\/dt><dd>3<\/dd>/);
    expect(html).toContain("$118,000");
    expect(html).toContain("Program administration");
    expect(html).toContain("Not a retroactive grant");
    expect(html).toContain("2027 Renewal");
    expect(html).toContain("$58,000");
    expect(html).toContain("forum.zcashcommunity.com/t/proposal-funding-fpf-s-administrative-operational-role-for-the-coinholder-directed-retroactive-grants-program-2027-renewal/59063");
    const body = await (await GET()).json();
    expect(body.proposals).toHaveLength(2);
    expect(body.totals.requestedUsdCents).toBe(6_000_000);
    expect(body.administration).toEqual([expect.objectContaining({ id: "fpf-admin-2027", requestedUsdCents: 5_800_000, applicant: "Financial Privacy Foundation (FPF)" })]);
  });
});
