// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TreasuryTransactions, type TreasuryTransaction } from "./transactions";

afterEach(cleanup);
const transactions: TreasuryTransaction[] = [
  { txid: "a".repeat(64), direction: "incoming", amountZatoshis: "100000001", confirmedAt: "2026-11-10T13:00:00Z", height: 3500002, feeZatoshis: "10000", memos: [] },
  { txid: "b".repeat(64), direction: "outgoing", amountZatoshis: "25000000", confirmedAt: "2026-11-09T13:00:00Z", height: 3500001, feeZatoshis: "10000", memos: [] },
];

it("filters incoming and outgoing transfers without losing zatoshi precision", () => {
  render(<TreasuryTransactions transactions={transactions} />);
  expect(screen.getByText("+1.00000001", { exact: false })).toBeTruthy();
  expect(screen.getByText("−0.25", { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Incoming" }));
  expect(screen.getByRole("button", { name: "Incoming" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText("−0.25", { exact: false })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Outgoing" }));
  expect(screen.queryByText("+1.00000001", { exact: false })).toBeNull();
  expect(screen.getByText("−0.25", { exact: false })).toBeTruthy();
});

it("keeps unavailable history distinct from a verified history with no transfers", () => {
  const view = render(<TreasuryTransactions transactions={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Outgoing" }));
  expect(screen.getByRole("status").textContent).toBe("History not available yet");
  expect(screen.queryByText("No outgoing transactions in this history.")).toBeNull();
  view.rerender(<TreasuryTransactions transactions={[]} />);
  expect(screen.getByRole("status").textContent).toBe("No outgoing transactions in this history.");
});

it("shows an expandable memo only when present and renders its content as plain text", () => {
  const memo = 'Donation <script>alert("x")</script>\nFor development and community work.';
  const { container } = render(<TreasuryTransactions transactions={[
    { ...transactions[0], memos: [memo] },
    { ...transactions[1], memos: [] },
  ]} />);
  expect(container.querySelectorAll("details")).toHaveLength(1);
  expect(container.querySelector("details p")?.textContent).toBe(memo);
  expect(container.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Outgoing" }));
  expect(container.querySelector("details")).toBeNull();
});
