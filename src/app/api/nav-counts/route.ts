import { NextResponse } from "next/server";
import { cached } from "@/lib/cache/memo";
import { disbursementsSummary } from "@/lib/zcg/disbursements-repo";
import { listProposals, officeUnderReview } from "@/lib/zcg/proposals-repo";
import { publicationDay } from "@/lib/zcg/publication-policy";
import { getPaymentSchedule } from "@/lib/zcg/schedule-repo";
import { getMeetings } from "@/lib/zcg/governance-repo";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";
import { COMMUNITIES } from "@/lib/communities/data";
import { getArboristCalls } from "@/lib/arborist/notes";
import { MEMBERS } from "@/app/zcg/current-committee-data";
import { mayaTransfers } from "@/lib/zcg/snapshots-repo";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60_000;
const fmt = (n: number) => n.toLocaleString("en-US");
// A zero from a source that is still warming (Arborist right after a
// deploy, for instance) would read as a fact; the item just shows no count.
const put = (out: Record<string, string>, key: string, n: number | null | undefined) => {
  if (n != null && n > 0) out[key] = fmt(n);
};

/**
 * Record counts for the shell's sidebar, keyed by route. Every source is
 * optional: one that fails simply leaves its item without a count. Cached
 * in-process for five minutes; the sidebar reads it after the page paints.
 */
async function compute(): Promise<Record<string, string>> {
  const [summary, proposals, queue, schedule, meetings, calls, mayaRows] =
    await Promise.all([
      disbursementsSummary().catch(() => null),
      cached(`listProposals:all:${publicationDay()}`, TTL_MS, () =>
        listProposals({}),
      ).catch(() => null),
      officeUnderReview(100).catch(() => null),
      getPaymentSchedule().catch(() => null),
      getMeetings().catch(() => null),
      getArboristCalls().catch(() => null),
      mayaTransfers().catch(() => null),
    ]);
  // Distinct positions: the Maya transfers all go to one wallet today.
  const investments = mayaRows
    ? new Set(mayaRows.map((r) => (r.project ?? "").trim().toLowerCase()).filter(Boolean)).size
    : null;
  let catalog: Awaited<ReturnType<typeof loadEcosystemCatalog>> | null = null;
  try {
    catalog = await loadEcosystemCatalog();
  } catch {
    catalog = null;
  }
  const out: Record<string, string> = {};
  put(out, "/zcg/grants", summary?.grantCount);
  put(out, "/zcg/disbursements", summary?.count);
  put(out, "/zcg/recipients", summary?.recipientCount);
  put(out, "/zcg/proposals", proposals?.length);
  put(out, "/zcg/office", queue?.length);
  put(out, "/zcg/schedule", schedule?.rows.length);
  // One position today, the Maya liquidity seed; counted from the ledger's
  // Maya transfers so a second position shows up without a code change.
  put(out, "/zcg/investments", investments);
  put(out, "/zcg/committee", MEMBERS.length);
  put(out, "/zcg/meetings", meetings?.length);
  put(out, "/ecosystem", catalog?.registry.projects.length);
  put(out, "/development", catalog?.snapshot.repositories.length);
  put(out, "/communities", COMMUNITIES.length);
  put(out, "/arborist", calls?.length);
  return out;
}

export async function GET() {
  const counts = await cached("nav:counts", TTL_MS, compute).catch(
    () => ({}) as Record<string, string>,
  );
  return NextResponse.json(counts, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
