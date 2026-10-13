import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSourceUpdate } from "@/lib/participate/workspace/archive/source-proposals";
import type { ApprovedBudgetSnapshot } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { ZCG_PROPOSAL_EXAMPLES } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ProposalWorkspace } from "./proposal-workspace";
import { ProposalZecEstimate, type PriceState } from "./proposal-zec-estimate";
import { ZcgProposalExamples } from "./zcg-proposal-examples";

const fixtures = vi.hoisted(() => ({
  openEstimate: false,
  price: { status: "ready", price: {
    rateUsdPerZecE8: "30000000000", quotedAt: "2026-10-12T12:00:00.000Z",
    retrievedAt: "2026-10-12T12:00:00.000Z", expiresAt: "2026-10-12T12:05:00.000Z",
  } },
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(fixtures.openEstimate && initial === false ? true : initial) };
});
vi.mock("./community-workspace", () => ({ WorkspaceFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./proposal-economy", () => ({ ProposalEconomyProvider: ({ children }: { children: ReactNode }) => <>{children}</>, ProposalEconomyNotice: () => null, ProposalEngagement: () => <button>Comments</button> }));
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: () => null }));
vi.mock("./submission-lifecycle", () => ({ AbandonmentNotice: () => null, SubmissionLifecycleAction: () => null }));
vi.mock("./proposal-zec-estimate", async importOriginal => ({
  ...await importOriginal<typeof import("./proposal-zec-estimate")>(),
  useProposalZecPrice: () => fixtures.price,
}));

const community = { id: "source-community", name: "ZCG", slug: "zcg" };
const sourceUrl = "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=803214474&range=A889:L893";
const snapshot: ApprovedBudgetSnapshot = { version: 1, importedAt: "2026-10-12T12:00:00.000Z", budgets: {
  "454": { usdCents: "4500000", sourceUrl,
    proposalSourceUrl: "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=1164534734&range=A708",
    sourceRows: [889, 890, 891, 892, 893],
  },
} };

async function renderApproved(initialBudgets: ApprovedBudgetSnapshot | null) {
  const issue = { number: 454, html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454",
    title: "An approved source proposal", body: "# Requested budget\n\n$99,999 requested in the application.",
    user: { login: "applicant" }, state: "closed", created_at: "2026-10-08T10:00:00.000Z", updated_at: "2026-10-12T11:00:00.000Z",
    labels: [{ name: "✅ Grant Approved", color: "087f23", description: null }],
  };
  const update = await buildSourceUpdate(issue, issue.number, snapshot.importedAt, null, { events: [], comments: [] });
  return renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    initialRecordId={update.manifest.recordId} initialBudgets={initialBudgets}
    board={{ canParticipate: false, participation: null, proposals: [{
      recordId: update.manifest.recordId, title: issue.title, sourceCapture: update.capture, sourceRequestedUsd: 99999,
      commentCount: 0, likes: 0, likedByMe: false, chargedBefore: false,
    }] }} />);
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(snapshot.importedAt)); });
afterEach(() => { fixtures.openEstimate = false; vi.useRealTimers(); });

describe("official approved budgets on the Participate board", () => {
  it("renders issue 454 from the initial ledger snapshot and computes its ZEC estimate", async () => {
    const html = await renderApproved(snapshot);
    expect(html).toContain('aria-label="Approved budget: $45,000.00 USD"');
    expect(html).toContain("$45,000</strong>");
    expect(html).toContain("≈ 150.00 ZEC");
    expect(html).not.toContain("$99,999");
    expect(html).not.toContain("Approved budget pending");
    expect(html).not.toContain("Ledger synced");
  });

  it("keeps an approved record pending when the current ledger has no amount", async () => {
    const html = await renderApproved({ ...snapshot, budgets: {} });
    expect(html).toContain("Approved budget pending in ledger");
    expect(html).not.toContain("$99,999");
    expect(html).not.toContain('aria-label="Approved budget:');
    expect(html).not.toContain(" ZEC</strong>");
  });

  it("distinguishes an initial pending request from a successfully loaded ledger without a match", async () => {
    const html = await renderApproved(null);
    expect(html).toContain("Loading approved budget…");
    expect(html).not.toContain("Approved budget pending in ledger");
    expect(html).not.toContain("$99,999");
  });

  it("points the expanded estimate to the exact official funding rows and explains total-grant math", () => {
    fixtures.openEstimate = true;
    const html = renderToStaticMarkup(<ProposalZecEstimate budget={snapshot.budgets["454"]} state={fixtures.price as PriceState} />);
    expect(html).toContain('aria-label="ZEC estimate details"');
    expect(html).toContain(`href="${sourceUrl.replace("&", "&amp;")}"`);
    expect(html).toContain("Official approved budget ↗");
    expect(html).toContain("5 funding entries");
    expect(html).toContain("$45,000.00 USD");
    expect(html).toContain("300.00 USD");
    expect(html).toContain("≈ 150.00 ZEC");
    expect(html).toContain("Prior payments aren’t deducted");
    expect(html).toContain("Each payment uses its payment-day rate");
  });

  it("carries the snapshot sync date through the live proposal card into its popover", async () => {
    fixtures.openEstimate = true;
    const html = await renderApproved(snapshot);
    expect(html).toContain(`Ledger synced <time dateTime="${snapshot.importedAt}">Oct 12, 2026, 12:00 UTC</time>`);
    expect(html).not.toContain("Sync delayed");
  });

  it("also shows the ledger sync date on historical proposal cards", () => {
    fixtures.openEstimate = true;
    const recordId = "zcg-graphsense-2026-09-28";
    const html = renderToStaticMarkup(<ZcgProposalExamples proposals={ZCG_PROPOSAL_EXAMPLES}
      filterTarget={{ recordId, fallback: "approved" }} approvedBudgets={{ "424": snapshot.budgets["454"] }}
      budgetStatus="ready" price={fixtures.price as PriceState} ledgerImportedAt={snapshot.importedAt} />);
    expect(html).toContain("GraphSense");
    expect(html).toContain(`Ledger synced <time dateTime="${snapshot.importedAt}">`);
    expect(html).not.toContain("Sync delayed");
  });

  it.each([
    ["2026-10-12T00:00:00.000Z", false],
    ["2026-10-11T23:59:59.999Z", true],
  ])("flags a delayed ledger import only after twelve hours (%s)", (ledgerImportedAt, delayed) => {
    fixtures.openEstimate = true;
    const html = renderToStaticMarkup(<ProposalZecEstimate budget={snapshot.budgets["454"]}
      state={fixtures.price as PriceState} ledgerImportedAt={ledgerImportedAt} />);
    expect(html).toContain(`dateTime="${ledgerImportedAt}"`);
    expect(html.includes("Sync delayed")).toBe(delayed);
    // A delayed ledger import is separate from quote freshness and does not erase the amount.
    expect(html).toContain("$45,000.00 USD");
    expect(html).toContain("≈ 150.00 ZEC");
  });
});
