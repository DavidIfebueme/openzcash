import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgPublications } from "@/lib/db/schema";
import { observePublication, publishedValue, type PublicationState } from "./publication-policy";

type Db = ReturnType<typeof getDb>;
export type PublicationTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Scope = "proposal-status" | "github-application" | "github-decision";
type Observation<T> = { key: string; value: T | null; initial: T | null };

export async function readPublications<T>(scope: Scope, now = new Date()): Promise<Map<string, T | null>> {
  const rows = await getDb().select().from(zcgPublications).where(eq(zcgPublications.scope, scope));
  return new Map(rows.map((row) => [row.key, publishedValue(row as PublicationState<T>, now)]));
}

/** Atomic with the source write. The lock also serializes concurrent refreshes. */
export async function recordPublications<T>(
  tx: PublicationTransaction,
  scope: Scope,
  observations: Observation<T>[],
  { complete = false, now = new Date() }: { complete?: boolean; now?: Date } = {},
): Promise<Map<string, T | null>> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`zcg-publication:${scope}`}))`);
  const rows = await tx.select().from(zcgPublications).where(eq(zcgPublications.scope, scope));
  const states = new Map(rows.map((r) => [r.key, r as PublicationState<T>]));
  const seen = new Set(observations.map((o) => o.key));
  const updates = [...observations];
  if (complete) {
    for (const key of states.keys()) {
      if (!seen.has(key)) updates.push({ key, value: null, initial: null });
    }
  }
  const changed: (typeof zcgPublications.$inferInsert)[] = [];
  for (const { key, value, initial } of updates) {
    const previous = states.get(key);
    const next = observePublication(previous, value, initial, now);
    if (next !== previous) changed.push({ scope, key, ...next });
    states.set(key, next);
  }
  for (let i = 0; i < changed.length; i += 200) {
    await tx.insert(zcgPublications).values(changed.slice(i, i + 200)).onConflictDoUpdate({
      target: [zcgPublications.scope, zcgPublications.key],
      set: {
        published: sql`excluded.published`, pending: sql`excluded.pending`,
        observedAt: sql`excluded.observed_at`,
      },
    });
  }
  return new Map([...states].map(([key, state]) => [key, publishedValue(state, now)]));
}
