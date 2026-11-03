import "server-only";
import { and, eq, inArray, like, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zarvisUsage } from "@/lib/db/schema";
import { xResearchConfig } from "./x-research-config";
import { X_RESEARCH_CACHE_MS, X_RESEARCH_TOPICS, type XResearchTopic } from "./x-research-policy";

const DAY_MS = 86_400_000;
const MICROS = 1_000_000;
const RESERVATION_USD = 0.25;
export type XResearchReservation = { settle: (reportedUsd: number | null) => Promise<void> };
/**
 * Cross-replica call caps, topic cooldown and a single daily lease. No testing/launch bypass.
 * Reserve before HTTP. Unknown cost or a crashed owner closes further paid research for the UTC day.
 * The provider may bill beyond the reservation; a provider-side cap is still needed for a hard dollar ceiling.
 */
export async function reserveXResearch(topic: XResearchTopic, now = Date.now()): Promise<XResearchReservation | null> {
  const config = xResearchConfig();
  if (!config.enabled || !X_RESEARCH_TOPICS.includes(topic)) return null;
  const day = Math.floor(now / DAY_MS), hour = Math.floor(now / 3_600_000), slot = Math.floor(now / X_RESEARCH_CACHE_MS);
  const expiry = new Date((day + 1) * DAY_MS);
  const budgetKey = `x-research:budget:${day}`, leaseKey = `x-research:lease:${day}`;
  const cap = Math.floor(config.dailyUsdCap * MICROS);
  const reserved = Math.min(Math.ceil(RESERVATION_USD * MICROS), cap);
  const buckets = [
    { key: `x-research:day:${day}`, limit: config.dailyLimit, amount: 1, expiresAt: expiry },
    { key: `x-research:hour:${hour}`, limit: config.hourlyLimit, amount: 1, expiresAt: new Date((hour + 1) * 3_600_000) },
    { key: `x-research:topic:${topic}:${slot}`, limit: 1, amount: 1, expiresAt: new Date((slot + 1) * X_RESEARCH_CACHE_MS) },
    { key: leaseKey, limit: 1, amount: 1, expiresAt: expiry },
    { key: budgetKey, limit: cap, amount: reserved, expiresAt: expiry },
  ];
  const admitted = await getDb().transaction(async tx => {
    await tx.execute(sql`set local statement_timeout = '4000ms'`);
    await tx.execute(sql`select pg_advisory_xact_lock(937231, 2)`);
    await tx.delete(zarvisUsage).where(and(like(zarvisUsage.key, "x-research:%"), lt(zarvisUsage.expiresAt, new Date(now))));
    const rows = await tx.select().from(zarvisUsage).where(inArray(zarvisUsage.key, buckets.map(b => b.key)));
    const counts = new Map(rows.map(row => [row.key, row.count]));
    if (buckets.some(b => (counts.get(b.key) ?? 0) + b.amount > b.limit)) return false;
    for (const b of buckets) await tx.insert(zarvisUsage).values({ key: b.key, count: b.amount, expiresAt: b.expiresAt })
      .onConflictDoUpdate({ target: zarvisUsage.key, set: { count: sql`${zarvisUsage.count} + ${b.amount}` } });
    return true;
  });
  if (!admitted) return null;
  let settled = false;
  return { async settle(reportedUsd) {
    if (settled) return;
    settled = true;
    const known = reportedUsd !== null && Number.isFinite(reportedUsd) && reportedUsd >= 0;
    // Saturation only affects enforcement: an over-cap bill remains reported in metrics at its full value.
    const actual = known ? Math.min(cap, Math.ceil(reportedUsd * MICROS)) : cap;
    await getDb().transaction(async tx => {
      await tx.execute(sql`set local statement_timeout = '4000ms'`);
      await tx.execute(sql`select pg_advisory_xact_lock(937231, 2)`);
      await tx.update(zarvisUsage).set({ count: sql`least(${cap}, greatest(0, ${zarvisUsage.count} - ${reserved} + ${actual}))` }).where(eq(zarvisUsage.key, budgetKey));
      await tx.delete(zarvisUsage).where(eq(zarvisUsage.key, leaseKey));
    });
  } };
}
