// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SignedDecision } from "./signed-decision";
import { SignedReviewCard } from "./signed-review-card";
import type { SignedReviewSummary } from "@/lib/participate/workspace/domain/proposal-participation";
const api = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/participate/workspace/auth/passkey-client", () => ({ passkeyFetch: api.read, passkeyErrorMessage: (error: Error) => error.message, requirePasskeyBrowser: vi.fn() }));
vi.mock("./workspace-auth", () => ({ WorkspaceSignInButton: () => <button>Sign in to review</button> }));
vi.mock("./workspace-account", () => ({ AccountAvatar: ({ name }: { name: string }) => <span aria-hidden="true">{name.slice(0, 1)}</span> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const members = Array.from({ length: 5 }, (_, i) => ({ id: `reviewer-${i}`, label: `Reviewer ${i+1}`, keyHashes: ["a".repeat(64)] }));
const round = { schema: "PARTICIPATE_DECISION_ROUND_V4", id: "round-local", proposal: { title: "Local test proposal", revision: 2 }, closesAt: null, members, rules: { quorum: 5, approvalPercent: 60 } };
const pending = { scopeKind: "COMMITTEE", round, roundHash: "a".repeat(64), progress: { signed: 4, eligible: 5 }, publication: "COLLECTING", canSign: true, ballots: [], roster: [] };
it("shows the vote and rationale form while partial results are withheld", async () => {
  api.read.mockResolvedValue(pending);
  render(<SignedDecision endpoint="/api/communities/local/archives/test" revision={2} initiallyOpen />);
  await screen.findByText("4 of 5 responses recorded");
  expect(screen.queryByLabelText("Member decisions")).toBeNull();
  expect(screen.queryByRole("button", { name: "Download receipt ↓" })).toBeNull();
  const sign = screen.getByRole("button", { name: "Sign with passkey" }) as HTMLButtonElement;
  expect(sign.disabled).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Approve" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Public reason/ }), { target: { value: "The milestones and evidence support this exact revision." } });
  expect(sign.disabled).toBe(false);
  expect(screen.getByLabelText("Preview of your position").textContent).toContain("The milestones and evidence");
  expect(api.read.mock.calls.every(call => call[2] === "GET")).toBe(true);
});
it("does not expose partial vote choices even if an older service sends them", async () => {
  api.read.mockResolvedValue({ ...pending, tally: { signed: 4, approve: 3, reject: 1, abstain: 0, eligible: 5, outcome: "OPEN" }, ballots: [{ voterId: members[0].id, choice: "REJECT", rationale: "A reason that must not appear yet" }] });
  render(<SignedDecision endpoint="/api/communities/local/archives/test" revision={2} initiallyOpen />);
  await screen.findByText("4 of 5 responses recorded");
  expect(screen.queryByText("A reason that must not appear yet")).toBeNull();
  expect(screen.queryByLabelText("Member decisions")).toBeNull();
});
it("keeps an admin preview read-only and explains why no vote is available", async () => {
  api.read.mockResolvedValue({ scopeKind: "COMMITTEE", round: null, roster: [], canManage: false, canCreate: false });
  render(<SignedDecision endpoint="/api/communities/local/archives/test" revision={1} initiallyOpen readOnlyReason="Committee operations are disabled. This admin preview cannot sign votes." />);
  await screen.findByText(/This admin preview cannot sign votes/);
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByRole("button", { name: "Open signed review" })).toBeNull();
});
it("shows every signed position only after all five responses, and links to that receipt", () => {
  const review: SignedReviewSummary = { roundId: "local-round", revision: 2, signed: 5, eligible: 5, state: "PUBLISHED", outcome: "APPROVED", publishedAt: "2026-10-15T12:00:00Z", approve: 3, reject: 1, abstain: 1,
    positions: members.map((m,i) => ({ name: m.label, choice: i < 3 ? "APPROVE" : i === 3 ? "REJECT" : "ABSTAIN", rationale: `Public rationale ${i+1}` })) };
  const { rerender } = render(<SignedReviewCard review={review} communityId="local" recordId="proposal" />);
  expect(screen.getByRole("link", { name: "Signed receipt ↓" }).getAttribute("href")).toBe("/api/communities/local/archives/proposal/decisions/local-round");
  expect(screen.getAllByText(/Public rationale/)).toHaveLength(5);
  expect(screen.getByText(/Official ZCG outcomes follow the published source/)).toBeTruthy();
  rerender(<SignedReviewCard review={{ roundId: "local-round", revision: 2, signed: 4, eligible: 5, state: "COLLECTING" }} communityId="local" recordId="proposal" />);
  expect(screen.queryByRole("link")).toBeNull(); expect(screen.queryByText(/Public rationale/)).toBeNull();
  expect(screen.getByRole("group", { name: /^80% turnout: 4 of 5/ })).toBeTruthy();
});

it.each([3, 4, 5])("shows %s recorded responses without exposing an unpublished vote", signed => {
  render(<SignedReviewCard review={{ roundId: "local-round", revision: 2, signed, eligible: 5, state: "COLLECTING", outcome: "REJECTED", approve: 3,
    positions: [{ name: "Hidden member", choice: "APPROVE", rationale: "Private until publication" }] }} communityId="local" recordId="proposal" />);
  expect(screen.getByRole("group", { name: new RegExp(`^${signed * 20}% turnout: ${signed} of 5`) }).getAttribute("data-tone")).toBe(signed === 5 ? "complete" : "partial");
  expect(screen.queryByText("Hidden member")).toBeNull();
  expect(screen.queryByText("Private until publication")).toBeNull();
  expect(screen.queryByRole("link", { name: "Signed receipt ↓" })).toBeNull();
});
