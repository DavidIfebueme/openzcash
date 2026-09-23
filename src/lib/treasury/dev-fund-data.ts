import "server-only";
import { latestSnapshot } from "@/lib/zcg/snapshots-repo";
import { currentLockboxZec } from "@/lib/zcash/lockbox-live";
import { ZCG_GIDS, ZCG_SHEET_ID } from "@/lib/zcg/sheets";
import type { DevFundReportedData } from "./dev-fund";

const sourceUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${ZCG_SHEET_ID}/edit#gid=${gid}`;

/** Read the same reported balances as TreasuryOverview; never invent defaults. */
export async function reportedDevFundData(): Promise<DevFundReportedData> {
  const [zcgResult, lockboxResult] = await Promise.allSettled([
    latestSnapshot("zcg_operating"),
    currentLockboxZec(),
  ]);
  const zcg = zcgResult.status === "fulfilled" ? zcgResult.value : null;
  const lockbox = lockboxResult.status === "fulfilled" ? lockboxResult.value : null;

  return {
    zcg: zcg ? {
      paidMilestonesUsd: zcg.usdMilestonesPaidCents === null ? null : Number(zcg.usdMilestonesPaidCents) / 100,
      zec: zcg.zecBalanceZat === null ? null : Number(zcg.zecBalanceZat) / 1e8,
      cashUsd: zcg.usdCashBalanceCents === null ? null : Number(zcg.usdCashBalanceCents) / 100,
      snapshotAt: zcg.capturedAt.toISOString(),
      importedAt: zcg.importedAt.toISOString(),
      updatesRequired: zcg.status === "updates_required",
      sourceUrl: sourceUrl(ZCG_GIDS.zcgBalance),
    } : null,
    lockbox: lockbox ? {
      zec: Number(lockbox.zat) / 1e8,
      height: lockbox.height,
      baselineHeight: lockbox.baselineHeight,
      snapshotAt: lockbox.snap.capturedAt.toISOString(),
      importedAt: lockbox.snap.importedAt.toISOString(),
      updatesRequired: lockbox.snap.status === "updates_required",
      sourceUrl: sourceUrl(ZCG_GIDS.lockboxBalance),
    } : null,
  };
}
