import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { buildSourceProposal, buildSourceUpdate, verifySourceProposal } from "@/lib/participate/workspace/archive/source-proposals";
import { ProposalWorkspace } from "./proposal-workspace";

vi.mock("./community-workspace", () => ({ WorkspaceFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./proposal-economy", () => ({ ProposalEconomyProvider: ({ children }: { children: ReactNode }) => <>{children}</>, ProposalEconomyNotice: () => null, ProposalEngagement: () => <button>Comments</button> }));
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: () => null }));
vi.mock("./submission-lifecycle", () => ({ AbandonmentNotice: () => null, SubmissionLifecycleAction: () => null }));
vi.mock("./proposal-zec-estimate", () => ({ useProposalZecPrice: () => ({ status: "unavailable", price: null }), ProposalZecEstimate: () => null }));

const community = { id: "source-community", name: "ZCG", slug: "zcg" };
const issue = { number: 99901, html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/99901", title: "A preserved source application",
  body: "# Exact application\n\nPublic proposal body.", user: { login: "applicant" }, state: "open", created_at: "2026-10-08T10:00:00.000Z", updated_at: "2026-10-12T11:00:00.000Z",
  labels: [{ name: "📋 Grant Application", color: "bfbf4d", description: null }, { name: "👀 Ready For ZCG Review", color: "105556", description: null }] };
const capturedAt = "2026-10-12T12:00:00.000Z";

it.each([["✅ Grant Approved", "Approved"], ["❌ Grant Declined", "Rejected"], ["Grant Withdrawn by Submitter", "Abandoned"]])("renders the preserved %s outcome in its notification destination filter", async (label, filter) => {
  const update = await buildSourceUpdate({ ...issue, state: "closed", labels: [...issue.labels, { name: label, color: "087f23", description: null }] }, issue.number, capturedAt,
    { recordId: `zcg-github-${issue.number}`, revision: 1, manifestHash: "a".repeat(64) }, { events: [], comments: [] });
  const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
    initialRecordId={update.manifest.recordId} initialCommentId="source-reply" board={{ canParticipate: false, participation: null,
      proposals: [{ recordId: update.manifest.recordId, title: issue.title, sourceCapture: update.capture, commentCount: 0, likes: 0, likedByMe: false, chargedBefore: false }] }} />);
  expect(html).toContain(issue.title);
  expect(html).toContain(`aria-pressed="true">${filter}</button>`);
  expect(html).toContain(label);
  expect(html).not.toContain(">Closed</button>");
  expect(html).not.toContain("Committee votes and feedback");
  expect(html).not.toContain("Awaiting committee decision");
  expect(update.manifest).toMatchObject({ revision: 2, previousManifestHash: "a".repeat(64) });
});

it("separates Closed from Under review and opens a closed record deep link in the matching filter", async () => {
  const closedIssue = { ...issue, number: 99902, html_url: issue.html_url.replace("99901", "99902"), title: "A closed source without a verdict", state: "closed" };
  const pending = await buildSourceUpdate(issue, issue.number, capturedAt, null, { events: [], comments: [] });
  const closed = await buildSourceUpdate(closedIssue, closedIssue.number, capturedAt, null, { events: [], comments: [] });
  const board = { canParticipate: false, participation: null, proposals: [pending, closed].map(value => ({
    recordId: value.manifest.recordId, title: value.capture.proposal.title, sourceCapture: value.capture,
    commentCount: 0, likes: 0, likedByMe: false, chargedBefore: false
  })) };
  const pendingHtml = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={board} />);
  expect(pendingHtml).toContain('aria-pressed="true">Under review</button>');
  expect(pendingHtml).toContain('aria-pressed="false">Closed</button>');
  expect(pendingHtml).toContain(issue.title);
  expect(pendingHtml).not.toContain(closedIssue.title);
  const closedHtml = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={board} initialRecordId={closed.manifest.recordId} />);
  expect(closedHtml).toContain('aria-pressed="true">Closed</button>');
  expect(closedHtml).toContain(closedIssue.title);
  expect(closedHtml).not.toContain(issue.title);
  expect(closedHtml).not.toContain("Awaiting committee decision");
  expect(closedHtml).not.toContain(">All</button>");
});

it("retains the V1 archive verifier while accepting immutable V2 source evidence", async () => {
  const previous = await buildSourceProposal(issue, issue.number, capturedAt);
  expect((await verifySourceProposal(previous.bundle, previous.manifestHash)).capture.schema).toBe("PARTICIPATE_SOURCE_CAPTURE_V1");
  const current = await buildSourceUpdate({ ...issue, state: "closed", labels: [{ name: "✅ Grant Approved", color: "087f23", description: null }] }, issue.number, capturedAt,
    { recordId: previous.manifest.recordId, revision: 1, manifestHash: previous.manifestHash }, { events: [], comments: [] });
  expect((await verifySourceProposal(current.bundle, current.manifestHash)).capture.proposal.outcome).toBe("approved");
  expect((await verifySourceProposal(previous.bundle, previous.manifestHash)).capture.proposal.outcome).toBe("under_review");
});
