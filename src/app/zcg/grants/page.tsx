import { SourceNote } from "@/components/workspace";
import { Card, PageHeader, Stat } from "@/components/ui";
import { grantsSummary, listGrants } from "@/lib/zcg/grants-repo";
import { formatUsdCents } from "@/lib/zcg/format";
import { GrantsTable, type GrantTableRow } from "./grants-table";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { Synced } from "@/components/synced";
import { grantStatusLabel as statusLabel } from "@/lib/zcg/status-labels";
import { listDisbursements } from "@/lib/zcg/disbursements-repo";
import { coinholderGrantViews } from "@/lib/coinholder/official-status";
import { pageMetadata } from "@/lib/seo/page-metadata";
import Link from "next/link";
import { projectHistoryDirectory } from "@/lib/project-history/data";
import { historyLinksForGrant } from "@/lib/project-history/insights";
import { normalizeKey } from "@/lib/zcg/normalize";

/** The coinholder tab has a few dozen rows; the list's default cap of 250 is far above it. */
const COINHOLDER_LEDGER_ROWS = 1000;

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Grants ZCG · OpenZcash",
  shareTitle: "Grants · ZCG",
  description:
    "Each grant is an approved project that aggregates its milestones. A single grantee can hold several grants.",
  path: "/zcg/grants",
  card: { title: "Grants" },
});

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    program?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const [grants, summary, coinholderEntries] = await Promise.all([
    cached("grants:list", LEDGER_TTL_MS, () => listGrants()),
    cached("grants:summary", LEDGER_TTL_MS, () => grantsSummary()),
    cached("listDisbursements:coinholder_grants", LEDGER_TTL_MS, () =>
      listDisbursements({
        sheet: "coinholder_grants",
        limit: COINHOLDER_LEDGER_ROWS,
      }),
    ),
  ]);

  const historyDirectory = await projectHistoryDirectory();
  const rows: GrantTableRow[] = grants.map((g) => {
    // A coinholder grant approved in a closed round and not yet paid, also
    // when FPF's tab files it under the name of an earlier, paid grant.
    const awaiting =
      g.program === "coinholder"
        ? (coinholderGrantViews(g, coinholderEntries).find((v) => v.official)
            ?.official ?? null)
        : null;
    return {
      grantKey: g.grantKey,
      grantee: g.grantee,
      category: g.category ?? "",
      status: awaiting ? "open" : g.status,
      statusText: awaiting?.label ?? statusLabel(g.status),
      program: g.program,
      milestoneCount: g.milestoneCount,
      paidCount: g.paidCount,
      milestonesText: `${g.paidCount}/${g.milestoneCount}`,
      _usd: Number(g.usdCents),
      _zec: Number(g.zecZat),
      histories: historyLinksForGrant(historyDirectory, { title: g.grantKey, program: g.program === "coinholder" ? "coinholder" : "zcg", recipientKey: normalizeKey(g.grantee) }),
    };
  });

  return (
    <>
      <PageHeader
        title="Grants"
        actions={<Link href="/ecosystem/history?view=funding" className="ws-pill">Explore project histories →</Link>}
        subtitle="Each grant is an approved project that aggregates its milestones. A single grantee can hold several grants (for example, Zcash Brazil has 7). Click a grant to view its payments."
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Grants"
          value={String(summary.grantCount)}
          sub="approved projects"
        />
        <Stat
          label="Committed"
          value={formatUsdCents(summary.committedCents, { compact: true })}
          sub="USD, excluding cancelled"
          tone="warn"
        />
        <Stat
          label="Paid"
          tone="in"
          value={formatUsdCents(summary.paidCents, { compact: true })}
          sub="milestones already paid"
        />
        <Stat
          label="Open"
          value={formatUsdCents(summary.futureCents, { compact: true })}
          sub="committed, still to pay"
        />
      </section>

      <Card className="overflow-hidden p-0">
        <div className="ws-ledger">
          <GrantsTable
            key={JSON.stringify(params)}
            rows={rows}
            initialPicks={{
              ...(params.status
                ? { status: [statusLabel(params.status)] }
                : {}),
              ...(params.category ? { category: [params.category] } : {}),
              ...(params.program
                ? {
                    program: [
                      params.program === "coinholder" ? "Coinholder" : "ZCG",
                    ],
                  }
                : {}),
            }}
            initialQuery={params.q}
          />
        </div>
      </Card>

      <SourceNote>
        One project per row. Paid values use the ledger’s budgeted USD amounts;
        open commitments exclude cancelled grants. Payment records do not
        independently establish delivery.
      </SourceNote>
      <Synced className="mt-4" />
    </>
  );
}
