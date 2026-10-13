import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ProposalWorkspace } from "./proposal-workspace";
import type { OfficialProposalSnapshot } from "@/lib/participate/official-proposals-model";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";
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
});
it("renders the official queue even when there are no archived proposals yet", () => {
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={{...board, proposals: []}} initialOfficialProposals={snapshot} />);
  expect(html).toContain("Konclave"); expect(html).not.toContain("No public proposals yet");
});
