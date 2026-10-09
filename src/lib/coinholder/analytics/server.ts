import "server-only";
import { createHash } from "node:crypto";
import rawSnapshot from "../../../../data/coinholder/q3-2026-summary.json";
import provenance from "../../../../data/coinholder/q3-2026-provenance.json";
import activitySnapshot from "../../../../data/coinholder/activity-q3-2026.json";
import activityTransactions from "../../../../data/coinholder/activity-q3-2026-transactions.json";
import revealSnapshot from "../../../../data/coinholder/q3-2026-reveals.json";
import { parseCoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";
import { findVerifiableRound, verifyRound } from "@/lib/coinholder/verify";
import { verifyJson } from "@/lib/coinholder/verify-export";
import {
  buildCoinholderDashboard, parseCoinholderActivity, COINHOLDER_METADATA_URL, COINHOLDER_SUMMARY_SHA256, COINHOLDER_SUMMARY_URLS,
  type CoinholderDashboard, type CoinholderActivity, type CoinholderActivitySeries
} from "@/lib/coinholder/analytics/model";

const REFRESH_MS = 60_000;
const MAX_RESPONSE_BYTES = 256_000;
const TIMEOUT_MS = 6_000;
// Use the same local source as OpenZcash's verification pages, without an HTTP self-request.
const round = findVerifiableRound("q3-2026");
if (!round) throw new Error("Missing Q3 2026 Coinholder round");
const metadata = verifyJson(round, verifyRound(round), null);

/** Keep all transaction reconciliation server-side; charts need only buckets and coverage. */
export function projectCoinholderActivity(activity: CoinholderActivity): CoinholderActivitySeries {
  const { transactions, recentTransactions, evidence, ...series } = activity;
  void transactions;
  void recentTransactions;
  void evidence;
  return series;
}

// Validate every transaction and bucket before reducing the browser payload.
const historicalActivity = projectCoinholderActivity(parseCoinholderActivity(activitySnapshot, activityTransactions));
const historicalReveals = (() => {
  try {
    return parseCoinholderRevealHistory(revealSnapshot, rawSnapshot);
  } catch {
    console.warn("Coinholder revealed-share history failed validation; history is unavailable.");
    return null;
  }
})();

async function readBoundedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("Summary exceeds size limit");
  if (!response.body) throw new Error("Missing summary body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw new Error("Summary exceeds size limit");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** Isolated reader factory makes refresh, outage and response limits testable without live calls. */
export function createCoinholderReader(dependencies: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  let cache: { dashboard: CoinholderDashboard; expiresAt: number } | null = null;
  let pending: Promise<CoinholderDashboard> | null = null;
  let lastGood: CoinholderDashboard | null = null;

  const snapshot = (checkedAt: string): CoinholderDashboard => buildCoinholderDashboard(rawSnapshot, metadata, {
    state: "snapshot", checkedAt, snapshotFetchedAt: provenance.fetchedAt,
    sha256: provenance.summarySha256, url: provenance.summaryUrl, metadataUrl: COINHOLDER_METADATA_URL,
    warning: "The source could not be matched on this check. Showing the dated Q3 2026 snapshot."
  }, historicalActivity, historicalReveals);

  async function refresh(): Promise<CoinholderDashboard> {
    const checkedAt = new Date(now()).toISOString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const attempts = COINHOLDER_SUMMARY_URLS.map(async (url) => {
        const response = await fetcher(url, {
          headers: { Accept: "application/json" }, signal: controller.signal,
          cache: "no-store", redirect: "error"
        });
        if (!response.ok) throw new Error("Summary source unavailable");
        const body = await readBoundedBody(response);
        const sha256 = createHash("sha256").update(body).digest("hex");
        // This adapter is pinned to a finalized historical round, not arbitrary future elections.
        if (sha256 !== COINHOLDER_SUMMARY_SHA256) throw new Error("Historical summary changed");
        return buildCoinholderDashboard(JSON.parse(body.toString("utf8")), metadata, {
          state: "verified", checkedAt, snapshotFetchedAt: new Date(now()).toISOString(),
          sha256, url, metadataUrl: COINHOLDER_METADATA_URL, warning: null
        }, historicalActivity, historicalReveals);
      });
      const dashboard = await Promise.any(attempts);
      lastGood = dashboard;
      return dashboard;
    } catch {
      if (lastGood) return {
        ...lastGood,
        source: { ...lastGood.source, state: "snapshot", checkedAt, warning: "The source could not be matched on this check. Showing the last matched Q3 2026 snapshot." }
      };
      return snapshot(checkedAt);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  return async function readCoinholderDashboard(): Promise<CoinholderDashboard> {
    if (cache && cache.expiresAt > now()) return cache.dashboard;
    if (pending) return pending;
    pending = refresh().then((dashboard) => {
      cache = { dashboard, expiresAt: now() + REFRESH_MS };
      return dashboard;
    }).finally(() => { pending = null; });
    return pending;
  };
}

export const readCoinholderDashboard = createCoinholderReader();
