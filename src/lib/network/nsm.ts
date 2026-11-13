import "server-only";

import { blocksPerDay, targetSecondsBetween } from "@/lib/funding/consensus";
import {
  NSM,
  nsmFeeContribution,
  nsmMinerFees,
  nsmReissuance,
} from "@/lib/funding/nsm";
import {
  NETWORK_SOURCE,
  getDashboardReading,
  type ApiBlock,
} from "./provider";
import type { NetworkFreshness, NetworkSource } from "./types";

/** A block's fees and where consensus sent them. Null is unknown, never zero. */
export type NsmBlock = {
  height: number;
  time: string;
  feesZat: number | null;
  nsmZat: number | null;
  minerFeesZat: number | null;
  /**
   * The reported split is the one ZIP 235 gives: floor(6 × fees / 10) to the
   * NSM and, when the miner's share is reported, the rest to the miner.
   */
  ruleHolds: boolean | null;
};

/**
 * The Network Sustainability Mechanism at one block: the balance consensus
 * holds out of circulation, how it got there and when it starts coming back.
 */
export type NsmSnapshot = NetworkFreshness & {
  source: NetworkSource;
  /** The node's best block; the balance is the one after this block. */
  height: number;
  /** That block's own timestamp. */
  observedAt: string;
  targetBlockSeconds: number;
  balanceZat: number;
  /** INITIAL_NSM_VALUE_BALANCE credited at NU7 (ZIP 237). */
  seedZat: number;
  /** Removed from circulation since NU7; all of it from fees until reissuance. */
  addedZat: number;
  blocksSinceActivation: number;
  averagePerBlockZat: number;
  averagePerDayZat: number;
  reissuance: {
    height: number;
    blocksRemaining: number;
    estimatedAt: string;
    /** What one block would reissue from today's balance, once it starts. */
    perBlockAtBalanceZat: number;
  };
  /** Most recent first, stale blocks left out. */
  blocks: NsmBlock[];
};

const STALE_AFTER_MS = 15 * 60_000;

function feeSplit(block: ApiBlock): NsmBlock {
  const feesZat = block.transaction_fees_zatoshis ?? null;
  const nsmZat = block.nsm_fee_contribution_zatoshis ?? null;
  const minerFeesZat = block.miner_fee_share_zatoshis ?? null;
  return {
    height: block.height,
    time: new Date(block.time * 1_000).toISOString(),
    feesZat,
    nsmZat,
    minerFeesZat,
    ruleHolds:
      feesZat === null || nsmZat === null
        ? null
        : nsmFeeContribution(block.height, feesZat) === nsmZat &&
          (minerFeesZat === null ||
            nsmMinerFees(block.height, feesZat) === minerFeesZat),
  };
}

/**
 * Null when the feed is down, the node has not reached NU7 or the figure it
 * reports cannot be the balance: unavailable is shown as such, not as zero.
 */
export async function getNsmSnapshot(): Promise<NsmSnapshot | null> {
  const reading = await getDashboardReading();
  if (!reading) return null;
  const { info, recent_blocks: recent } = reading.data;
  const height = info.best_block;
  const balanceZat = info.nsm_value_balance_zat ?? null;
  if (balanceZat === null || height < NSM.activationHeight) return null;
  // Before reissuance the balance can only grow from its seed.
  if (height < NSM.reissuanceHeight && balanceZat < NSM.initialBalanceZat) {
    return null;
  }

  const current = recent
    .filter((block) => block.status?.toUpperCase() !== "STALE")
    .sort((a, b) => b.height - a.height);
  const latest = current[0];
  if (!latest) return null;

  const addedZat = balanceZat - NSM.initialBalanceZat;
  const blocksSinceActivation = height - NSM.activationHeight + 1;
  const averagePerBlockZat = addedZat / blocksSinceActivation;
  const blocksRemaining = Math.max(0, NSM.reissuanceHeight - height);
  const synced =
    info.status === "synced" && Math.abs(info.chain_tip - info.best_block) <= 1;

  return {
    source: NETWORK_SOURCE,
    fetchedAt: reading.fetchedAt,
    stale:
      reading.stale ||
      !synced ||
      Date.now() - latest.time * 1_000 > STALE_AFTER_MS,
    height,
    observedAt: new Date(latest.time * 1_000).toISOString(),
    targetBlockSeconds: info.target_block_spacing_secs,
    balanceZat,
    seedZat: NSM.initialBalanceZat,
    addedZat,
    blocksSinceActivation,
    averagePerBlockZat,
    averagePerDayZat: averagePerBlockZat * blocksPerDay(height),
    reissuance: {
      height: NSM.reissuanceHeight,
      blocksRemaining,
      estimatedAt: new Date(
        (latest.time + targetSecondsBetween(height, NSM.reissuanceHeight)) *
          1_000,
      ).toISOString(),
      perBlockAtBalanceZat: nsmReissuance(NSM.reissuanceHeight, balanceZat),
    },
    blocks: current.map(feeSplit),
  };
}
