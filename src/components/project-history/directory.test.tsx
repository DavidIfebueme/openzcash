import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryIndexItem } from "@/lib/project-history/insights";
import { HistoryDirectory } from "./directory";

const query = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query.value) }));
const entry = (id: string, paidEntries: number | null, acceptanceGaps: number | null): HistoryIndexItem => ({
  id, name: id, description: "A project with linked source records.", category: "Infrastructure", website: "https://example.org", communityId: null,
  insights: { grants: 1, paidEntries, acceptanceGaps, acceptedEntries: 0, publishedArtifacts: 2, integrations: 0, usageObservations: 0, reportSources: 0, publicWorkSources: 2 },
  latestEvent: { title: "A dated release", date: "2026-09-20", kind: "release" },
});
const render = (items: HistoryIndexItem[], paymentsAvailable = true) => renderToStaticMarkup(<HistoryDirectory items={items} brands={{}} paymentsAvailable={paymentsAvailable} />);
beforeEach(() => { query.value = ""; });

describe("project history evidence views", () => {
  it("distinguishes unavailable paid entries from a known zero", () => {
    const html = render([entry("known", 0, 0), entry("unavailable", null, null)]);
    expect(html).toMatch(/Paid entries<\/dt><dd>0<\/dd>/);
    expect(html).toMatch(/Paid entries<\/dt><dd>—<\/dd>/);
    expect(html).toContain('href="/ecosystem/history/known"');
    expect(html).toContain("Latest release");
  });
  it("does not present zero acceptance gaps when the payment reader is unavailable", () => {
    query.value = "view=acceptance";
    const html = render([entry("retained", null, null)], false);
    expect(html).toMatch(/disabled=""[\s\S]*?Acceptance to link[\s\S]*?<strong>—<\/strong>/);
    expect(html).toContain("Payment source unavailable");
    expect(html).toContain('href="/ecosystem/history/retained"');
    expect(html).not.toContain("No matching histories");
  });
  it("combines query, category and evidence filters without treating releases as acceptance", () => {
    query.value = "view=acceptance&q=alpha&category=Infrastructure";
    const html = render([entry("alpha-funded", 3, 3), entry("alpha-release", 0, 0), entry("beta", 2, 2)]);
    expect(html).toContain('href="/ecosystem/history/alpha-funded"');
    expect(html).not.toContain('href="/ecosystem/history/alpha-release"');
    expect(html).not.toContain('href="/ecosystem/history/beta"');
    expect(html).toContain("not a finding of non-delivery");
  });
});
