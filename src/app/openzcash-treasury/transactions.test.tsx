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

function history(count: number): TreasuryTransaction[] {
  return Array.from({ length: count }, (_, index) => ({
    txid: (index + 1).toString(16).padStart(64, "0"), direction: index % 4 === 3 ? "outgoing" : "incoming", amountZatoshis: String((index + 1) * 100_000_000),
    confirmedAt: "2026-11-10T13:00:00Z", height: 3500100 - index, feeZatoshis: "10000", memos: [],
  }));
}
const visibleRows = (container: HTMLElement) => container.querySelectorAll("tbody tr").length;

it("shows five transactions per page and walks through the rest", () => {
  const { container } = render(<TreasuryTransactions transactions={history(12)} />);
  const pager = screen.getByRole("navigation", { name: "Transaction pages" });
  expect(visibleRows(container)).toBe(5);
  expect(pager.textContent).toContain("Page 1 of 3");
  expect(screen.getByText("+1", { exact: false })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(pager.textContent).toContain("Page 2 of 3");
  expect(visibleRows(container)).toBe(5);
  expect(screen.getByText("+6", { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(pager.textContent).toContain("Page 3 of 3");
  expect(visibleRows(container)).toBe(2);
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(pager.textContent).toContain("Page 2 of 3");
});

it("returns to the first page when the filter changes, and counts pages for the filtered list", () => {
  const { container } = render(<TreasuryTransactions transactions={history(12)} />);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Incoming" }));
  expect(screen.getByRole("navigation", { name: "Transaction pages" }).textContent).toContain("Page 1 of 2");
  expect(visibleRows(container)).toBe(5);
  fireEvent.click(screen.getByRole("button", { name: "Outgoing" }));
  expect(screen.queryByRole("navigation", { name: "Transaction pages" })).toBeNull();
  expect(visibleRows(container)).toBe(3);
});

it("shows no pager while the history fits on one page, and keeps a valid page when the history shrinks", () => {
  const view = render(<TreasuryTransactions transactions={history(5)} />);
  expect(screen.queryByRole("navigation", { name: "Transaction pages" })).toBeNull();
  expect(visibleRows(view.container)).toBe(5);
  view.rerender(<TreasuryTransactions transactions={history(11)} />);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(visibleRows(view.container)).toBe(1);
  view.rerender(<TreasuryTransactions transactions={history(7)} />);
  expect(screen.getByRole("navigation", { name: "Transaction pages" }).textContent).toContain("Page 2 of 2");
  expect(visibleRows(view.container)).toBe(2);
});

