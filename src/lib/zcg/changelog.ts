import "server-only";
import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgChangelog, zcgDisbursements, zcgProposals, zcgPublications } from "@/lib/db/schema";
import { sha256 } from "./sheets";
import { publicationDay, proposalPublicationKey, PUBLICATION_TIME_ZONE } from "./publication-policy";
import { publishedChangelog } from "./published-changelog";

/**
 * "What changed" audit feed: refreshZcg snapshots the proposal statuses and
 * disbursement ids BEFORE re-importing, then diffs against the fresh state.
 * The resulting entries (new proposals, status flips, new recorded payments)
 * power the home-page digest and the RSS feed — turning the daily mirror into
 * an auditable history of spreadsheet edits.
 */

export type ChangelogSnapshot = {
  /** Stable program/application identity; resubmissions remain separate. */
  proposals: Map<string, { title: string; status: string; observedAt?: Date }>;
  disbIds: Set<string>;
};

export type ChangelogEntry = typeof zcgChangelog.$inferSelect;

export async function snapshotForChangelog(): Promise<ChangelogSnapshot> {
  const db = getDb();
  const [props, disb] = await Promise.all([
    db
      .select({
        id: zcgProposals.id,
        origin: zcgProposals.origin,
        program: zcgProposals.program,
        titleKey: zcgProposals.titleKey,
        title: zcgProposals.title,
        status: zcgProposals.status,
        platformLink: zcgProposals.platformLink,
        submittedDate: zcgProposals.submittedDate,
      })
      .from(zcgProposals),
    db.select({ id: zcgDisbursements.id }).from(zcgDisbursements),
  ]);
  const observations = await db.select({ key: zcgPublications.key, at: zcgPublications.observedAt })
    .from(zcgPublications).where(eq(zcgPublications.scope, "proposal-status"));
  const byKey = new Map(observations.map((p) => [p.key, p.at]));
  const proposals: ChangelogSnapshot["proposals"] = new Map();
  for (const p of props)
    proposals.set(
      proposalPublicationKey(p),
      { title: p.title, status: p.status, observedAt: byKey.get(proposalPublicationKey(p)) },
    );
  return { proposals, disbIds: new Set(disb.map((d) => d.id)) };
}

const fmtUsd = (cents: bigint) =>
  `$${Math.round(Number(cents) / 100).toLocaleString("en-US")}`;

/**
 * Diffs the fresh import against the pre-import snapshot and appends entries.
 * Bootstrap-safe: an empty "before" (first import into a fresh DB) records
 * nothing instead of flooding the feed with the entire history.
 */
export async function recordChangelog(
  before: ChangelogSnapshot,
): Promise<number> {
  const db = getDb();
  const after = await snapshotForChangelog();

  const entries: Array<{
    kind: string;
    title: string;
    fromVal: string | null;
    toVal: string | null;
    detail: string | null;
    entityKey: string | null;
    at: Date;
  }> = [];

  if (before.proposals.size > 0) {
    for (const [key, cur] of after.proposals) {
      const prev = before.proposals.get(key);
      if (!prev) {
        entries.push({
          kind: "proposal_new",
          title: cur.title,
          fromVal: null,
          toVal: cur.status,
          detail: null,
          entityKey: key,
          at: cur.observedAt ?? new Date(),
        });
      } else if (prev.status !== cur.status) {
        entries.push({
          kind: "proposal_status",
          title: cur.title,
          fromVal: prev.status,
          toVal: cur.status,
          detail: null,
          entityKey: key,
          at: cur.observedAt ?? new Date(),
        });
      }
    }
  }

  if (before.disbIds.size > 0) {
    const rows = await db
      .select({
        id: zcgDisbursements.id,
        project: zcgDisbursements.project,
        recipient: zcgDisbursements.recipientNameRaw,
        usd: zcgDisbursements.usdDisbursedCents,
        budget: zcgDisbursements.amountUsdCents,
        isPaid: zcgDisbursements.isPaid,
        isTest: zcgDisbursements.isTest,
      })
      .from(zcgDisbursements);
    const byProject = new Map<string, { count: number; cents: bigint }>();
    for (const r of rows) {
      if (before.disbIds.has(r.id) || !r.isPaid || r.isTest) continue;
      const name = r.project || r.recipient || "Unlabelled";
      const cents = r.usd ?? r.budget ?? 0n;
      const agg = byProject.get(name) ?? { count: 0, cents: 0n };
      byProject.set(name, { count: agg.count + 1, cents: agg.cents + cents });
    }
    for (const [name, agg] of byProject) {
      entries.push({
        kind: "payment",
        title: name,
        fromVal: null,
        toVal: null,
        detail: `${agg.count} payment${agg.count === 1 ? "" : "s"} · ${fmtUsd(agg.cents)}`,
        entityKey: null,
        at: new Date(),
      });
    }
  }

  if (!entries.length) return 0;
  await db
    .insert(zcgChangelog)
    .values(
      entries.map((e) => ({
        // One proposal entry per day retains the first public origin and the
        // final observed destination, even through A -> B -> A -> B edits.
        id: sha256(`${e.entityKey ? `proposal|${e.entityKey}` : `${e.kind}|${e.title}`}|${publicationDay(e.at)}`).slice(
          0,
          32,
        ),
        ...e,
      })),
    )
    .onConflictDoUpdate({ target: zcgChangelog.id, set: {
      toVal: sql`excluded.to_val`, at: sql`excluded.at`,
    } });
  return entries.length;
}

/**
 * Recent entries for the digests and RSS feeds. `source` splits the shared
 * table by origin: "zcg" (spreadsheet diffs) vs "zechub" (DAO treasury
 * payouts) — each surface subscribes to its own stream.
 */
export async function listChangelog(
  days = 7,
  limit = 30,
  source: "zcg" | "zechub" | "all" = "all",
): Promise<ChangelogEntry[]> {
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const bySource =
    source === "zechub"
      ? eq(zcgChangelog.kind, "zechub_payment")
      : source === "zcg"
        ? ne(zcgChangelog.kind, "zechub_payment")
        : undefined;
  const rows = await db
    .select()
    .from(zcgChangelog)
    .where(
      and(gte(zcgChangelog.at, since), bySource, or(
        eq(zcgChangelog.kind, "zechub_payment"),
        sql`(${zcgChangelog.at} AT TIME ZONE ${PUBLICATION_TIME_ZONE})::date < ${publicationDay(now)}::date`,
      )),
    )
    .orderBy(desc(zcgChangelog.at));
  return publishedChangelog(rows, now).slice(0, limit);
}
