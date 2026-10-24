import {
  BLOCKS_PER_DAY,
  LOCKBOX_ZEC_PER_BLOCK,
  THIRD_HALVING_HEIGHT,
  lockboxZecAt,
} from "@/lib/zcash/lockbox";
import type { Round } from "./types";

/** NU6.1: the ZIP 1015 lockbox was paid into the Coinholder-Controlled Fund at this height (ZIP 271). */
export const NU6_1_HEIGHT = 3_146_400;

/** Fund arithmetic from the protocol schedule; every input is a height, a ZEC balance or a USD price. */
export function fundOutlook(input: {
  balanceZec: number;
  height: number;
  priceUsd: number | null;
  approvedUsd: number;
  now: Date;
}) {
  const { balanceZec, height, priceUsd, approvedUsd, now } = input;
  const perDay = LOCKBOX_ZEC_PER_BLOCK * BLOCKS_PER_DAY;
  const blocksLeft = Math.max(0, THIRD_HALVING_HEIGHT - height);
  const streamLeftZec = blocksLeft * LOCKBOX_ZEC_PER_BLOCK;
  const streamTotalZec =
    (THIRD_HALVING_HEIGHT - NU6_1_HEIGHT) * LOCKBOX_ZEC_PER_BLOCK;
  const streamDoneShare = Math.min(
    1,
    Math.max(
      0,
      (height - NU6_1_HEIGHT) / (THIRD_HALVING_HEIGHT - NU6_1_HEIGHT),
    ),
  );
  const halvingEta = new Date(
    now.getTime() + (blocksLeft / BLOCKS_PER_DAY) * 86_400_000,
  );
  const approvedZec = priceUsd ? approvedUsd / priceUsd : null;
  return {
    seedZec: lockboxZecAt(NU6_1_HEIGHT),
    perBlockZec: LOCKBOX_ZEC_PER_BLOCK,
    perDayZec: perDay,
    perMonthZec: perDay * 30,
    blocksLeft,
    streamLeftZec,
    streamTotalZec,
    streamDoneShare,
    halvingEta,
    balanceUsd: priceUsd ? balanceZec * priceUsd : null,
    approvedZec,
    /** Approved but unpaid grants as a share of today's balance, at today's price. */
    approvedShareOfBalance:
      approvedZec !== null && balanceZec > 0 ? approvedZec / balanceZec : null,
    balanceAfterApprovedZec:
      approvedZec !== null ? balanceZec - approvedZec : null,
  };
}

/** ZEC paid, at the precision the sources use: at least cents, up to the sheet's three decimals (7,320.535). */
export const formatPaidZec = (zec: number) =>
  zec.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

/** One round's payout as `PAYOUTS` records it; `zec` is null until FPF reports the amount. */
export type PayoutEntry = {
  round: string;
  roundId: string;
  date: string;
  usdCents: number;
  zec: number | null;
  grants: string;
  status: "paid" | "approved";
  source: string;
};

export type PayoutRow = {
  round: string;
  roundId: string;
  date: string;
  usd: number;
  zec: number;
  /** The price the payout implies: USD paid over ZEC sent. */
  zecUsd: number;
  /** Grants the round funded, from the curated outcomes; null for a round the site does not list. */
  grants: number | null;
  source: string;
};

export type PayoutSummary = {
  /** Paid rounds in the order given (oldest first). */
  rows: PayoutRow[];
  totalUsd: number;
  totalZec: number;
  /** Null when a paid round's grants cannot be counted. */
  totalGrants: number | null;
  /** The approved round still awaiting payment, if any. */
  pending: PayoutEntry | null;
};

const fundedCount = (rounds: readonly Round[], roundId: string) => {
  const round = rounds.find((r) => r.id === roundId);
  return round
    ? round.proposals.filter((p) => p.outcome === "funded").length
    : null;
};

/** The payouts FPF has reported, each priced by what it implies, with their totals and the round still pending. */
export function payoutSummary(
  payouts: readonly PayoutEntry[],
  rounds: readonly Round[],
): PayoutSummary {
  const rows: PayoutRow[] = payouts.flatMap((p) => {
    if (p.status !== "paid" || p.zec === null || p.zec <= 0) return [];
    const usd = p.usdCents / 100;
    return [
      {
        round: p.round,
        roundId: p.roundId,
        date: p.date,
        usd,
        zec: p.zec,
        zecUsd: usd / p.zec,
        grants: fundedCount(rounds, p.roundId),
        source: p.source,
      },
    ];
  });
  const counts = rows.map((r) => r.grants);
  // Sum in zatoshi so a total on a rounding boundary (7,887.125) stays exact.
  const totalZat = rows.reduce((sum, r) => sum + Math.round(r.zec * 1e8), 0);
  return {
    rows,
    totalUsd: rows.reduce((sum, r) => sum + r.usd, 0),
    totalZec: totalZat / 1e8,
    totalGrants: counts.every((c): c is number => c !== null)
      ? counts.reduce((sum, c) => sum + c, 0)
      : null,
    pending: payouts.find((p) => p.status === "approved") ?? null,
  };
}
