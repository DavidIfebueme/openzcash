import { afterEach, expect, it, vi } from "vitest";
import { populateTreasuryFees } from "./fees";
import { treasuryFeedSchema } from "./ledger";
import feed from "../../../data/openzcash-treasury/snapshot.json";

afterEach(() => vi.unstubAllGlobals());

it("uses the mined fee only for the matching canonical transaction and block", async () => {
  const snapshot = treasuryFeedSchema.parse(feed).snapshot!;
  const tx = snapshot.transactions[0];
  snapshot.transactions = [tx];
  const record = { txid: tx.txid, blockHeight: String(tx.height), isCanonical: true, feeZat: "4000" };
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  for (const response of [{ ...record, isCanonical: false }, { ...record, txid: "0".repeat(64) }, { ...record, blockHeight: "1" }, record]) {
    tx.feeZatoshis = null;
    request.mockResolvedValueOnce(Response.json(response));
    await populateTreasuryFees(snapshot, null, new AbortController().signal);
    expect(tx.feeZatoshis).toBe(response === record ? "4000" : null);
  }
  const next = { ...snapshot, transactions: [{ ...tx, feeZatoshis: null }] };
  await populateTreasuryFees(next, snapshot, new AbortController().signal);
  expect(next.transactions[0].feeZatoshis).toBe("4000");
  expect(request).toHaveBeenCalledTimes(4);
});
