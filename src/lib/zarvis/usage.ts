import "server-only";
import { inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zarvisUsage } from "@/lib/db/schema";
import { blockedBucket, usageBuckets } from "./limits";
import { zarvisConfig } from "./config";

/** Durable, atomic limits shared across replicas; failures close the paid API. */
export async function reserveZarvisRequest(headers: Headers) {
  const config = zarvisConfig();
  // Advisory network limit only: global caps still apply if a proxy header is spoofed.
  const network = (headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim().slice(0, 80);
  const now = Date.now();
  const buckets = usageBuckets(network, config.apiKey, now, config);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '4000ms'`);
    await tx.execute(sql`select pg_advisory_xact_lock(937231, 1)`);
    await tx.delete(zarvisUsage).where(lt(zarvisUsage.expiresAt, new Date(now)));
    const rows = await tx.select().from(zarvisUsage).where(inArray(zarvisUsage.key, buckets.map((b) => b.key)));
    const blocked = blockedBucket(buckets, new Map(rows.map((r) => [r.key, r.count])));
    if (blocked) return { allowed: false, retryAfter: Math.max(1, Math.ceil((blocked.expiresAt.getTime() - now) / 1000)) };
    await tx.insert(zarvisUsage).values(buckets.map(({ key, expiresAt }) => ({ key, count: 1, expiresAt })))
      .onConflictDoUpdate({ target: zarvisUsage.key, set: { count: sql`${zarvisUsage.count} + 1` } });
    return { allowed: true, retryAfter: 0 };
  });
}
