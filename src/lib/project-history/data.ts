import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgDisbursements as d } from "@/lib/db/schema";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";
import { listProposals } from "@/lib/zcg/proposals-repo";
import { spreadsheetSource } from "@/lib/zcg/source-links";
import { publicationDay } from "@/lib/zcg/publication-policy";
import { cached } from "@/lib/cache/memo";
import { boundedRead } from "@/lib/zarvis/timeout";
import evidenceData from "@/data/project-history/evidence.json";
import { evidenceSchema } from "./evidence";
import { historyIdentities } from "./identities";
import { buildProjectHistory, prepareHistoryBindings } from "./build";
import { projectInsights, type HistoryIndexItem } from "./insights";
import { monthlyProjectActivity } from "./activity";
import type { FinanceRecords, PaymentRecord, ProposalRecord } from "./types";

const reviewed = evidenceSchema.parse(evidenceData).entries;
const directoryCache = new WeakMap<Awaited<ReturnType<typeof loadEcosystemCatalog>>, ReturnType<typeof historyIdentities>>();
async function historyContext() {
  const catalog = await loadEcosystemCatalog();
  let identities = directoryCache.get(catalog);
  if (!identities) {
    identities = historyIdentities(catalog);
    for (const entry of reviewed) if (!identities.some(item => item.id === entry.projectId)) throw new Error("Unknown project in reviewed history evidence");
    directoryCache.set(catalog, identities);
  }
  return { catalog, identities };
}
export async function projectHistoryDirectory() { return (await historyContext()).identities; }

async function readPayments(): Promise<PaymentRecord[]> {
  // Explicit public projection; no viewing keys, admin overrides or private fields.
  const rows = await getDb().select({
    id: d.id, sheet: d.sourceSheet, project: d.project, recipientKey: d.recipientKey,
    milestone: d.milestoneLabel, deliverable: d.deliverable, isPaid: d.isPaid,
    paidDate: d.paidOutDate, budgetUsdCents: d.amountUsdCents, recordedZecZat: d.zecDisbursedZat,
    gid: d.sourceSheetGid, row: d.sourceRowIndex, importedAt: d.importedAt,
  }).from(d).where(and(eq(d.isTest, false), eq(d.isInternal, false), inArray(d.sourceSheet, ["grants_disbursed", "coinholder_grants"])));
  return rows.map(row => ({
    id: row.id, program: row.sheet === "coinholder_grants" ? "coinholder" : "zcg", project: row.project ?? "", recipientKey: row.recipientKey,
    milestone: row.milestone, deliverable: row.deliverable, isPaid: row.isPaid, paidDate: row.paidDate,
    budgetUsdCents: row.budgetUsdCents?.toString() ?? null, recordedZecZat: row.recordedZecZat?.toString() ?? null,
    source: { label: "OpenZcash payment ledger", url: spreadsheetSource(row.gid, row.row).sourceUrl ?? "https://openzcash.org/zcg/disbursements", observedAt: row.importedAt.toISOString() },
  }));
}

async function readProposals(): Promise<ProposalRecord[]> {
  // Preserve the existing D-1 public-status projection; never read raw verdicts here.
  const rows = await listProposals();
  return rows.filter(row => row.program === "zcg" || row.program === "coinholder").map(row => ({
    id: row.id, program: row.program as "zcg" | "coinholder", title: row.title, status: row.status,
    submittedDate: row.submittedDate, decisionDate: row.decisionDate,
    requestedUsdCents: row.requestedUsdCents?.toString() ?? null,
    platformLink: row.platformLink, forumLink: row.forumLink,
    source: { label: "OpenZcash proposal ledger", url: spreadsheetSource(row.sourceSheetGid, row.sourceRowIndex).sourceUrl ?? "https://openzcash.org/zcg/proposals", observedAt: row.importedAt.toISOString() },
  }));
}

let pendingFinance: Promise<FinanceRecords> | undefined;
export async function readHistoryFinance(): Promise<FinanceRecords> {
  if (pendingFinance) return pendingFinance;
  pendingFinance = cached(`project-history:finance:${publicationDay()}`, 60_000, async () => {
    const [proposals, payments] = await Promise.allSettled([
      boundedRead(readProposals, new AbortController().signal, 6000),
      boundedRead(readPayments, new AbortController().signal, 6000),
    ]);
    const p = proposals.status === "fulfilled" ? proposals.value : [];
    const d = payments.status === "fulfilled" ? payments.value : [];
    const dates = [...p, ...d].flatMap(row => row.source.observedAt ? [row.source.observedAt] : []).sort();
    return { proposals: p, payments: d, proposalsAvailable: proposals.status === "fulfilled", paymentsAvailable: payments.status === "fulfilled", importedAt: dates.at(-1) ?? null };
  }).finally(() => { pendingFinance = undefined; });
  return pendingFinance;
}

export async function readProjectHistory(id: string) {
  const { catalog, identities } = await historyContext();
  const identity = identities.find(item => item.id === id);
  if (!identity) return null;
  const finance = await readHistoryFinance();
  return buildProjectHistory(identity, identities, finance, catalog.snapshot.collectedAt, reviewed);
}

export async function readMonthlyProjectActivity(month: string) {
  const { catalog, identities } = await historyContext();
  const finance = await readHistoryFinance(), now = new Date();
  const index = prepareHistoryBindings(identities, finance);
  const histories = identities.map(identity => buildProjectHistory(identity, identities, finance, catalog.snapshot.collectedAt, reviewed, now, index));
  return monthlyProjectActivity(histories, finance, month, now);
}

export async function readHistoryIndex() {
  const { catalog, identities } = await historyContext();
  const finance = await readHistoryFinance();
  const index = prepareHistoryBindings(identities, finance), now = new Date();
  const items: HistoryIndexItem[] = identities.map(identity => {
    const history = buildProjectHistory(identity, identities, finance, catalog.snapshot.collectedAt, reviewed, now, index);
    const { grants, paidEntries, acceptedEntries, acceptanceGaps, publishedArtifacts, integrations, usageObservations, reportSources, publicWorkSources, latestEvent } = projectInsights(history);
    return { ...history.project, insights: { grants, paidEntries, acceptedEntries, acceptanceGaps, publishedArtifacts, integrations, usageObservations, reportSources, publicWorkSources },
      latestEvent: latestEvent ? { title: latestEvent.title, date: latestEvent.date, kind: latestEvent.kind, ...(latestEvent.releaseChannel ? { releaseChannel: latestEvent.releaseChannel } : {}) } : null };
  });
  return { items, coverage: { proposalsAvailable: finance.proposalsAvailable, paymentsAvailable: finance.paymentsAvailable },
    repositorySnapshotAt: catalog.snapshot.collectedAt, ledgerImportedAt: finance.importedAt };
}
