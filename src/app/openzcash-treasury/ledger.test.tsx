// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TREASURY_ACCOUNT } from "@/lib/openzcash-treasury/account";
import { TREASURY_KEY_SHA256, type TreasurySnapshot } from "@/lib/openzcash-treasury/ledger";
import { TreasuryLedger } from "./ledger";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const snapshot: TreasurySnapshot = { version: 1, network: "mainnet", address: TREASURY_ACCOUNT.address, viewingKeySha256: TREASURY_KEY_SHA256, source: "ZKool · public full viewing key", scanStartHeight: 3500000, syncedHeight: 3500012, tipHeight: 3500012, syncedAt: "2026-11-10T13:10:00.000Z", balanceZatoshis: "100000001", receivedZatoshis: "100000001", spentZatoshis: "0", transactions: [{ txid: "a".repeat(64), direction: "incoming", amountZatoshis: "100000001", height: 3500010, confirmedAt: "2026-11-10T13:00:00.000Z", feeZatoshis: null, memos: ["For the community"] }] };

it("retains verified data through an unresolved refresh and marks failures without replacing it with zero", async () => {
  let reject!: (reason: Error) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, fail) => { reject = fail; })));
  render(<TreasuryLedger initialFeed={{ status: "synced", snapshot }} />);
  expect(screen.getByText("Synced")).toBeTruthy();
  expect(screen.getByText("For the community", { selector: "p" })).toBeTruthy();
  await act(async () => { reject(new Error("offline")); });
  expect(screen.getByText("Update unavailable")).toBeTruthy();
  expect(screen.getAllByText("1.00000001")).toHaveLength(2);
  expect(screen.getByText("For the community", { selector: "p" })).toBeTruthy();
});

it("updates the displayed balance and memo from the read-only feed without a page reload", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ status: "synced", snapshot }) })));
  await act(async () => { render(<TreasuryLedger initialFeed={{ status: "syncing", snapshot: null }} />); });
  expect(screen.getByText("Synced")).toBeTruthy();
  expect(screen.getByText("For the community", { selector: "p" })).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("/api/openzcash-treasury", expect.objectContaining({ cache: "no-store" }));
});

it("sizes the headline balance from its character count so it stays on one line", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  render(<TreasuryLedger initialFeed={{ status: "synced", snapshot }} />);
  const balance = screen.getAllByText("1.00000001")[0];
  expect(balance.style.getPropertyValue("--balance-chars")).toBe("10");
});
