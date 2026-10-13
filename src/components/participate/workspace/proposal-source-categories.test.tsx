import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildSourceProposal } from "@/lib/participate/workspace/archive/source-proposals";
import { ProposalWorkspace } from "./proposal-workspace";
import { ZcgProposalLabels } from "./zcg-proposal-labels";

vi.mock("./community-workspace", () => ({ WorkspaceFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./proposal-economy", () => ({ ProposalEconomyProvider: ({ children }: { children: ReactNode }) => <>{children}</>, ProposalEconomyNotice: () => null, ProposalEngagement: () => null }));
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: () => null }));
vi.mock("./submission-lifecycle", () => ({ AbandonmentNotice: () => null, SubmissionLifecycleAction: () => null }));
vi.mock("./proposal-zec-estimate", () => ({ useProposalZecPrice: () => ({ status: "loading" }), ProposalZecEstimate: () => null }));

const community = { id: "source-community", name: "ZCG", slug: "zcg" };
const issue = {
  number: 479, html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/479",
  title: "Grant Application - Zcash Private Receive Bridge", body: "# Legacy capture without parsed category",
  user: { login: "intelliDean" }, state: "open", created_at: "2026-10-09T10:00:00.000Z", updated_at: "2026-10-11T12:00:00.000Z",
  labels: [{ name: "📋 Grant Application", color: "BDB853", description: null }, { name: "👀 Ready For ZCG Review", color: "115858", description: null }],
};

describe("source category annotations", () => {
  it("renders the recovered applicant category on an existing imported card without changing its capture", async () => {
    const checked = await buildSourceProposal(issue, 479, "2026-10-12T12:00:00.000Z");
    const before = JSON.stringify(checked.capture);
    const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
      initialBudgets={{ version: 1, importedAt: "2026-10-12T12:00:00.000Z", budgets: {} }}
      board={{ canParticipate: false, participation: null, proposals: [{
        recordId: checked.manifest.recordId, title: issue.title, sourceCapture: checked.capture,
        sourceCategory: "Infrastructure", commentCount: 0, likes: 0, likedByMe: false, chargedBefore: false,
      }] }} />);
    expect(html).toContain('aria-label="Proposal sectors"');
    expect(html).toContain('title="Applicant category on GitHub · Infrastructure"');
    expect(html).toContain('dao-topic--blue');
    expect(html).toContain("👀 Ready For ZCG Review");
    expect(html).toContain("📋 Grant Application");
    expect(JSON.stringify(checked.capture)).toBe(before);
    expect(checked.capture.source.category).toBeNull();
    expect(checked.capture.proposal.tags).toEqual([]);
  });

  it("retains OpenZcash enrichment alongside the declared category, without duplicate badges", () => {
    const html = renderToStaticMarkup(<ZcgProposalLabels recordId="zcg-github-9999" title="Wallet integration" tags={["wallets", "integration"]}
      categoryOverride="Wallets" outcome="under_review" />);
    expect(html).toContain('title="Applicant category on GitHub · Wallets"');
    expect(html).toContain('title="OpenZcash sector classification">Integration');
    expect(html.match(/>Wallets</g)).toHaveLength(1);
  });

  it.each([[38000, "$38,000"], [38000.25, "$38,000.25"], [0, "$0"], [null, null]] as const)(
    "shows a recovered request of %s USD without presenting it as approved", async (amount, formatted) => {
      const checked = await buildSourceProposal(issue, 479, "2026-10-12T12:00:00.000Z");
      const html = renderToStaticMarkup(<ProposalWorkspace community={community} communities={[community]} viewer={null}
        initialBudgets={{ version: 1, importedAt: "2026-10-12T12:00:00.000Z", budgets: {} }}
        board={{ canParticipate: false, participation: null, proposals: [{
          recordId: checked.manifest.recordId, title: issue.title, sourceCapture: checked.capture,
          sourceCategory: "Infrastructure", sourceRequestedUsd: amount,
          commentCount: 0, likes: 0, likedByMe: false, chargedBefore: false,
        }] }} />);
      if (formatted !== null) {
        expect(html).toContain(`aria-label="Requested budget: ${formatted} USD"`);
        expect(html).toContain(`<strong>${formatted}</strong><span>USD requested</span>`);
      } else expect(html).not.toContain("Requested budget:");
      expect(html).not.toContain("Approved budget:");
      expect(html).not.toContain("ZEC today");
      expect(checked.capture.proposal.requestedUsd).toBeNull();
    },
  );
});
