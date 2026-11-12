import { describe, expect, it } from "vitest";
import { buildTreasurySnapshot, parseZec, treasurySnapshotSchema } from "./ledger";

const incoming = { txid: "a".repeat(64), height: 3500010, time: "2026-11-10T13:00:00", value: "1.00000001", fee: "0.0001", notes: [{ scope: 0, memo: "For community work" }], outputs: [] };
const outgoing = { txid: "b".repeat(64), height: 3500011, time: "2026-11-10T13:05:00", value: "-0.2501", fee: "1E-4", notes: [{ scope: 1, memo: "change" }], outputs: [{ memo: "Contributor reward" }, { memo: "Contributor reward" }] };
export const engineFixture = { accounts: [{ id: 1, birth: 3500000, height: 3500012, incomingOnly: false }], balanceByAccount: { height: 3500012, total: "0.74990001" }, transactionsByAccount: [incoming, outgoing] };
const syncedAt = "2026-11-10T13:10:00.000Z";

describe("treasury reconciliation", () => {
  it("reconciles net movements, excludes change and preserves fees, memos and exact zatoshis", () => {
    const s = buildTreasurySnapshot(engineFixture, 3500012, syncedAt);
    expect(s.balanceZatoshis).toBe("74990001");
    expect(s.receivedZatoshis).toBe("100000001");
    expect(s.spentZatoshis).toBe("25010000");
    expect(s.transactions[0]).toMatchObject({ direction: "outgoing", feeZatoshis: "10000", memos: ["Contributor reward"], confirmedAt: "2026-11-10T13:05:00.000Z" });
    expect(s.transactions[1].memos).toEqual(["For community work"]);
  });

  it("rejects an incomplete scan, incoming-only key, mismatched balance and duplicate history", () => {
    expect(() => buildTreasurySnapshot(engineFixture, 3500013, syncedAt)).toThrow();
    expect(() => buildTreasurySnapshot({ ...engineFixture, accounts: [{ ...engineFixture.accounts[0], incomingOnly: true }] }, 3500012, syncedAt)).toThrow();
    expect(() => buildTreasurySnapshot({ ...engineFixture, balanceByAccount: { height: 3500012, total: "0" } }, 3500012, syncedAt)).toThrow();
    const s = buildTreasurySnapshot(engineFixture, 3500012, syncedAt);
    expect(() => treasurySnapshotSchema.parse({ ...s, transactions: [...s.transactions, s.transactions[0]] })).toThrow();
  });

  it("keeps zero-net transfers and their memos without counting them as donations or spending", () => {
    const s = buildTreasurySnapshot({ ...engineFixture, transactionsByAccount: [...engineFixture.transactionsByAccount, { ...incoming, txid: "c".repeat(64), value: "0", fee: "0" }] }, 3500012, syncedAt);
    expect(s.transactions.find((tx) => tx.txid.startsWith("c"))).toMatchObject({ direction: "internal", amountZatoshis: "0", memos: ["For community work"] });
    expect(s.receivedZatoshis).toBe("100000001");
  });

  it("accepts a verified empty ledger as zero", () => {
    const s = buildTreasurySnapshot({ ...engineFixture, balanceByAccount: { height: 3500012, total: "0" }, transactionsByAccount: [] }, 3500012, syncedAt);
    expect(s.balanceZatoshis).toBe("0");
    expect(s.transactions).toEqual([]);
  });
});

it("parses decimal amounts without floating point or silent rounding", () => {
  expect(parseZec("1E-8")).toBe(1n);
  expect(parseZec("0.0000000100")).toBe(1n);
  expect(parseZec("-0.0001")).toBe(-10_000n);
  expect(parseZec("21000000.00000000")).toBe(2_100_000_000_000_000n);
  for (const invalid of ["1e-9", "NaN", "Infinity", "0.000000011", "21000001", "1e100"]) expect(() => parseZec(invalid)).toThrow();
});
