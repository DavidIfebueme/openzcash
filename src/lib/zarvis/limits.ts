import { createHmac } from "node:crypto";
export type UsageBucket = { key: string; limit: number; expiresAt: Date };
export type UsageLimits = { dailyLimit: number; hourlyLimit: number; networkDailyLimit: number; networkWindowLimit: number };
/** Chat buckets keep their original keys; dictation counts under its own prefix so it never spends the chat quota. */
export function usageBuckets(network: string, secret: string, now: number, limits: UsageLimits, scope: "chat" | "voice" = "chat"): UsageBucket[] {
  const day = Math.floor(now / 86_400_000);
  // A daily keyed digest, never a raw IP. This is a pseudonymous abuse counter.
  const digest = createHmac("sha256", secret).update(`zarvis:${day}:${network}`).digest("hex").slice(0, 32);
  const prefix = scope === "chat" ? "" : `${scope}:`;
  const bucket = (label: string, period: number, limit: number): UsageBucket => ({
    key: `${prefix}${label}:${Math.floor(now / period)}`, limit,
    expiresAt: new Date((Math.floor(now / period) + 1) * period),
  });
  return [
    bucket("global:day", 86_400_000, limits.dailyLimit),
    bucket("global:hour", 3_600_000, limits.hourlyLimit),
    bucket(`network:${digest}:day`, 86_400_000, limits.networkDailyLimit),
    bucket(`network:${digest}:window`, 600_000, limits.networkWindowLimit),
  ];
}
export function blockedBucket(buckets: UsageBucket[], counts: Map<string, number>) {
  return buckets.find((b) => (counts.get(b.key) ?? 0) >= b.limit);
}
