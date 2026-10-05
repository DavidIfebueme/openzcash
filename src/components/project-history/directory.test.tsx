import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryIndexItem } from "@/lib/project-history/insights";
import { HistoryDirectory } from "./directory";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import { historyIdentities } from "@/lib/project-history/identities";
import { countWorkAreas, workAreaHref } from "@/lib/ecosystem/work-areas";
import type { Catalog } from "@/lib/ecosystem/types";
import { COMMUNITIES } from "@/lib/communities/data";

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
    expect(html).toMatch(/Paid entries<\/dt><dd[^>]*>0<\/dd>/);
    expect(html).toMatch(/Paid entries<\/dt><dd[^>]*>Unavailable<\/dd>/);
    expect(html).toContain('href="/ecosystem/history/known"');
    expect(html).toContain("Release");
    expect(html).toContain("Source unavailable");
    expect(html).toContain("Not linked");
  });
  it("keeps payment activity distinct from acceptance and published work", () => {
    const payment = entry("recent-payment", 3, 3);
    payment.latestEvent = { title: "Milestone payment", date: "2026-10-01", kind: "payment" };
    const html = render([payment]);
    expect(html).toContain(">Payment</small>");
    expect(html).toContain("Not linked");
    expect(html).toContain("3 paid entries to review");
    expect(html).not.toContain("Work sources</dt>");
    payment.insights.acceptedEntries = 1;
    expect(render([payment])).toContain("1 entry linked");
  });
  it("does not present zero acceptance gaps when the payment reader is unavailable", () => {
    query.value = "view=acceptance";
    const html = render([entry("retained", null, null)], false);
    expect(html).toMatch(/<option[^>]*disabled=""[^>]*>Acceptance · source unavailable<\/option>/);
    expect(html).toContain("Acceptance · source unavailable");
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


describe("directory discovery order", () => {
  it("opens with ecosystem areas, not the most recently paid community", () => {
    const arabia = { ...entry("Arabia", 1, 0), category: "Community", communityId: "zcash-arabia", latestEvent: { title: "Recent payment", date: "2026-10-01", kind: "payment" as const } };
    const zebra = { ...entry("Zebra", 0, 0), category: "Nodes" };
    const zakura = { ...entry("Zakura", 0, 0), category: "Nodes" };
    const html = render([arabia, zebra, zakura]);
    expect(html.indexOf('href="/ecosystem/history/Zakura"')).toBeLessThan(html.indexOf('href="/ecosystem/history/Zebra"'));
    expect(html.indexOf('href="/ecosystem/history/Zebra"')).toBeLessThan(html.indexOf('href="/ecosystem/history/Arabia"'));
    expect(html).toContain('aria-label="Nodes"');
    query.value = "sort=recent";
    const recent = render([arabia, zebra]);
    expect(recent.indexOf('href="/ecosystem/history/Arabia"')).toBeLessThan(recent.indexOf('href="/ecosystem/history/Zebra"'));
  });
  it("uses the community identity rather than the category to separate scopes", () => {
    const zechub = { ...entry("ZecHub", 1, 0), category: "Education", communityId: "zechub" };
    const free2z = { ...entry("Free2Z", 0, 0), category: "Community" };
    query.value = "scope=communities";
    expect(render([zechub, free2z])).toContain('href="/ecosystem/history/ZecHub"');
    expect(render([zechub, free2z])).not.toContain('href="/ecosystem/history/Free2Z"');
    query.value = "scope=projects";
    expect(render([zechub, free2z])).toContain('href="/ecosystem/history/Free2Z"');
    expect(render([zechub, free2z])).not.toContain('href="/ecosystem/history/ZecHub"');
  });
  it("normalizes an unavailable area when a shared URL switches scope", () => {
    query.value = "scope=communities&category=Nodes";
    const community = { ...entry("Community", 1, 0), communityId: "example", category: "Community" };
    const html = render([community]);
    expect(html).toContain('href="/ecosystem/history/Community"');
    expect(html).not.toContain("No matching histories");
    expect(html).toContain('<option value="" selected="">All areas</option>');
  });
  it("includes community reports in the public work filter without relabeling them as releases", () => {
    const report = entry("Report", 1, 0);
    report.insights.publishedArtifacts = 0;
    report.insights.publicWorkSources = 1;
    const none = entry("No-work", 0, 0);
    none.insights.publishedArtifacts = 0;
    none.insights.publicWorkSources = 0;
    query.value = "view=public-work";
    expect(render([report, none])).toContain('href="/ecosystem/history/Report"');
    expect(render([report, none])).not.toContain('href="/ecosystem/history/No-work"');
    query.value = "view=work";
    expect(render([report])).toContain("No matching histories");
  });
});


describe("shared overview and history work areas", () => {
  const education = { ...entry("education-app", 0, 0), category: "Education" };
  const community = { ...entry("local-community", 1, 0), category: "Community", communityId: "local" };
  const governance = { ...entry("governance-tool", 0, 0), category: "Governance" };
  const items = [education, community, governance];
  const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
  const allItems = identities.map(identity => ({ ...entry(identity.id, 0, 0), name: identity.name, category: identity.category, communityId: identity.communityId }));

  it("uses one Community & education group while retaining each raw category", () => {
    query.value = "area=Community+%26+education";
    const html = render(items);
    expect(html).toContain('href="/ecosystem/history/education-app"');
    expect(html).toContain('href="/ecosystem/history/local-community"');
    expect(html).not.toContain('href="/ecosystem/history/governance-tool"');
    expect(html).toContain('aria-label="Community &amp; education"');
    expect(html).toContain(">Education</span>");
    expect(html).toContain(">Community</span>");
    expect(html).toContain('<p aria-live="polite"><strong>2</strong> histories');
  });
  it("preserves exact legacy category filters, including education without community records", () => {
    query.value = "category=Education";
    const html = render(items);
    expect(html).toContain('href="/ecosystem/history/education-app"');
    expect(html).not.toContain('href="/ecosystem/history/local-community"');
    expect(html).toContain('<option value="Education" selected="">Education only</option>');
    query.value = "category=Community";
    const legacy = render(items);
    expect(legacy).toContain('href="/ecosystem/history/local-community"');
    expect(legacy).not.toContain('href="/ecosystem/history/education-app"');
  });
  it("intersects the area with community scope without treating education apps as groups", () => {
    query.value = "area=Community+%26+education&scope=communities";
    const html = render(allItems);
    expect(html).toContain(`<p aria-live="polite"><strong>${COMMUNITIES.length}</strong> communities`);
    expect(html).not.toContain('href="/ecosystem/history/eduzec"');
    // Every community, including the education-category ZecHub overlap, stays discoverable.
    for (const community of COMMUNITIES) {
      const identity = identities.find(item => item.communityId === community.id)!;
      query.value = new URLSearchParams({ area: "Community & education", scope: "communities", q: identity.id }).toString();
      expect(render(allItems)).toContain(`href="/ecosystem/history/${identity.id}"`);
    }
  });
  it("shows exactly each overview area count after following its shared link", () => {
    for (const area of countWorkAreas(identities)) {
      query.value = new URL(workAreaHref(area.area), "https://openzcash.org").search.slice(1);
      expect(render(allItems)).toContain(`<p aria-live="polite"><strong>${area.count}</strong> ${area.count === 1 ? "history" : "histories"}`);
    }
    query.value = "";
    expect(render(allItems)).toContain(`<p aria-live="polite"><strong>${identities.length}</strong> histories`);
  });
  it("normalizes unavailable areas when scope changes and applies a valid area over a stale category", () => {
    query.value = "scope=communities&area=Nodes";
    expect(render(items)).toContain('href="/ecosystem/history/local-community"');
    query.value = "area=Community+%26+education&category=Governance";
    const html = render(items);
    expect(html).toContain('href="/ecosystem/history/education-app"');
    expect(html).not.toContain('href="/ecosystem/history/governance-tool"');
  });
});
