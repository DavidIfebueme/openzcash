import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgProposals } from "@/lib/db/schema";
import type { ProposalStatus } from "./import-proposals";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import {
  getGrantApplications,
  type OfficeProposalDTO,
} from "./github-applications";
import { matchProposalApplications } from "./match-proposals";
import { readPublications } from "./publications-repo";
import { publicationDay, proposalPublicationKey, type ProposalVerdict } from "./publication-policy";

export type ProposalRow = typeof zcgProposals.$inferSelect;

/** zcg | coinholder */
export type ProposalProgram = "zcg" | "coinholder";

export type ProposalFilters = {
  program?: ProposalProgram;
  status?: ProposalStatus;
};

/**
 * Lista propostas filtrando por programa e/ou status canônico.
 * Ordena por data submetida (mais recente primeiro), depois pela linha de origem
 * para estabilidade quando a data é nula.
 */
export async function listProposals(
  opts: ProposalFilters = {},
): Promise<ProposalRow[]> {
  const db = getDb();
  const conds = [];
  if (opts.program) conds.push(eq(zcgProposals.program, opts.program));
  const rows = await db
    .select()
    .from(zcgProposals)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(
      sql`${zcgProposals.submittedDate} desc nulls last`,
      asc(zcgProposals.sourceSheetGid),
      asc(zcgProposals.sourceRowIndex),
    );
  // Read source rows before publication state: an import commits both together.
  // Filtering before this projection would expose today's verdict in counts.
  const published = await readPublications<ProposalVerdict>("proposal-status");
  return rows.map((p) => ({ ...p, ...published.get(proposalPublicationKey(p)) }))
    .filter((p) => !opts.status || p.status === opts.status);
}

export type FunnelBucket = {
  program: ProposalProgram;
  status: ProposalStatus;
  count: number;
  /** USD pedido somado (só confiável no coinholder); centavos. */
  requestedUsdCents: bigint;
};

export type ProposalFunnel = {
  byBucket: FunnelBucket[];
  /** Totais por status, somando os dois programas. */
  byStatus: { status: ProposalStatus; count: number }[];
  /** Totais por programa. */
  byProgram: { program: ProposalProgram; count: number }[];
  total: number;
};

/**
 * Funil de propostas: contagem por status canônico, quebrada por programa.
 * Inclui agregados por status (somando programas) e por programa.
 */
export async function proposalsFunnel(): Promise<ProposalFunnel> {
  const rows = await listProposals();
  const buckets = new Map<string, FunnelBucket>();
  for (const row of rows) {
    const key = `${row.program}|${row.status}`;
    const bucket = buckets.get(key) ?? {
      program: row.program as ProposalProgram, status: row.status as ProposalStatus,
      count: 0, requestedUsdCents: 0n,
    };
    bucket.count++;
    bucket.requestedUsdCents += row.requestedUsdCents ?? 0n;
    buckets.set(key, bucket);
  }
  const byBucket = [...buckets.values()].sort((a, b) =>
    a.program.localeCompare(b.program) || b.count - a.count || a.status.localeCompare(b.status));

  const statusMap = new Map<ProposalStatus, number>();
  const programMap = new Map<ProposalProgram, number>();
  let total = 0;
  for (const b of byBucket) {
    statusMap.set(b.status, (statusMap.get(b.status) ?? 0) + b.count);
    programMap.set(b.program, (programMap.get(b.program) ?? 0) + b.count);
    total += b.count;
  }

  const byStatus = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const byProgram = [...programMap.entries()]
    .map(([program, count]) => ({ program, count }))
    .sort((a, b) => b.count - a.count);

  return { byBucket, byStatus, byProgram, total };
}

// Proposal statuses meaning the committee has already decided (the spreadsheet
// is the authoritative source for published status; a GitHub issue can still carry a
// stale "Ready For ZCG Review" label after the sheet records the decision).
const DECIDED_STATUSES = new Set<string>([
  "approved",
  "rejected",
  "withdrawn",
  "cancelled",
  "filtered",
  "vetoed",
  "paid",
]);

/**
 * Proposals genuinely under review, for the 3D office and its API. Starts from
 * the D-1 GitHub application queue, then drops any the
 * spreadsheet has already decided — the sheet is canonical for status, and
 * GitHub's review label is routinely left on after a decision (e.g. #335
 * red·bridge, approved in the sheet but still review-labelled on GitHub). This
 * applies the same publication delay as /zcg/proposals.
 */
export async function officeUnderReview(
  limit = 100,
): Promise<OfficeProposalDTO[]> {
  const [apps, sheet] = await Promise.all([
    getGrantApplications(limit),
    cached(`listProposals:all:${publicationDay()}`, LEDGER_TTL_MS, () => listProposals({})),
  ]);
  const ghApps = apps.filter((a) => a.status === "review");

  // Use the same full-history, program-aware identity matching as the pipeline.
  const matches = matchProposalApplications(sheet, ghApps);
  const absorbedByDecided = new Set<number>();
  for (const p of sheet) {
    const issue = matches.get(p.id);
    if (issue != null && DECIDED_STATUSES.has(p.status)) absorbedByDecided.add(issue);
  }

  return ghApps
    .filter((app) => !absorbedByDecided.has(app.number))
    .map((a) => ({
      number: a.number,
      title: a.title,
      amount: a.amountUsd,
      applicant: a.applicant,
      createdAt: (a.createdAt || "").slice(0, 10),
      summary: a.summary,
      url: a.url,
    }));
}
