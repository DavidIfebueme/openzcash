import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProjectHistory } from "@/lib/project-history/build";
import type { FinanceRecords, HistoryIdentity, ProjectHistory } from "@/lib/project-history/types";
import { HistoryOverview } from "./overview";
import { SourceDirectory } from "./source-directory";
import { RequestedAmount } from "./requested-amount";

const source = { label: "Public source", url: "https://example.org/record", observedAt: "2026-10-04" };
const identity: HistoryIdentity = { id: "alpha", name: "Alpha", description: "Fixture", category: "Wallets", website: "https://example.org", project: null, communityId: null, recipientKeys: ["alpha"], applicationTopics: [], reportTopics: [], repositories: [], checkedAt: "2026-10-04" };
const finance: FinanceRecords = { proposals: [], payments: [], proposalsAvailable: true, paymentsAvailable: true, importedAt: "2026-10-01" };
const record = (data: Partial<FinanceRecords> = {}) => buildProjectHistory(identity, [identity], { ...finance, ...data }, "2026-10-04");
const render = (history: ProjectHistory) => renderToStaticMarkup(<HistoryOverview history={history} select={() => {}} />);

describe("evaluation brief evidence boundaries", () => {
  it("keeps a prerelease distinct from acceptance and measured use", () => {
    const history = record();
    history.timeline.unshift({ id: "release-preview", kind: "release", title: "Alpha 2.0-rc1", detail: "Maintainer preview", date: "2026-10-03", releaseChannel: "prerelease", evidence: "published_artifact", source, grantId: null });
    const html = render(history);
    expect(html).toContain("Alpha 2.0-rc1");
    expect(html).toContain("Prerelease");
    expect(html).toContain("Not assessed");
    expect(html).not.toContain("entry supported");
    expect(html).not.toContain("release records");
  });
  it("keeps shared-award context beside historical USD amounts without summing projects", () => {
    const history = record({ payments: [{ id: "row-1", project: "Shared grant", program: "zcg", recipientKey: "alpha", milestone: "1", deliverable: null, isPaid: true, paidDate: "2026-09-28", budgetUsdCents: "250000", recordedZecZat: "200000000", source }] });
    history.grants[0].sharedWith = [{ id: "beta", name: "Beta" }];
    const html = render(history);
    expect(html).toContain("$2,500.00");
    expect(html).toContain("Paid entries · USD budget");
    expect(html).toContain("Shared award · not a project-specific allocation");
    expect(html).not.toContain("Total funding");
  });
  it("does not replace missing payment coverage or undated reports with zeroes or dates", () => {
    const history = record({ paymentsAvailable: false });
    history.timeline.push({ id: "report", kind: "report", title: "Community update", detail: "A linked report", date: null, evidence: "team_reported", source, grantId: null });
    const html = render(history);
    expect(html).toContain("Reports available to review");
    expect(html).toContain("publication dates not linked");
    expect(html).toContain("Payments unavailable");
    expect(html).not.toContain("0 paid entries");
    expect(html).not.toContain("<time");
  });
});


describe("visible source coverage", () => {
  it("exposes existing references without inventing a dated publication", () => {
    const history = record();
    const html = render(history);
    expect(html).toContain("Project sources available");
    expect(html).toContain('href="https://example.org/"');
    expect(html).toContain('href="#history-sources"');
    expect(html).not.toContain("This record has no dated work source yet.");
    expect(html).not.toContain("<time");
    const directory = renderToStaticMarkup(<SourceDirectory history={history} />);
    expect(directory).toContain("Project sources");
    expect(directory).toContain("1 linked source");
    expect(directory).toContain('href="https://example.org/"');
  });
  it("keeps all original links accessible beyond the compact source list", () => {
    const history = record();
    history.sources = Array.from({ length: 12 }, (_, index) => ({ ...source, label: `Report ${index}`, url: `https://example.org/report/${index}`, kind: "report" as const }));
    const html = renderToStaticMarkup(<SourceDirectory history={history} />);
    expect(html).toContain("Show 4 more sources");
    for (const item of history.sources) expect(html).toContain(`href="${item.url}"`);
  });
  it("labels caps with a separate primary source and keeps unknown requests unquantified", () => {
    const history = record({ payments: [{ id: "row-1", project: "Shared grant", program: "zcg", recipientKey: "alpha", milestone: "1", deliverable: null, isPaid: true, paidDate: "2026-09-28", budgetUsdCents: "250000", recordedZecZat: "200000000", source }] });
    const grant = history.grants[0];
    grant.statusBasis = "published_proposal";
    let html = renderToStaticMarkup(<dl><RequestedAmount grant={grant} /></dl>);
    expect(html).toContain("Not in ledger");
    expect(html).not.toContain("$0.00");
    grant.requestedUsdCents = "16800000";
    grant.requestedAmountReview = { basis: "cap", summary: "Annual ceiling, not guaranteed spending.", source };
    html = renderToStaticMarkup(<dl><RequestedAmount grant={grant} /></dl>);
    expect(html).toContain("Requested cap · USD");
    expect(html).toContain("$168,000.00");
    expect(html).toContain("Annual ceiling, not guaranteed spending.");
    expect(html).toContain('href="https://example.org/record"');
  });
});
