import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgDisbursements, zcgProposals } from "@/lib/db/schema";
import { buildOfficialApprovedBudgets } from "./approved-budget-match";
import { approvedBudgetSnapshotSchema, type ApprovedBudgetSnapshot } from "./workspace/data/zcg-approved-budgets";

const TTL_MS = 60_000;
let cached: { data: ApprovedBudgetSnapshot; expiresAt: number } | null = null;
let pending: Promise<ApprovedBudgetSnapshot> | null = null;

/** One bulk read of the imported official ledger, shared by SSR and public requests.
 * Current sheet verdicts are financial annotations here; the portal's D-1
 * publication policy and archived source revisions are not changed.
 */
export async function readApprovedBudgets(): Promise<ApprovedBudgetSnapshot> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (pending) return pending;
  pending = load().then(data => {
    cached = { data, expiresAt: Date.now() + TTL_MS };
    return data;
  }).finally(() => { pending = null; });
  return pending;
}

async function load(): Promise<ApprovedBudgetSnapshot> {
  const { proposals, milestones } = await getDb().transaction(async tx => {
    await tx.execute(sql`set local statement_timeout = '3000ms'`);
    const proposals = await tx.select().from(zcgProposals).where(eq(zcgProposals.program, "zcg"));
    const milestones = await tx.select().from(zcgDisbursements).where(eq(zcgDisbursements.sourceSheet, "grants_disbursed"));
    return { proposals, milestones };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  const { budgets, unmatched } = buildOfficialApprovedBudgets(proposals, milestones);
  if (!proposals.length || !milestones.length) throw new Error("Official ledger has not been imported");
  if (unmatched.length) console.warn("[participate] approved budgets unresolved", JSON.stringify(unmatched));
  const dates = [...proposals, ...milestones].filter(row => row.origin === "sheet" && !row.locked)
    .map(row => +row.importedAt).filter(Number.isFinite);
  if (!dates.length) throw new Error("Official ledger timestamp is unavailable");
  return approvedBudgetSnapshotSchema.parse({ version: 1, budgets, importedAt: new Date(Math.min(...dates)).toISOString() });
}

/** Budget lookup runs alongside existing page reads, with a one-second ceiling.
 * If the DB is cold or unavailable, the workspace opens and retries via its API.
 */
export async function initialApprovedBudgets(): Promise<ApprovedBudgetSnapshot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readApprovedBudgets().catch(() => null),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1_000); }),
    ]);
  } finally { clearTimeout(timer); }
}
