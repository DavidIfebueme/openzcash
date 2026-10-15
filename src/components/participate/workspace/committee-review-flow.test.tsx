// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CommitteeWorkspacePanel } from "./committee-workspace";
import { committeePermissions, type CommitteeWorkspace } from "@/lib/participate/workspace/domain/committee";
vi.mock("./proposal-inline-details", () => ({ ProposalInlineDetails: ({ active, communityId, recordId }: { active: string; communityId: string; recordId: string }) => <p data-testid="proposal-surface">{communityId}/{recordId}/{active}</p> }));
const api = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/participate/workspace/auth/passkey-client", () => ({ passkeyFetch: api.read }));
vi.mock("./signed-decision", () => ({ SignedDecision: ({ visible, readOnlyReason, onChanged }: { visible: boolean; readOnlyReason?: string; onChanged: () => void }) => visible ? <div><p>{readOnlyReason ?? "Signed vote form"}</p><button onClick={onChanged}>Test completed vote</button></div> : null }));
vi.mock("./review-finish", () => ({ ReviewFinish: ({visible}:{visible:boolean}) => visible ? <p>Review closeout</p> : null }));
vi.mock("./workspace-account", () => ({ AccountAvatar: () => <span /> }));
vi.mock("./workspace-auth", () => ({ WorkspaceSignInButton: () => <button>Sign in</button> }));
vi.mock("./committee-labels", () => ({ CommitteeLabels: () => null, CommitteeLabelEditor: () => <p>Local public tags</p> }));
afterEach(cleanup);
const proposal = { recordId: "local-proposal", hostId: "local-host", title: "Local test proposal", revision: 2, kind: "NATIVE_PROPOSAL", state: "OPEN", roundId: "round", closesAt: null, signed: 4, eligible: 5, myChoice: null, myPending: true, labels: [], labelsVersion: 0 };
const initial: CommitteeWorkspace = { access: "MEMBER", name: "Local ZCG test", role: null, demo: true, canMutate: false, emailReady: false, permissions: committeePermissions(null), rules: { quorum: 5, approvalPercent: 60, durationHours: null, version: 0 }, members: [], invitations: [], queue: [proposal], history: [], historyBefore: null };
it("explains admin preview and exposes separate paths for source, discussion, vote and tags", () => {
  render(<CommitteeWorkspacePanel initial={initial} initialRecordId="local-proposal" />);
  expect(screen.getByText("Admin preview · Read only")).toBeTruthy();
  expect(screen.getByTestId("proposal-surface").textContent).toBe("local-host/local-proposal/record");
  fireEvent.click(screen.getByRole("tab", { name: "Discussion" }));
  fireEvent.click(screen.getByRole("button", { name: "Source comments" }));
  expect(screen.getByTestId("proposal-surface").textContent).toBe("local-host/local-proposal/source");
  fireEvent.click(screen.getByRole("button", { name: "OpenZcash" }));
  expect(screen.getByTestId("proposal-surface").textContent).toBe("local-host/local-proposal/discussion");
  fireEvent.click(screen.getByRole("tab", { name: "Vote" }));
  expect(screen.getByText(/This admin preview cannot open reviews or sign votes/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "View public proposal ↗" }).getAttribute("href")).toBe("/zcg/participate?record=local-proposal");
  fireEvent.click(screen.getByRole("button", { name: "Members & access →" }));
  expect(screen.getByText("Roles & account setup")).toBeTruthy();
});
it("opens a decided proposal from its direct link instead of hiding it in To review", () => {
  render(<CommitteeWorkspacePanel initial={{ ...initial, queue: [{ ...proposal, state: "APPROVED", signed: 5 }] }} initialRecordId="local-proposal" />);
  expect(screen.getByRole("button", { name: "Closed" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("region", { name: "Review: Local test proposal" })).toBeTruthy();
  expect(screen.getByText("Review closeout")).toBeTruthy();
});

it("keeps the completed review selected and moves it to Finish after the fifth response", async () => {
  api.read.mockResolvedValue({ ...initial, queue: [{ ...proposal, state: "APPROVED", signed: 5 }] });
  render(<CommitteeWorkspacePanel initial={initial} initialRecordId="local-proposal" />);
  fireEvent.click(screen.getByRole("tab", { name: "Vote" }));
  fireEvent.click(screen.getByRole("button", { name: "Test completed vote" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Closed" }).getAttribute("aria-pressed")).toBe("true"));
  expect(screen.getByRole("region", { name: "Review: Local test proposal" })).toBeTruthy();
  expect(screen.getByText("Review closeout")).toBeTruthy();
});

it("opens a notified proposal from another committee tab, resetting stale filters", () => {
  render(<CommitteeWorkspacePanel initial={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Members" }));
  act(() => { window.dispatchEvent(new CustomEvent("participate:open-committee-review", { detail: { communityId: "another-host", recordId: "local-proposal" } })); });
  expect(screen.queryByRole("region", { name: "Review: Local test proposal" })).toBeNull();
  act(() => { window.dispatchEvent(new CustomEvent("participate:open-committee-review", { detail: { communityId: "local-host", recordId: "local-proposal" } })); });
  expect(screen.getByRole("region", { name: "Review: Local test proposal" })).toBeTruthy();
  expect(screen.getByTestId("proposal-surface").textContent).toBe("local-host/local-proposal/record");
  expect(screen.getByRole("button", { name: "To review" }).getAttribute("aria-pressed")).toBe("true");
});

it("shows queue-wide review totals without treating withdrawals or source history as committee verdicts", () => {
  const queue = ["AWAITING_REVIEW", "AWAITING_REVIEW", "OPEN", "APPROVED", "REJECTED", "QUORUM_NOT_MET", "ABANDONED", "HISTORICAL"].map((state, i) => ({ ...proposal, recordId: `record-${i}`, title: `Proposal ${i}`, state, kind: state === "HISTORICAL" ? "HISTORICAL_SUMMARY" : "NATIVE_PROPOSAL" }));
  render(<CommitteeWorkspacePanel initial={{ ...initial, queue }} />);
  const summary = screen.getByLabelText("Review overview");
  const count = (label: string) => within(summary).getByText(label).parentElement?.querySelector("dd")?.textContent;
  expect(count("Awaiting review")).toBe("2");
  expect(count("Review started")).toBe("1");
  expect(count("Decided")).toBe("2");
  expect(screen.getByRole("button", { name: "Closed" }).textContent).toBe("Closed4");
  fireEvent.click(screen.getByRole("button", { name: "Source decisions" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search committee proposals" }), { target: { value: "no match" } });
  expect(count("Awaiting review")).toBe("2");
  expect(count("Review started")).toBe("1");
  expect(count("Decided")).toBe("2");
  fireEvent.click(screen.getByRole("button", { name: "Members" }));
  expect(screen.getByLabelText("Review overview")).toBeTruthy();
});

it("updates management totals after a completed review is refreshed", async () => {
  api.read.mockResolvedValue({ ...initial, queue: [{ ...proposal, state: "APPROVED", signed: 5 }] });
  render(<CommitteeWorkspacePanel initial={initial} initialRecordId="local-proposal" />);
  const summary = screen.getByLabelText("Review overview");
  const count = (label: string) => within(summary).getByText(label).parentElement?.querySelector("dd")?.textContent;
  expect(count("Review started")).toBe("1");
  expect(count("Decided")).toBe("0");
  fireEvent.click(screen.getByRole("tab", { name: "Vote" }));
  fireEvent.click(screen.getByRole("button", { name: "Test completed vote" }));
  await waitFor(() => expect(count("Decided")).toBe("1"));
  expect(count("Review started")).toBe("0");
});

it.each(["RESTRICTED", "SIGNED_OUT", "DENIED", "INVITED"] as const)("does not expose management totals to %s sessions", access => {
  render(<CommitteeWorkspacePanel initial={{ ...initial, access }} />);
  expect(screen.queryByLabelText("Review overview")).toBeNull();
});

it("exposes clearly selected review tabs and supports keyboard movement through the same preserved content panel", () => {
  render(<CommitteeWorkspacePanel initial={initial} initialRecordId="local-proposal" />);
  const tabs = within(screen.getByRole("tablist", { name: "Review sections" }));
  expect(tabs.getAllByRole("tab")).toHaveLength(4);
  const proposalTab = tabs.getByRole("tab", { name: "Proposal", selected: true });
  const content = screen.getByRole("tabpanel", { name: "Proposal" });
  expect(proposalTab.getAttribute("aria-controls")).toBe(content.id);
  expect(screen.queryByRole("button", { name: "Close review" })).toBeNull();
  proposalTab.focus();
  fireEvent.keyDown(proposalTab, { key: "ArrowRight" });
  expect(document.activeElement).toBe(tabs.getByRole("tab", { name: "Discussion", selected: true }));
  expect(screen.getByRole("tabpanel", { name: "Discussion" })).toBe(content);
  expect(screen.getByTestId("proposal-surface").textContent).toBe("local-host/local-proposal/source");
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(tabs.getByRole("tab", { name: "Finish", selected: true }));
  expect(screen.getByText("Review closeout")).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(proposalTab);
  expect(proposalTab.getAttribute("tabindex")).toBe("0");
  expect(tabs.getByRole("tab", { name: "Vote" }).getAttribute("tabindex")).toBe("-1");
});

it("keeps source decisions read-only with a Published decision tab and no Finish step", () => {
  render(<CommitteeWorkspacePanel initial={{ ...initial, queue: [{ ...proposal, kind: "HISTORICAL_SUMMARY", state: "HISTORICAL" }] }} initialRecordId="local-proposal" />);
  const tabs = within(screen.getByRole("tablist", { name: "Review sections" }));
  expect(tabs.getAllByRole("tab")).toHaveLength(3);
  expect(tabs.getByRole("tab", { name: "Published decision", selected: true })).toBeTruthy();
  expect(tabs.queryByRole("tab", { name: "Finish" })).toBeNull();
  expect(screen.queryByText("Signed vote form")).toBeNull();
});
