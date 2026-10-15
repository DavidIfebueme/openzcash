// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PublishedDecisionCard } from "./published-decision-card";
import { PUBLISHED_COMMITTEE_DECISIONS, publishedDecisionForIssue } from "@/lib/zcg/committee-minutes";
import { ZCG_PROPOSAL_EXAMPLES } from "@/lib/participate/workspace/data/zcg-proposal-examples";
import { ZcgProposalExamples } from "./zcg-proposal-examples";

afterEach(cleanup);
const ramp = publishedDecisionForIssue("https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454", Date.parse("2026-10-14T14:00:00Z"))!;
it("opens documented feedback and distinguishes a unanimous vote without an individual comment", () => {
  render(<PublishedDecisionCard decision={ramp} />);
  expect(screen.getByText("Unanimous approval")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zerodartz: Approve. Read feedback" }));
  expect(screen.getByRole("dialog").textContent).toContain("risks clearly shown before a swap");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getAllByText("Collective vote")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Hanh: Approve via unanimous record. Read feedback" }));
  expect(screen.getByRole("dialog").textContent).toContain("No individual comment published");
  expect(screen.getByRole("link", { name: "Read source ↗" }).getAttribute("href")).toContain("58182/1");
});
it("keeps the recorded asynchronous date on the card", () => {
  const mexico = publishedDecisionForIssue("https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/447", Date.parse("2026-10-14T14:00:00Z"))!;
  render(<ZcgProposalExamples proposals={[mexico]} filterTarget={{ recordId: mexico.id, fallback: "approved" }} />);
  const metadata = screen.getByRole("list", { name: "Proposal dates and author" });
  expect(within(metadata).getByText("Decision Oct 2, 2026 (async)").getAttribute("datetime")).toBe("2026-10-02");
  expect(within(metadata).getByText("Minutes Oct 12, 2026").getAttribute("datetime")).toBe("2026-10-12");
  expect(within(metadata).queryByText(/Submitted/)).toBeNull();
  expect(within(screen.getByRole("region", { name: "Published committee verdict" })).queryByText(/Oct/)).toBeNull();
});

it.each([...PUBLISHED_COMMITTEE_DECISIONS, ...ZCG_PROPOSAL_EXAMPLES])("shows a consistent minutes section for $id before and after archive import", proposal => {
  const props = { proposals: [proposal], communityId: "zcg", filterTarget: { recordId: proposal.id, fallback: proposal.outcome } };
  const { rerender } = render(<ZcgProposalExamples {...props} archiveRecordIds={[]} />);
  const card = screen.getByRole("region", { name: "Published committee verdict" });
  expect(within(card).getByRole("link", { name: "Meeting minutes ↗" }).getAttribute("href")).toBe(proposal.minutesUrl);
  expect(within(card).getAllByRole("button", { name: /Read feedback/ })).toHaveLength(proposal.votes.length);
  expect(screen.queryByText("Meeting record ↗")).toBeNull();
  expect(screen.queryByRole("group", { name: /Committee support/ })).toBeNull();
  expect(within(screen.getByRole("list", { name: "Proposal dates and author" })).getByText(/^Decision /)).toBeTruthy();
  rerender(<ZcgProposalExamples {...props} archiveRecordIds={[proposal.id]} renderActions={() => <button>Comments</button>} />);
  expect(screen.getByRole("button", { name: "Comments" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Meeting minutes ↗" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Meeting minutes ↗" }).getAttribute("href")).toBe(proposal.minutesUrl);
});

it("keeps mixed votes and abstentions explicit on older minutes", () => {
  const ironwood = ZCG_PROPOSAL_EXAMPLES.find(proposal => proposal.id === "zcg-ironwood-2026-09-28")!;
  render(<PublishedDecisionCard decision={ironwood} />);
  expect(screen.getByText("4 approve · 0 reject · 1 abstain")).toBeTruthy();
  expect(screen.queryByText(/Unanimous/)).toBeNull();
  expect(screen.queryByText(/Collective votes/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Paul Brigner: Abstain. Read feedback" }));
  expect(screen.getByRole("dialog").textContent).toContain("Abstention recorded");
  expect(screen.getByRole("link", { name: "Read source ↗" }).getAttribute("href")).toBe(ironwood.minutesUrl);
});

it("takes a history deep link directly to a published decision when its archive has not been imported", () => {
  const mexico = publishedDecisionForIssue("https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/447", Date.parse("2026-10-14T14:00:00Z"))!;
  const props = { archiveRecordIds: [], filterTarget: { recordId: mexico.id, fallback: "under_review" as const } };
  const { rerender } = render(<ZcgProposalExamples {...props} proposals={[]} />);
  rerender(<ZcgProposalExamples {...props} proposals={[ramp, mexico]} />);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Mexico Tech Week/ }).closest("li"));
  expect(screen.getByRole("button", { name: "Approved" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
  expect(screen.queryByRole("heading", { name: /Mexico Tech Week/ })).toBeNull();
});

it("counts an abstention toward turnout without treating it as approval", () => {
  const decision = ZCG_PROPOSAL_EXAMPLES.find(proposal => proposal.id === "zcg-ironwood-2026-09-28")!;
  render(<PublishedDecisionCard decision={decision} />);
  expect(screen.getByRole("group", { name: /^100% turnout: 5 of 5/ }).getAttribute("data-tone")).toBe("complete");
  expect(screen.queryByText("5 / 5 recorded")).toBeNull();
  expect(screen.getByText("4 approve · 0 reject · 1 abstain")).toBeTruthy();
});

it.each([3, 4, 5])("uses the full roster for %s published responses", recorded => {
  render(<PublishedDecisionCard decision={{ ...ZCG_PROPOSAL_EXAMPLES[0], votes: ZCG_PROPOSAL_EXAMPLES[0].votes.slice(0, recorded) }} />);
  expect(screen.getByRole("group", { name: new RegExp(`^${recorded * 20}% turnout: ${recorded} of 5`) }).getAttribute("data-tone")).toBe(recorded === 5 ? "complete" : "partial");
});

it("does not count the same member twice toward turnout", () => {
  const votes = ZCG_PROPOSAL_EXAMPLES[0].votes.slice(0, 4);
  render(<PublishedDecisionCard decision={{ ...ZCG_PROPOSAL_EXAMPLES[0], votes: [...votes, votes[0]] }} />);
  expect(screen.getByRole("group", { name: /^80% turnout: 4 of 5/ })).toBeTruthy();
});

it("keeps an unknown published vote record distinct from zero turnout", () => {
  render(<PublishedDecisionCard decision={{ ...ZCG_PROPOSAL_EXAMPLES[0], votes: [] }} />);
  expect(screen.getByRole("group", { name: /^Turnout unavailable/ })).toBeTruthy();
  expect(screen.queryByText("0%")).toBeNull();
});

it("does not describe a unanimous rejection as approval", () => {
  const rejected = ZCG_PROPOSAL_EXAMPLES.find(proposal => proposal.outcome === "rejected")!;
  render(<PublishedDecisionCard decision={{ ...rejected, unanimous: true }} />);
  expect(screen.getByText("Unanimous rejection")).toBeTruthy();
  expect(screen.queryByText("Unanimous approval")).toBeNull();
  expect(screen.getByRole("group", { name: /^100% turnout/ }).getAttribute("data-tone")).toBe("rejected");
});
