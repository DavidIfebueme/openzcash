import "server-only";
import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zarvisCanary, zarvisFeedbackReasons, zarvisMetricsDaily, zarvisTopicDaily } from "@/lib/db/schema";
import type { FeedbackReason } from "./feedback";

/** Durable daily counters and canary records in Postgres. Every write is fire-and-forget and short; nothing here delays or fails an answer. */
export const LATENCY_BOUNDS_MS = [250, 1000, 3000, 5000, 10000, 20000, 40000, 60000, Infinity];
export type DailyRoute = "local" | "model" | "rejected" | "voice";
export const DAILY_COUNTERS = ["completed", "failed", "aborted", "quota", "busy", "spendCap", "modelCalls", "webSearchCalls", "inputTokens", "cachedInputTokens", "outputTokens", "groundingFallbacks", "unpricedRequests", "helpful", "unhelpful"] as const;
export type DailyCounter = typeof DAILY_COUNTERS[number];
export type DailyDelta = Partial<Record<DailyCounter, number>> & { estimatedUsd?: number; latencyMs?: number };
type Row = Record<DailyCounter, number> & { estimatedUsd: number; latency: number[] };
export type CanaryRecord = { at: string; ok: boolean; passed: number; failed: number; ms: number; failedCases: string[] };
type Spend = { day: string; dbUsd: number; flushedUsd: number; unwrittenUsd: number; readAt: number; reading: boolean };
type StoreState = { pending: Map<string, Row>; pendingReasons: Map<string, number>; pendingTopics: Map<string, number>; timer: ReturnType<typeof setTimeout> | null; spend: Spend; writeFailures: number; readFailures: number; lastFlushAt: number | null; canary: CanaryRecord | null; canaryReadAt: number };
const FLUSH_MS = 5_000, SPEND_REFRESH_MS = 30_000, CANARY_CACHE_MS = 60_000;
const globalState = globalThis as typeof globalThis & { __zarvisMetricsStoreV1?: StoreState };
const state: StoreState = globalState.__zarvisMetricsStoreV1 ??= { pending: new Map(), pendingReasons: new Map(), pendingTopics: new Map(), timer: null, spend: { day: "", dbUsd: 0, flushedUsd: 0, unwrittenUsd: 0, readAt: 0, reading: false }, writeFailures: 0, readFailures: 0, lastFlushAt: null, canary: null, canaryReadAt: 0 };
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const latencyBucket = (ms: number) => LATENCY_BOUNDS_MS.findIndex((bound) => ms <= bound);
export function percentile(latency: number[], q: number): number | null {
  const total = latency.reduce((sum, count) => sum + count, 0); if (!total) return null;
  let seen = 0;
  for (let i = 0; i < latency.length; i++) { seen += latency[i]; if (seen >= total * q) return Number.isFinite(LATENCY_BOUNDS_MS[i]) ? LATENCY_BOUNDS_MS[i] : null; }
  return null;
}
const emptyRow = (): Row => ({ ...(Object.fromEntries(DAILY_COUNTERS.map((key) => [key, 0])) as Record<DailyCounter, number>), estimatedUsd: 0, latency: LATENCY_BOUNDS_MS.map(() => 0) });
/** Counts every miss; the first of each kind per process is also logged with the error class only, so a migration that did not apply is visible without the admin endpoint. */
function noteStoreFailure(op: "write" | "read", error: unknown) {
  const count = op === "write" ? ++state.writeFailures : ++state.readFailures;
  if (count === 1) console.warn(JSON.stringify({ event: "zarvis.store", op, errorClass: error instanceof Error ? error.name : "unknown" }));
}
const shortStatement = (tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) => tx.execute(sql`set local statement_timeout = '3000ms'`);

/** Buffers a delta for the UTC day and route; flushed to Postgres a few seconds later. */
export function queueDaily(route: DailyRoute, delta: DailyDelta, now = Date.now()) {
  const key = `${utcDay(now)}|${route}`;
  const row = state.pending.get(key) ?? emptyRow();
  for (const counter of DAILY_COUNTERS) row[counter] += delta[counter] ?? 0;
  row.estimatedUsd += delta.estimatedUsd ?? 0;
  if (delta.latencyMs !== undefined) row.latency[latencyBucket(delta.latencyMs)]++;
  state.pending.set(key, row);
  if (!state.timer) { state.timer = setTimeout(() => { state.timer = null; void flushDaily(); }, FLUSH_MS); state.timer.unref?.(); }
}
/** Buffers one "Needs work" reason for the UTC day and route; flushed with the daily counters. */
export function queueFeedbackReason(route: "local" | "model", reason: FeedbackReason, now = Date.now()) {
  const key = `${utcDay(now)}|${route}|${reason}`;
  state.pendingReasons.set(key, (state.pendingReasons.get(key) ?? 0) + 1);
  if (!state.timer) { state.timer = setTimeout(() => { state.timer = null; void flushDaily(); }, FLUSH_MS); state.timer.unref?.(); }
}
/** Buffers one answered question's subject for the UTC day; the label comes from the fixed taxonomy in topics.ts, never from the text. */
export function queueTopic(route: "local" | "model", topic: string, lang: string, now = Date.now()) {
  state.pendingTopics ??= new Map();
  const key = `${utcDay(now)}|${route}|${topic}|${lang}`;
  state.pendingTopics.set(key, (state.pendingTopics.get(key) ?? 0) + 1);
  if (!state.timer) { state.timer = setTimeout(() => { state.timer = null; void flushDaily(); }, FLUSH_MS); state.timer.unref?.(); }
}
export async function flushDaily(): Promise<boolean> {
  if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  // Rows are upserted in key order so two overlapping flushes (a second replica, or a slow flush) never deadlock on each other's locks.
  const batch = [...state.pending].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); state.pending = new Map();
  const reasons = [...state.pendingReasons].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); state.pendingReasons = new Map();
  const topics = [...(state.pendingTopics ?? [])].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); state.pendingTopics = new Map();
  if (!batch.length && !reasons.length && !topics.length) return true;
  const t = zarvisMetricsDaily, r = zarvisFeedbackReasons, p = zarvisTopicDaily;
  try {
    await getDb().transaction(async (tx) => {
      await shortStatement(tx);
      for (const [key, row] of batch) {
        const [day, route] = key.split("|");
        await tx.insert(t).values({ day, route, ...row }).onConflictDoUpdate({ target: [t.day, t.route], set: {
          ...Object.fromEntries(DAILY_COUNTERS.map((counter) => [counter, sql`${t[counter]} + excluded.${sql.raw(t[counter].name)}`])),
          estimatedUsd: sql`${t.estimatedUsd} + excluded.estimated_usd`,
          latency: sql`array(select coalesce(a, 0) + coalesce(b, 0) from unnest(${t.latency}, excluded.latency) with ordinality as u(a, b, i) order by i)`,
          updatedAt: sql`now()`,
        } });
      }
      for (const [key, count] of reasons) {
        const [day, route, reason] = key.split("|");
        await tx.insert(r).values({ day, route, reason, count }).onConflictDoUpdate({ target: [r.day, r.route, r.reason], set: { count: sql`${r.count} + excluded.count`, updatedAt: sql`now()` } });
      }
      for (const [key, count] of topics) {
        const [day, route, topic, lang] = key.split("|");
        await tx.insert(p).values({ day, route, topic, lang, count }).onConflictDoUpdate({ target: [p.day, p.route, p.topic, p.lang], set: { count: sql`${p.count} + excluded.count`, updatedAt: sql`now()` } });
      }
    });
    const spend = spendState(Date.now());
    for (const [key, row] of batch) if (key.startsWith(spend.day)) spend.flushedUsd += row.estimatedUsd;
    state.lastFlushAt = Date.now();
    return true;
  } catch (error) {
    // Dropped rows still count toward this process's spend estimate for the rest of the day.
    noteStoreFailure("write", error);
    const spend = spendState(Date.now());
    for (const [key, row] of batch) if (key.startsWith(spend.day)) spend.unwrittenUsd += row.estimatedUsd;
    return false;
  }
}
function spendState(now: number): Spend {
  const day = utcDay(now);
  if (state.spend.day !== day) state.spend = { day, dbUsd: 0, flushedUsd: 0, unwrittenUsd: 0, readAt: 0, reading: false };
  return state.spend;
}
function refreshSpend(now: number) {
  const spend = spendState(now);
  if (spend.reading || now - spend.readAt < SPEND_REFRESH_MS) return;
  spend.reading = true;
  (async () => {
    try {
      const rows = await getDb().transaction(async (tx) => { await shortStatement(tx); return tx.select({ usd: sql<number | string>`coalesce(sum(${zarvisMetricsDaily.estimatedUsd}), 0)` }).from(zarvisMetricsDaily).where(eq(zarvisMetricsDaily.day, spend.day)); });
      if (spendState(Date.now()) === spend) { spend.dbUsd = Number(rows[0]?.usd ?? 0); spend.flushedUsd = 0; }
    } catch (error) { noteStoreFailure("read", error); }
    finally { spend.readAt = Date.now(); spend.reading = false; }
  })();
}
/** Approximate estimated spend for the current UTC day: the durable total (refreshed in the background) plus usage this process has not flushed yet. */
export function spendTodayUsd(now = Date.now()): number {
  const spend = spendState(now); refreshSpend(now);
  const pending = [...state.pending].filter(([key]) => key.startsWith(spend.day)).reduce((sum, [, row]) => sum + row.estimatedUsd, 0);
  return spend.dbUsd + spend.flushedUsd + spend.unwrittenUsd + pending;
}
export async function dailyMetrics(days = 14, now = Date.now()) {
  const since = utcDay(now - (days - 1) * 86_400_000);
  const rows = await getDb().transaction(async (tx) => { await shortStatement(tx); return tx.select().from(zarvisMetricsDaily).where(gte(zarvisMetricsDaily.day, since)).orderBy(desc(zarvisMetricsDaily.day), zarvisMetricsDaily.route); });
  return rows.map((row) => ({ ...row, p50BucketUpperMs: percentile(row.latency, 0.5), p95BucketUpperMs: percentile(row.latency, 0.95) }));
}
/** "Needs work" reasons over the last days, newest day first: counts per day, route and reason. */
/** Subject counts for the last days, newest first; labels only. */
export async function topicCounts(days = 14, now = Date.now()) {
  const since = utcDay(now - (days - 1) * 86_400_000);
  return getDb().transaction(async (tx) => { await shortStatement(tx); return tx.select({ day: zarvisTopicDaily.day, route: zarvisTopicDaily.route, topic: zarvisTopicDaily.topic, lang: zarvisTopicDaily.lang, count: zarvisTopicDaily.count }).from(zarvisTopicDaily).where(gte(zarvisTopicDaily.day, since)).orderBy(desc(zarvisTopicDaily.day), desc(zarvisTopicDaily.count)); });
}
export async function feedbackReasons(days = 14, now = Date.now()) {
  const since = utcDay(now - (days - 1) * 86_400_000);
  return getDb().transaction(async (tx) => { await shortStatement(tx); return tx.select({ day: zarvisFeedbackReasons.day, route: zarvisFeedbackReasons.route, reason: zarvisFeedbackReasons.reason, count: zarvisFeedbackReasons.count }).from(zarvisFeedbackReasons).where(gte(zarvisFeedbackReasons.day, since)).orderBy(desc(zarvisFeedbackReasons.day), zarvisFeedbackReasons.route, zarvisFeedbackReasons.reason); });
}
export async function recordCanary(result: CanaryRecord): Promise<boolean> {
  state.canary = result; state.canaryReadAt = Date.now();
  try {
    await getDb().transaction(async (tx) => { await shortStatement(tx); await tx.insert(zarvisCanary).values({ ranAt: new Date(result.at), ok: result.ok, passed: result.passed, failed: result.failed, ms: result.ms, failedCases: result.failedCases }); });
    return true;
  } catch (error) { noteStoreFailure("write", error); return false; }
}
export async function latestCanary(now = Date.now()): Promise<CanaryRecord | null> {
  if (now - state.canaryReadAt < CANARY_CACHE_MS) return state.canary;
  state.canaryReadAt = now;
  try {
    const rows = await getDb().transaction(async (tx) => { await shortStatement(tx); return tx.select().from(zarvisCanary).orderBy(desc(zarvisCanary.ranAt)).limit(1); });
    const row = rows[0];
    if (row && (!state.canary || row.ranAt.toISOString() >= state.canary.at)) state.canary = { at: row.ranAt.toISOString(), ok: row.ok, passed: row.passed, failed: row.failed, ms: row.ms, failedCases: row.failedCases };
  } catch (error) { noteStoreFailure("read", error); }
  return state.canary;
}
export function storeState() {
  return { pendingRows: state.pending.size + state.pendingReasons.size + (state.pendingTopics?.size ?? 0), writeFailures: state.writeFailures, readFailures: state.readFailures, lastFlushAt: state.lastFlushAt ? new Date(state.lastFlushAt).toISOString() : null, spendReadAt: state.spend.readAt ? new Date(state.spend.readAt).toISOString() : null };
}
export function resetStoreForTests() {
  if (state.timer) clearTimeout(state.timer);
  state.pendingReasons = new Map(); state.pendingTopics = new Map();
  state.pending = new Map(); state.timer = null; state.spend = { day: "", dbUsd: 0, flushedUsd: 0, unwrittenUsd: 0, readAt: 0, reading: false };
  state.writeFailures = 0; state.readFailures = 0; state.lastFlushAt = null; state.canary = null; state.canaryReadAt = 0;
}
