// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ZcgProposalExamples } from "./zcg-proposal-examples";
import { CommunityWorkspace } from "./community-workspace";
import { PUBLISHED_COMMITTEE_DECISIONS } from "@/lib/zcg/committee-minutes";
import { ZCG_PROPOSAL_EXAMPLES } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZCG_REVIEW_PROPOSALS } from "@/lib/participate/workspace/data/zcg-review-proposals";

afterEach(cleanup);

it.each([...PUBLISHED_COMMITTEE_DECISIONS, ...ZCG_PROPOSAL_EXAMPLES, ...ZCG_REVIEW_PROPOSALS])(
  "keeps the complete card contract before and after import: $id", proposal => {
    const props = { proposals: [proposal], communityId: "zcg", filterTarget: { recordId: proposal.id, fallback: proposal.outcome } };
    const { container, rerender } = render(<ZcgProposalExamples {...props} archiveRecordIds={[]} />);
    const card = () => container.querySelector(`[data-proposal-card="${proposal.id}"]`)!;
    const check = () => {
      expect(card()).toBeTruthy();
      expect(card().querySelectorAll(":scope > .proposal-card-header")).toHaveLength(1);
      expect(card().querySelectorAll(":scope > .zcg-proposal-labels")).toHaveLength(1);
      expect(card().querySelectorAll(":scope > .dao-proposal-card-footer")).toHaveLength(1);
      expect(within(card() as HTMLElement).getByRole("list", { name: "Proposal sectors" }).textContent?.trim()).toBeTruthy();
      expect(card().querySelector(".proposal-card-metadata")).toBeTruthy();
    };
    check();
    expect(within(card() as HTMLElement).getByRole("link", { name: "Read source ↗" }).getAttribute("href")).toBe(proposal.proposalUrl);
    expect(within(card() as HTMLElement).getByText("Awaiting source import")).toBeTruthy();
    expect(within(card() as HTMLElement).queryByRole("button", { name: /Comments/ })).toBeNull();
    rerender(<ZcgProposalExamples {...props} archiveRecordIds={[proposal.id]} renderActions={id => <button>Comments for {id}</button>} />);
    check();
    expect(within(card() as HTMLElement).getByRole("button", { name: `Comments for ${proposal.id}` })).toBeTruthy();
    expect(within(card() as HTMLElement).getByRole("link", { name: "Read & verify →" }).getAttribute("href")).toContain(proposal.id);
    expect(within(card() as HTMLElement).queryByText("Awaiting source import")).toBeNull();
  },
);

it("keeps Türkiye and Mexico visible under their categories before source import", () => {
  const proposals = PUBLISHED_COMMITTEE_DECISIONS.filter(p => [447, 449].includes(p.issueNumber));
  render(<ZcgProposalExamples proposals={proposals} archiveRecordIds={[]} filterTarget={{ recordId: proposals[0].id, fallback: "approved" }} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "events" } });
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "education" } });
  expect(screen.getByRole("heading", { name: /Türkiye/ })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: /Mexico/ })).toBeNull();
});

it("shows unknown categories explicitly and uses the same rule in the filter", () => {
  const proposal = { ...PUBLISHED_COMMITTEE_DECISIONS[0], id: "zcg-github-99999", title: "Unspecified project", tags: [] };
  render(<ZcgProposalExamples proposals={[proposal]} filterTarget={{ recordId: proposal.id, fallback: proposal.outcome }} archiveRecordIds={[]} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "uncategorized" } });
  expect(screen.getByRole("heading", { name: proposal.title })).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Proposal sectors" })).getByText("Uncategorized")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "events" } });
  expect(screen.queryByRole("heading", { name: proposal.title })).toBeNull();
});

it("uses the same layout in community workspaces without inventing a ZCG committee", () => {
  const community = { id: "local-dao", name: "Community", slug: "community" };
  const { container } = render(<CommunityWorkspace community={community} communities={[community]} viewer={null} treasury={null} memberCount={0}
    proposals={[{ id: "community-1", question: "Community workshop", status: "OPEN", createdAt: "2026-10-10T00:00:00Z", opensAt: "2026-10-10T00:00:00Z", closesAt: "2026-10-20T00:00:00Z", commentCount: 0, tags: [], requestedAmountUsdCents: "10000" }]} />);
  const card = container.querySelector('[data-proposal-card="community-1"]')!;
  expect(card.querySelector(".proposal-card-header")).toBeTruthy();
  expect(card.querySelector(".dao-proposal-card-footer")).toBeTruthy();
  expect(within(card as HTMLElement).getByText("Voting open")).toBeTruthy();
  expect(within(card as HTMLElement).getByRole("list", { name: "Proposal sectors" }).textContent).toContain("Education");
  expect(within(card as HTMLElement).getByRole("list", { name: "Proposal dates and author" }).textContent).toContain("Closes Oct 20, 2026");
  expect(within(card as HTMLElement).queryByRole("region", { name: /Committee/ })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search proposals" }), { target: { value: "education" } });
  expect(screen.getByRole("heading", { name: "Community workshop" })).toBeTruthy();
});
