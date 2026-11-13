import "server-only";
import { latestSnapshot } from "@/lib/zcg/snapshots-repo";
import { currentLockboxZec } from "@/lib/zcash/lockbox-live";
import { getNsmSnapshot } from "@/lib/network/nsm";
import { currentZecUsdCents, zatToUsdCents } from "@/lib/pricing/live-price";
import { formatUsdCents } from "@/lib/zcg/format";
import { formatZec } from "@/lib/zcash/units";
import { cached } from "@/lib/cache/memo";

/**
 * The pools the shell's treasury bar shows, valued at the live price: the two
 * the ZCG spreadsheet tracks (the operating Coinbase balance and the ZIP-1016
 * Lockbox / Coinholder pool) and the NSM value balance consensus holds out of
 * circulation since NU7 (ZIP 237). One cached
 * projection, so every page shows the same figures.
 */
export type TreasuryPool = {
  name: string;
  tag: string;
  href: string;
  /** Formatted ZEC balance, no symbol. */
  zec: string;
  /** Formatted USD valuation (compact); null when no price is available. */
  usd: string | null;
  /** Extra line, e.g. USD cash held alongside the ZEC. */
  sub?: string;
  /** The same figures unabridged, for the bar's tooltip. */
  exact: string;
  /** The sheet's own "Block time (UTC)" (ISO), the closest record of when ZCG
   *  filled it; absent when the sheet gives none (our import time is never a
   *  stand-in). Set only for sheet-read pools. */
  blockTime?: string;
  /** The sheet's own "Status: Updates required" banner. */
  updatesRequired?: boolean;
  /** Present only when the figure is stale or flagged; absent when fresh. */
  asOf?: FreshnessNote;
};

/** A quiet date note for a sheet figure that may no longer be current. */
export type FreshnessNote = {
  /** Block-time day, UTC, e.g. "Sep 23", shown as "as of Sep 23"; null when
   *  the sheet gives no readable block time (shown as "undated"). */
  date: string | null;
  /** Tooltip, e.g. "ZCG's sheet: updates required · captured 2026-09-23 20:16 UTC". */
  title: string;
};

export type TreasurySummary = {
  operating: TreasuryPool | null;
  lockbox: TreasuryPool | null;
  /** The NSM value balance; null (never zero) when the node feed has none. */
  nsm: TreasuryPool | null;
  /** Chain height the figures refer to, formatted with separators. */
  height: string | null;
  /** ZEC/USD price used for the valuation, formatted. */
  price: string | null;
};

const TTL_MS = 60_000;

/**
 * How long the bar waits for the node feed before showing the other pools
 * without the NSM. The feed's own timeout is longer; a cold or slow read must
 * not hold back figures that never needed it.
 */
export const NSM_WAIT_MS = 2_500;

/** The promise's value, or null once `ms` have passed or it has failed. */
function within<T>(ms: number, promise: Promise<T>): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * The import runs every 6 h, so a sheet figure older than two days means ZCG
 * has not refilled its tab, not that we missed a run.
 */
export const SHEET_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "Sep 23", or "Dec 30, 2025" outside the current year; UTC calendar. */
function shortUtcDate(d: Date, now: Date): string {
  const day = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === now.getUTCFullYear()
    ? day
    : `${day}, ${d.getUTCFullYear()}`;
}

/** "2026-09-23 20:16 UTC". */
function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/**
 * Freshness rule for a figure read from ZCG's sheet, dated by the sheet's own
 * block time (the import stamps `capturedAt` with our import time when that
 * cell is blank, which says nothing about when ZCG filled it): null (say
 * nothing) while it is at most 48 h old and not flagged; otherwise its day,
 * with the sheet's "updates required" flag in the tooltip when set. A missing
 * or unreadable block time means the age is unknown, never fresh.
 */
export function sheetFreshnessNote(
  snap: { blockTime: Date | null; status: string | null },
  now: Date,
): FreshnessNote | null {
  const flag = snap.status === "updates_required" ? ": updates required" : "";
  const at = snap.blockTime?.getTime() ?? Number.NaN;
  if (!snap.blockTime || !Number.isFinite(at)) {
    return { date: null, title: `ZCG's sheet${flag} · capture time unknown` };
  }
  if (!flag && now.getTime() - at <= SHEET_STALE_AFTER_MS) return null;
  return {
    date: shortUtcDate(snap.blockTime, now),
    title: `ZCG's sheet${flag} · captured ${utcStamp(snap.blockTime)}`,
  };
}

/**
 * A pool's ZEC as the bar shows it: two decimals, or none for a whole number
 * of ZEC, so neighbouring pools read alike. Since NU7 the Lockbox accrues
 * 0.06249999 ZEC a block, so the full figure has eight decimals; that one
 * stays in the tooltip (`exact`).
 */
const ZAT_PER_ZEC = 100_000_000n;
const barZec = (zat: bigint): string =>
  (Number(zat) / 1e8).toLocaleString("en-US", {
    minimumFractionDigits: zat % ZAT_PER_ZEC === 0n ? 0 : 2,
    maximumFractionDigits: 2,
  });

/** The NSM balance as a pool of the bar: ZEC to the cent, the rest in the tooltip. */
function nsmPool(
  reading: { balanceZat: number; height: number; stale: boolean },
  priceCents: bigint | number | null,
): TreasuryPool {
  const zat = BigInt(reading.balanceZat);
  const usdCents =
    priceCents != null ? zatToUsdCents(zat, priceCents) : null;
  const block = `block ${reading.height.toLocaleString("en-US")}`;
  return {
    name: "NSM · Sustainability",
    tag: "ZIP 237 · in consensus",
    href: "/nsm",
    zec: barZec(zat),
    usd: usdCents != null ? formatUsdCents(usdCents, { compact: true }) : null,
    exact: `${formatZec(zat, { symbol: false })} ZEC${
      usdCents != null ? ` ≈ ${formatUsdCents(usdCents)}` : ""
    }\nOut of circulation by consensus · ${block}${
      reading.stale ? " · last reading, the source is not current" : ""
    }`,
  };
}

async function compute(): Promise<TreasurySummary> {
  const [op, lock, liveCents, nsm] = await Promise.all([
    latestSnapshot("zcg_operating").catch(() => null),
    currentLockboxZec().catch(() => null),
    currentZecUsdCents().catch(() => null),
    within(NSM_WAIT_MS, getNsmSnapshot()),
  ]);

  const height =
    lock?.height ??
    (op?.blockHeight != null ? Number(op.blockHeight) : null) ??
    nsm?.height ??
    null;
  // Live market price preferred; fall back to the spreadsheet's recorded price.
  const priceCents =
    liveCents ?? op?.zecusdPriceCents ?? lock?.snap?.zecusdPriceCents ?? null;

  // Value each pool at the current price (ZEC × live price, + any USD cash).
  const opUsdCents =
    priceCents != null && op?.zecBalanceZat != null
      ? zatToUsdCents(op.zecBalanceZat, priceCents) +
        (op.usdCashBalanceCents ?? 0n)
      : (op?.usdTotalHoldingsCents ?? 0n);
  const opAsOf = op ? sheetFreshnessNote(op, new Date()) : null;
  const lockUsdCents =
    priceCents != null && lock
      ? zatToUsdCents(lock.zat, priceCents)
      : (lock?.snap?.usdTotalHoldingsCents ?? 0n);

  return {
    operating: op
      ? {
          name: "ZCG operating",
          tag: "Coinbase address",
          href: "/zcg/reconciliation",
          zec: formatZec(op.zecBalanceZat ?? 0n, { symbol: false }),
          usd: formatUsdCents(opUsdCents, { compact: true }),
          sub:
            op.usdCashBalanceCents != null
              ? `${formatUsdCents(op.usdCashBalanceCents, { compact: true })} cash`
              : undefined,
          exact: `${formatZec(op.zecBalanceZat ?? 0n, { symbol: false })} ZEC ≈ ${formatUsdCents(opUsdCents)}${
            op.usdCashBalanceCents != null
              ? ` · ${formatUsdCents(op.usdCashBalanceCents)} cash`
              : ""
          }${opAsOf ? `\n${opAsOf.title}` : ""}`,
          blockTime:
            op.blockTime && Number.isFinite(op.blockTime.getTime())
              ? op.blockTime.toISOString()
              : undefined,
          updatesRequired: op.status === "updates_required",
          ...(opAsOf ? { asOf: opAsOf } : {}),
        }
      : null,
    lockbox: lock
      ? {
          name: "Lockbox · Coinholder",
          tag: "ZIP-1016 pool · live",
          href: "/lockbox",
          zec: barZec(lock.zat),
          usd: formatUsdCents(lockUsdCents, { compact: true }),
          exact: `${formatZec(lock.zat, { symbol: false })} ZEC ≈ ${formatUsdCents(lockUsdCents)}`,
        }
      : null,
    nsm: nsm ? nsmPool(nsm, priceCents) : null,
    height: height != null ? Number(height).toLocaleString("en-US") : null,
    price: priceCents != null ? formatUsdCents(priceCents) : null,
  };
}

/** Never throws: a failed source hides the figure, not the page. */
export function getTreasurySummary(): Promise<TreasurySummary | null> {
  return cached("treasury:summary", TTL_MS, compute).catch(() => null);
}
