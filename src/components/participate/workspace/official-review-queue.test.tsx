import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProposalWorkspace } from "./proposal-workspace";
import type { OfficialProposalSnapshot } from "@/lib/participate/official-proposals-model";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";
import { buildSourceProposal, buildSourceUpdate } from "@/lib/participate/workspace/archive/source-proposals";
vi.mock("./community-workspace", () => ({ WorkspaceFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./proposal-economy", () => ({ ProposalEconomyProvider: ({ children }: { children: ReactNode }) => <>{children}</>, ProposalEconomyNotice: () => null, ProposalEngagement: ({ recordId }: {recordId: string}) => <button>Comments for {recordId}</button> }));
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: ({recordId}: {recordId: string}) => <span>Preserved {recordId}</span> }));
vi.mock("./submission-lifecycle", () => ({ AbandonmentNotice: () => null, SubmissionLifecycleAction: () => null }));
vi.mock("./proposal-zec-estimate", () => ({ useProposalZecPrice: () => ({ status: "unavailable", price: null }), ProposalZecEstimate: () => null }));
const community = { id: "source-community", name: "ZCG", slug: "zcg" };
const old = ZCG_REVIEW_PROPOSALS.find(row => row.issueNumber === 386)!;
const board = { canParticipate: false, participation: null, proposals: [{ recordId: old.id, title: old.title, commentCount: 3, likes: 5, likedByMe: false, chargedBefore: false }] };
const snapshot: OfficialProposalSnapshot = { version: 1, readAt: "2026-10-13T04:00:00.000Z", proposals: [
  { issueNumber: 486, title: "Konclave", applicant: "@danielgorgonha", url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/486", requestedUsd: 18000, submitted: "2026-10-13", outcome: "under_review" },
  { issueNumber: 386, title: "ZKP course", applicant: "Academy", url: old.proposalUrl, requestedUsd: 5000, submitted: "2026-09-20", outcome: "under_review" },
] };
function render(value: OfficialProposalSnapshot | null, recordId?: string) { return renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={board} initialOfficialProposals={value} initialRecordId={recordId} />); }
it("shows new applications before import without fake interactions or archive proofs", () => {
  const html = render(snapshot);
  expect(html).toContain("Konclave"); expect(html).toContain("$18,000");
  expect(html).toContain("Awaiting source import");
  expect(html).not.toContain("Comments for zcg-github-486");
  expect(html).not.toContain("Preserved zcg-github-486");
  // The pending roster is visible before and after import, without implying a vote.
  expect(html.match(/Committee review awaiting meeting minutes/g)).toHaveLength(2);
  expect(html.match(/class="proposal-pending-member"/g)).toHaveLength(10);
  expect(html).not.toContain('data-vote=');
  expect(html).not.toContain("Read feedback");
  expect(html.match(/aria-label="Turnout unavailable/g)).toHaveLength(2);
  expect(html).not.toContain("0% turnout");
});
it.each([
  [486, "Konclave: taking the viewing key off the coordinator", ["Wallets", "Security"]],
  [483, "CENTIREINGS Zcash Market Segmentation & Comparative Intelligence", ["Research &amp; development"]],
  [481, "ZEC Order Pay: shielded ZEC checkout, refunds and creator payouts for service marketplaces", ["Applications", "Integration"]],
  [480, "Skyhook and ESMASTe: Cross-chain Bridging, Messaging and Execution Layer", ["Integration", "Infrastructure"]],
] as const)("shows OpenZcash categories for new issue %s before any source archive or ZCG label exists", (issueNumber, title, categories) => {
  const fresh = { ...snapshot.proposals[0], issueNumber, title, url: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issueNumber}` };
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    board={{ ...board, proposals: [] }} initialOfficialProposals={{ ...snapshot, proposals: [fresh] }} />);
  expect(html).toContain('aria-label="Proposal sectors"');
  for (const category of categories) expect(html).toContain(`title="OpenZcash sector classification">${category}</li>`);
  expect(html).toContain("Under review");
  expect(html).toContain("Awaiting source import");
  expect(html).not.toContain('aria-label="GitHub labels"');
  expect(html).not.toContain(`Preserved zcg-github-${issueNumber}`);
});
it("uses current shared title, date and amount while retaining the archive and discussion identity", () => {
  const original = JSON.stringify(board);
  const html = render(snapshot);
  expect(html).toContain("ZKP course"); expect(html).toContain("$5,000"); expect(html).toContain("Sep 20, 2026");
  expect(html).not.toContain("$8,120");
  expect(html.match(/Comments for zcg-github-386/g)).toHaveLength(1);
  expect(html).toContain("Preserved zcg-github-386");
  expect(JSON.stringify(board)).toBe(original);
});
it("removes decided archives from the live queue and keeps their deep links in the decision filter", () => {
  const decided: OfficialProposalSnapshot = { ...snapshot, proposals: snapshot.proposals.map(row => row.issueNumber === 386 ? { ...row, outcome: "approved" } : row) };
  expect(render(decided)).not.toContain("Comments for zcg-github-386");
  const html = render(decided, old.id);
  expect(html).toContain('aria-pressed="true">Approved</button>');
  expect(html).toContain("Comments for zcg-github-386");
});
it("retains the original captured board when the shared source is unavailable", () => {
  const html = render(null);
  expect(html).toContain("$8,120"); expect(html).not.toContain("Konclave");
  expect(html).toContain("Committee review awaiting meeting minutes");
});
it("renders the official queue even when there are no archived proposals yet", () => {
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={{...board, proposals: []}} initialOfficialProposals={snapshot} />);
  expect(html).toContain("Konclave"); expect(html).not.toContain("No public proposals yet");
});

it("opens a screened resubmission in Filtered, keeps its source discrepancy visible and preserves its archive", async () => {
  const url = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/489";
  const title = "Grant Application - ZEC Order Pay";
  const checked = await buildSourceProposal({ number: 489, html_url: url, title,
    body: "### Requested Grant Amount (USD)\n\n$36,000", user: { login: "wolkodaww123-ctrl" },
    state: "open", created_at: "2026-10-13T13:49:21Z", updated_at: "2026-10-13T13:57:24Z",
    labels: [{ name: "📋 Grant Application", color: "bdb853", description: null }, { name: "👀 Ready For ZCG Review", color: "115858", description: null }],
  }, 489, "2026-10-14T12:00:00.000Z");
  const original = JSON.stringify(checked.capture);
  const screened = { ...snapshot, proposals: [{ ...snapshot.proposals[0], issueNumber: 489, title, url,
    outcome: "filtered" as const, requestedUsd: 36000,
    statusDetail: "Filtered by FPF / Outside of Scope / Guidelines Not Met",
    statusSourceUrl: "https://docs.google.com/spreadsheets/d/official-ledger/edit#gid=1164534734&range=A729",
  }] };
  const props = { community, communities: [community], viewer: null, initialOfficialProposals: screened,
    board: { ...board, proposals: [{ ...board.proposals[0], recordId: checked.manifest.recordId, title, sourceCapture: checked.capture }] } };
  const html = renderToStaticMarkup(<ProposalWorkspace {...props} initialRecordId="zcg-github-489" />);
  expect(html).toContain('aria-pressed="true">Filtered</button>');
  expect(html).toContain('dao-status--filtered">Filtered</span>');
  expect(html).not.toContain('dao-status--rejected');
  expect(html).toContain(screened.proposals[0].statusDetail);
  expect(html).toContain("GitHub shows Under review at the last source check.");
  expect(html).toContain("range=A729");
  expect(html).toContain("$36,000");
  expect(html).not.toContain("Committee review awaiting meeting minutes");
  expect(html).toContain("Comments for zcg-github-489");
  expect(html).toContain("Preserved zcg-github-489");
  expect(JSON.stringify(checked.capture)).toBe(original);
  expect(renderToStaticMarkup(<ProposalWorkspace {...props} />)).not.toContain("Comments for zcg-github-489");
});

it("adds the published vote card to the existing 0xramp archive without duplicating its discussion or rewriting its capture", async () => {
  const url = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454";
  const title = "0xramp: ZEC payments and wallet integrations (revision of #408)";
  const checked = await buildSourceProposal({ number: 454, html_url: url, title,
    body: "### Requested Grant Amount (USD)\n\n$45,000", user: { login: "vinibarbosabr" }, state: "open",
    created_at: "2026-09-29T12:00:00Z", updated_at: "2026-10-12T12:00:00Z",
    labels: [{ name: "📋 Grant Application", color: "bdb853", description: null }, { name: "👀 Ready For ZCG Review", color: "115858", description: null }],
  }, 454, "2026-10-14T14:00:00.000Z");
  const original = JSON.stringify(checked.capture);
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    board={{ ...board, proposals: [{ ...board.proposals[0], recordId: checked.manifest.recordId, title, sourceCapture: checked.capture }] }}
    initialOfficialProposals={{ ...snapshot, proposals: [{ ...snapshot.proposals[0], issueNumber: 454, url, title, outcome: "approved" }] }}
    initialRecordId="zcg-github-454" />);
  expect(html).toContain('aria-label="Published committee verdict"');
  expect(html).toContain("Hanh: Approve via unanimous record");
  expect(html).toContain("Paul Brigner: Approve via unanimous record");
  expect(html).not.toContain("Committee review awaiting meeting minutes");
  expect(html.match(/Comments for zcg-github-454/g)).toHaveLength(1);
  expect(html).toContain("Preserved zcg-github-454");
  expect(html).toContain('class="proposal-card-header"');
  expect(html).toContain('dateTime="2026-09-29T12:00:00Z">Submitted Sep 29, 2026');
  expect(html).toContain('dateTime="2026-10-12">Decision Oct 12, 2026');
  expect(html).toContain('dateTime="2026-10-14T14:00:00.000Z">Source checked Oct 14, 2026 · 14:00 UTC');
  expect(html.match(/Decision Oct 12, 2026/g)).toHaveLength(1);
  expect(JSON.stringify(checked.capture)).toBe(original);
});

it("shows a documented decision before archive import without offering nonexistent comments or proof", () => {
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    board={{ ...board, proposals: [] }} initialRecordId="zcg-github-447"
    initialOfficialProposals={{ ...snapshot, proposals: [{ ...snapshot.proposals[0], issueNumber: 447,
      url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/447", title: "Mexico", applicant: "Zcash México", submitted: "2026-09-26", outcome: "approved" }] }} />);
  expect(html).toContain("Mexico Tech Week");
  expect(html).toContain('aria-label="Published committee verdict"');
  expect(html).toContain("Meeting minutes ↗");
  expect(html).toContain('class="proposal-card-header"');
  expect(html).toContain('dateTime="2026-09-26">Submitted Sep 26, 2026');
  expect(html).toContain("Zcash México");
  expect(html).toContain('dateTime="2026-10-02">Decision Oct 2, 2026 (async)');
  expect(html).toContain('dateTime="2026-10-12">Minutes Oct 12, 2026');
  expect(html).not.toContain("Source checked");
  expect(html).toContain("100% turnout: 5 of 5 member responses recorded");
  expect(html).not.toContain("Committee support:");
  expect(html).not.toContain("Comments for zcg-github-447");
  expect(html).not.toContain("Preserved zcg-github-447");
  expect(html).not.toContain("proposal-read-zcg-github-447");
});

const issueUrl = (issue: number) => `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issue}`;
function cardHtml(html: string, recordId: string) {
  const start = html.indexOf(`data-proposal-card="${recordId}"`);
  const next = html.indexOf('data-proposal-card="', start + 1);
  return start < 0 ? "" : html.slice(start, next < 0 ? undefined : next);
}
// GraphSense kept its curated record id when the October 16 GitHub update was captured as revision 2.
function recaptureGraphSense(label: { name: string; color: string }) {
  return buildSourceUpdate({ number: 424, html_url: issueUrl(424), title: "Grant Application - GraphSense Zcash Shielded Accounting Repair",
    body: "### Requested Grant Amount (USD)\n\n$8,000", user: { login: "steven3002" }, state: "closed", state_reason: "completed",
    created_at: "2026-09-14T14:23:35Z", updated_at: "2026-10-16T19:59:34Z", labels: [{ ...label, description: null }],
  }, 424, "2026-10-16T20:33:00.000Z", { recordId: "zcg-graphsense-2026-09-28", revision: 1, manifestHash: "a".repeat(64) }, { events: [], comments: [] });
}

it("keeps the curated vote of a recaptured record and lists every decided card by decision date", async () => {
  const update = await recaptureGraphSense({ name: "✔️ Grant Complete", color: "72243a" });
  const original = JSON.stringify(update.capture);
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    initialRecordId="zcg-graphsense-2026-09-28"
    board={{ ...board, proposals: [
      { ...board.proposals[0], recordId: "zcg-graphsense-2026-09-28", title: update.capture.proposal.title, sourceCapture: update.capture },
      { ...board.proposals[0], recordId: "zcg-ironwood-2026-09-28", title: "Ironwood" },
    ] }}
    initialOfficialProposals={{ ...snapshot, proposals: [
      { ...snapshot.proposals[0], issueNumber: 424, url: issueUrl(424), title: "GraphSense", applicant: "@steven3002", submitted: "2026-09-14", outcome: "approved" },
      { ...snapshot.proposals[0], issueNumber: 454, url: issueUrl(454), title: "0xramp", applicant: "@vinibarbosabr", submitted: "2026-09-29", outcome: "approved" },
    ] }} />);
  const graphsense = cardHtml(html, "zcg-graphsense-2026-09-28");
  expect(graphsense).toContain('dateTime="2026-09-28">Decision Sep 28, 2026');
  expect(graphsense).toContain('aria-label="Published committee verdict"');
  expect(graphsense).toContain("4 approve · 1 reject");
  expect(graphsense).toContain("zcash-community-grants-zcg-meeting-minutes-9-28-2026/57928/1");
  expect(graphsense).toContain("Source checked Oct 16, 2026 · 20:33 UTC");
  // Imported, pre-import and curated cards share one list ordered by decision date.
  const order = ["zcg-github-454", "zcg-graphsense-2026-09-28", "zcg-ironwood-2026-09-28"].map(id => html.indexOf(`data-proposal-card="${id}"`));
  expect(order.every(index => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(html.match(/class="dao-proposal-list/g)).toHaveLength(1);
  expect(JSON.stringify(update.capture)).toBe(original);
});

it.each([
  ["without the official list", null, "Withdrawn"],
  ["while the official list still shows it approved", "approved", "Approved"],
] as const)("drops a curated vote once the recaptured GitHub outcome no longer matches it (%s)", async (_case, listed, tab) => {
  const update = await recaptureGraphSense({ name: "❌ Grant Cancelled Before Completion", color: "b60205" });
  const official = listed ? { ...snapshot, proposals: [{ ...snapshot.proposals[0], issueNumber: 424, url: issueUrl(424), title: "GraphSense", applicant: "@steven3002", submitted: "2026-09-14", outcome: listed }] } : null;
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    initialRecordId="zcg-graphsense-2026-09-28" initialOfficialProposals={official}
    board={{ ...board, proposals: [{ ...board.proposals[0], recordId: "zcg-graphsense-2026-09-28", title: update.capture.proposal.title, sourceCapture: update.capture }] }} />);
  const graphsense = cardHtml(html, "zcg-graphsense-2026-09-28");
  expect(html).toContain(`aria-pressed="true">${tab}</button>`);
  expect(graphsense).toContain("GraphSense Zcash Shielded Accounting Repair");
  expect(graphsense).not.toContain("Published committee verdict");
  expect(graphsense).not.toContain("Decision Sep 28, 2026");
});
