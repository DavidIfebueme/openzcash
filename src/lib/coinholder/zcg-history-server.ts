import "server-only";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgDisbursements as d } from "@/lib/db/schema";
import { listProposals } from "@/lib/zcg/proposals-repo";
import { boundedRead } from "@/lib/zarvis/timeout";
import { priorZcg, type PriorZcg, type ZcgHistoryRecords, type ZcgPayment, type ZcgApproval } from "./zcg-history";
import type { Q4ProposalSummary } from "./q4";

async function readPayments(): Promise<ZcgPayment[]> {
  return getDb().select({
    project: d.project, recipient: d.recipientNameRaw, sourceSheet: d.sourceSheet,
    isPaid: d.isPaid, paidDate: d.paidOutDate, isTest: d.isTest, isInternal: d.isInternal,
  }).from(d).where(and(eq(d.sourceSheet, "grants_disbursed"), eq(d.isPaid, true), eq(d.isTest, false), eq(d.isInternal, false)));
}

/** Reuse the published ZCG ledger, independently of the live FPF intake. */
export function createZcgHistoryReader(load: { payments: () => Promise<ZcgPayment[]>; approvals: () => Promise<ZcgApproval[]> }) {
  return async function read(proposals: Q4ProposalSummary[]): Promise<Record<number, PriorZcg>> {
    if (!proposals.length) return {};
    const [payments, approvals] = await Promise.allSettled([
      boundedRead(() => cached("coinholders:zcg-payments", LEDGER_TTL_MS, load.payments), new AbortController().signal, 6000),
      boundedRead(() => cached("coinholders:zcg-approvals", LEDGER_TTL_MS, load.approvals), new AbortController().signal, 6000),
    ]);
    const records: ZcgHistoryRecords = {
      payments: payments.status === "fulfilled" ? payments.value : null,
      approvals: approvals.status === "fulfilled" ? approvals.value : null,
    };
    return Object.fromEntries(proposals.map((proposal) => [proposal.number, priorZcg(proposal, records)]));
  };
}

export const readZcgHistory = createZcgHistoryReader({
  payments: readPayments,
  approvals: () => listProposals({ program: "zcg", status: "approved" }),
});
