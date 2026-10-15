import "server-only";
import { inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zarvisUsage } from "@/lib/db/schema";
import { blockedBucket, usageBuckets, type UsageLimits } from "./limits";
import { zarvisConfig } from "./config";

export type Allowance = { allowed: true; retryAfter: 0; refund?: () => Promise<boolean> } | { allowed: false; retryAfter: number };
/** Durable, atomic limits shared across replicas; failures close the paid API. The reservation is charged up front; `refund` gives it back when the answer never called the model. */
export async function reserveZarvisRequest(headers: Headers): Promise<Allowance> {
  return reserve(headers, zarvisConfig(), "chat");
}
/** Dictation has its own counters: a spoken question costs one transcription unit here and, once sent, one chat unit as usual. */
export async function reserveVoiceRequest(headers: Headers, limits: UsageLimits): Promise<Allowance> {
  return reserve(headers, limits, "voice");
}
async function reserve(headers: Headers, limits: UsageLimits, scope: "chat" | "voice"): Promise<Allowance> {
  const config = zarvisConfig();
  // Explicit loopback testing or a time-bounded server launch window; existing counters stay intact.
  if (config.unlimitedLocalTesting || config.quotaPause.active) return { allowed: true, retryAfter: 0 };
  // Advisory network limit only: global caps still apply if a proxy header is spoofed.
  const network = (headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim().slice(0, 80);
  const now = Date.now();
  const buckets = usageBuckets(network, config.hmacSecret, now, limits, scope);
  const refund = () => refundZarvisRequest(buckets.map((b) => b.key));
  return getDb().transaction(async (tx): Promise<Allowance> => {
    await tx.execute(sql`set local statement_timeout = '4000ms'`);
    await tx.execute(sql`select pg_advisory_xact_lock(937231, 1)`);
    await tx.delete(zarvisUsage).where(lt(zarvisUsage.expiresAt, new Date(now)));
    const rows = await tx.select().from(zarvisUsage).where(inArray(zarvisUsage.key, buckets.map((b) => b.key)));
    const blocked = blockedBucket(buckets, new Map(rows.map((r) => [r.key, r.count])));
    if (blocked) return { allowed: false, retryAfter: Math.max(1, Math.ceil((blocked.expiresAt.getTime() - now) / 1000)) };
    await tx.insert(zarvisUsage).values(buckets.map(({ key, expiresAt }) => ({ key, count: 1, expiresAt })))
      .onConflictDoUpdate({ target: zarvisUsage.key, set: { count: sql`${zarvisUsage.count} + 1` } });
    return { allowed: true, retryAfter: 0, refund };
  });
}
/** Gives a reservation back: a direct answer made no model call, so it costs the visitor no quota. Never throws; a failed refund only leaves one unit charged. */
export async function refundZarvisRequest(keys: string[]): Promise<boolean> {
  if (!keys.length) return true;
  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`set local statement_timeout = '3000ms'`);
      await tx.update(zarvisUsage).set({ count: sql`greatest(${zarvisUsage.count} - 1, 0)` }).where(inArray(zarvisUsage.key, keys));
    });
    return true;
  } catch { return false; }
}
