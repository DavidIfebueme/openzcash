// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PublishedDecisionCard } from "./published-decision-card";
import { publishedDecisionForIssue } from "@/lib/zcg/committee-minutes";
import { ZcgProposalExamples } from "./zcg-proposal-examples";

afterEach(cleanup);
const ramp = publishedDecisionForIssue("https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/454", Date.parse("2026-10-14T14:00:00Z"))!;
it("opens documented feedback and distinguishes a unanimous vote without an individual comment", () => {
  render(<PublishedDecisionCard decision={ramp} />);
  expect(screen.getByText("Unanimous · 5 of 5 · Oct 12, 2026")).toBeTruthy();
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
  render(<PublishedDecisionCard decision={mexico} />);
  expect(screen.getByText("Unanimous · 5 of 5 · Oct 2, 2026 · Async")).toBeTruthy();
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
