// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProposalWorkspace } from "./proposal-workspace";
import { buildSourceProposal } from "@/lib/participate/workspace/archive/source-proposals";
import type { OfficialProposalSnapshot } from "@/lib/participate/official-proposals-model";
import { ZCG_PROPOSAL_EXAMPLES } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZcgProposalExamples } from "./zcg-proposal-examples";

vi.mock("./community-workspace", () => ({ WorkspaceFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("./proposal-economy", () => ({ ProposalEconomyProvider: ({ children }: { children: ReactNode }) => <>{children}</>, ProposalEconomyNotice: () => null, ProposalEngagement: ({ recordId }: {recordId: string}) => <button>Comments for {recordId}</button> }));
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: () => null }));
vi.mock("./submission-lifecycle", () => ({ AbandonmentNotice: () => null, SubmissionLifecycleAction: () => null }));
vi.mock("./proposal-zec-estimate", () => ({ useProposalZecPrice: () => ({ status: "unavailable", price: null }), ProposalZecEstimate: () => null }));
vi.mock("./approved-proposal-budgets", () => ({ useApprovedProposalBudgets: () => ({ snapshot: null, status: "loading" }), budgetStatusText: () => "Loading approved budget…" }));

afterEach(cleanup);
const community = { id: "zcg", name: "ZCG", slug: "zcg" };
const row = (issueNumber: number, title: string, applicant: string, outcome: "under_review" | "approved") => ({ issueNumber, title, applicant, outcome,
  url: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${issueNumber}`, submitted: "2026-09-29", requestedUsd: 45000 });
const snapshot: OfficialProposalSnapshot = { version: 1, readAt: "2026-10-14T14:00:00.000Z", proposals: [
  row(454, "0xramp", "0xramp Labs", "approved"), row(447, "Mexico", "Zcash México", "approved"),
  row(486, "Konclave: taking the viewing key off the coordinator", "@danielgorgonha", "under_review"),
] };

it("combines text and category filters for a new official proposal before import, with a neutral committee roster", () => {
  render(<ProposalWorkspace community={community} communities={[community]} viewer={null} board={{ proposals: [], canParticipate: false, participation: null }} initialOfficialProposals={snapshot} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search proposals" }), { target: { value: "@DANIEL" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "wallets" } });
  expect(screen.getByRole("heading", { name: /Konclave/ })).toBeTruthy();
  expect(screen.getByText("1 of 1 proposal")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Committee review awaiting meeting minutes" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Read feedback/ })).toBeNull();
  expect(screen.queryByText("Comments for zcg-github-486")).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "events" } });
  expect(screen.getByText("No proposals match these filters.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("heading", { name: /Konclave/ })).toBeTruthy();
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
});

it("searches imported, published-only and historical cards in one status list without losing engagement identity", async () => {
  const captured = await buildSourceProposal({ number: 454, html_url: snapshot.proposals[0].url, title: "0xramp: ZEC payments and wallet integrations", body: "### Requested Grant Amount (USD)\n\n$45,000",
    user: { login: "vinibarbosabr" }, state: "open", created_at: "2026-09-29T12:00:00Z", updated_at: "2026-10-12T12:00:00Z",
    labels: [{ name: "📋 Grant Application", color: "bdb853", description: null }, { name: "👀 Ready For ZCG Review", color: "115858", description: null }] }, 454, "2026-10-14T14:00:00.000Z");
  const historical = ZCG_PROPOSAL_EXAMPLES[0];
  const base = { commentCount: 2, likes: 2, likedByMe: false, chargedBefore: false };
  render(<ProposalWorkspace community={community} communities={[community]} viewer={null} initialRecordId="zcg-github-454" initialOfficialProposals={snapshot}
    board={{ canParticipate: true, participation: null, proposals: [
      { ...base, recordId: "zcg-github-454", title: captured.capture.proposal.title, sourceCapture: captured.capture },
      { ...base, recordId: historical.id, title: historical.title },
    ] }} />);
  const search = screen.getByRole("searchbox");
  expect(screen.getByText("3 proposals")).toBeTruthy();
  fireEvent.change(search, { target: { value: "#454 @vinibar" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "wallets" } });
  expect(screen.getByText("Comments for zcg-github-454")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: /Mexico/ })).toBeNull();
  expect(screen.getByText("1 of 3 proposals")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(search, { target: { value: "MEXICO" } });
  expect(screen.getByRole("heading", { name: /Mexico/ })).toBeTruthy();
  expect(screen.queryByText("Comments for zcg-github-447")).toBeNull();
  fireEvent.change(search, { target: { value: "graphsense" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "research" } });
  expect(screen.getByText(`Comments for ${historical.id}`)).toBeTruthy();
  expect(screen.getByText("1 of 3 proposals")).toBeTruthy();
});

it("clears restrictive searches when a notification requests another proposal", () => {
  const graph = ZCG_PROPOSAL_EXAMPLES[0];
  const seed = ZCG_PROPOSAL_EXAMPLES.find(proposal => proposal.outcome === "rejected")!;
  const { rerender } = render(<ZcgProposalExamples proposals={[graph, seed]} filterTarget={{ recordId: graph.id, fallback: "approved" }} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no such proposal" } });
  expect(screen.queryByRole("heading", { name: seed.title })).toBeNull();
  rerender(<ZcgProposalExamples proposals={[graph, seed]} filterResetKey={1} filterTarget={{ recordId: seed.id, fallback: "rejected" }} />);
  expect(screen.getByRole("heading", { name: seed.title })).toBeTruthy();
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
});
