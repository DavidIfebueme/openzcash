import { z } from "zod";
import type { TreasurySnapshot } from "./ledger";

const feeRecord = z.object({
  txid: z.string(),
  blockHeight: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d{0,9}$/).transform(Number)]),
  isCanonical: z.literal(true),
  feeZat: z.string().regex(/^(0|[1-9]\d{0,15})$/),
});

/** ZKool reports a conventional fee. Only publish an independently indexed mined fee. */
export async function populateTreasuryFees(snapshot: TreasurySnapshot, previous: TreasurySnapshot | null, signal: AbortSignal) {
  const cached = new Map(previous?.transactions.map(tx => [tx.txid, tx]));
  const missing = snapshot.transactions.filter(tx => {
    const old = cached.get(tx.txid);
    if (old?.height === tx.height && old.feeZatoshis !== null) {
      tx.feeZatoshis = old.feeZatoshis;
      return false;
    }
    return true;
  });
  // Bound the work per sync pass even on a cold start with a long history.
  await Promise.all(missing.slice(0, 12).map(async tx => {
    try {
      const response = await fetch(`https://api.mainnet.cipherscan.app/api/tx/${tx.txid}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
      });
      if (!response.ok) return;
      const result = feeRecord.safeParse(await response.json());
      if (!result.success) return;
      const { txid, blockHeight, feeZat } = result.data;
      if (txid === tx.txid && blockHeight === tx.height && BigInt(feeZat) <= 2_100_000_000_000_000n) {
        tx.feeZatoshis = feeZat;
      }
    } catch {
      // An unavailable fee leaves the independently reconciled net debit intact.
    }
  }));
}
