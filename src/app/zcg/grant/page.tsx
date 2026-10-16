import {
  Facts,
  RelatedLinks,
  RecordLayout,
  SectionHeading,
  SourceNote,
} from "@/components/workspace";
import { CopyPageLink } from "@/components/record-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, Stat } from "@/components/ui";
import { grantMilestones } from "@/lib/zcg/grants-repo";
import { formatUsdCents } from "@/lib/zcg/format";
import { formatZec } from "@/lib/zcash/units";
import { SourceRecordLink } from "@/components/source-record-link";
import { grantStatusLabel } from "@/lib/zcg/status-labels";
import { coinholderGrantViews } from "@/lib/coinholder/official-status";
import { grantMetadata, type GrantShare } from "@/lib/seo/detail-metadata";
import { cache } from "react";
import { projectHistoryDirectory } from "@/lib/project-history/data";
import { historyLinksForGrant } from "@/lib/project-history/insights";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ g?: string | string[] }> };

// One ledger query per request, shared by the link preview and the page.
const loadGrant = cache(grantMilestones);

/** The grant the link names, as the ledger stores it; null when none matches. */
async function grantShare(g: string | undefined): Promise<GrantShare | null> {
  if (!g) return null;
  try {
    const milestones = await loadGrant(g);
    const head = milestones[0];
    if (!head?.project) return null;
    return {
      name: head.project,
      recipient: head.recipientNameRaw,
      coinholder: head.sourceSheet === "coinholder_grants",
      paid: milestones.filter((m) => m.isPaid).length,
      milestones: milestones.length,
    };
  } catch (error) {
    console.error("[grant] ledger lookup for the link preview failed", error);
    return null;
  }
}

// The card never repeats text from the URL: only a name the ledger returned.
export async function generateMetadata({ searchParams }: Props) {
  const { g } = await searchParams;
  return grantMetadata(await grantShare(typeof g === "string" ? g : undefined));
}

export default async function GrantDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { g } = await searchParams;
  if (!g) notFound();
  const milestones = await loadGrant(g);
  if (milestones.length === 0) notFound();

  const historyDirectory = await projectHistoryDirectory();
  const head = milestones[0];
  const histories = [...new Map(milestones.flatMap(row => historyLinksForGrant(historyDirectory, {
    title: row.project ?? g, program: row.sourceSheet === "coinholder_grants" ? "coinholder" : "zcg", recipientKey: row.recipientKey,
  })).map(item => [item.id, item])).values()];
  const totalUsd = milestones.reduce(
    (s, m) => s + (m.amountUsdCents ?? 0n),
    0n,
  );
  const paid = milestones.filter((m) => m.isPaid);
  const open = milestones.filter((m) => !m.isPaid);
  const paidUsd = paid.reduce((s, m) => s + (m.amountUsdCents ?? 0n), 0n);
  const openUsd = open.reduce((s, m) => s + (m.amountUsdCents ?? 0n), 0n);
  const paidZec = paid.reduce((s, m) => s + (m.zecDisbursedZat ?? 0n), 0n);
  // A coinholder grant approved in a closed round and not yet paid reads as
  // such, as on the grants list, also under an earlier paid grant's name.
  const coinholderEntries = milestones.filter(
    (m) => m.sourceSheet === "coinholder_grants",
  );
  const awaiting = coinholderEntries.length
    ? (coinholderGrantViews(
        {
          grantKey: g,
          status: head.grantStatus,
          milestoneCount: milestones.length,
          paidCount: paid.length,
          usdCents: totalUsd,
        },
        coinholderEntries,
      ).find((v) => v.official)?.official ?? null)
    : null;
  const status =
    awaiting?.label ?? grantStatusLabel(head.grantStatus, "Unknown");
  const program =
    head.sourceSheet === "coinholder_grants" ? "Coinholder" : "ZCG regular";
  const pct = milestones.length
    ? Math.round((paid.length / milestones.length) * 100)
    : 0;

  // One timeline: paid milestones in payment order, then the unpaid ones by
  // estimated date (undated last). Every field of both former tables stays.
  const timeline = [
    ...[...paid].sort((a, b) =>
      (a.paidOutDate ?? "").localeCompare(b.paidOutDate ?? ""),
    ),
    ...[...open].sort((a, b) =>
      (a.estimatedPayoutDate ?? "9999").localeCompare(
        b.estimatedPayoutDate ?? "9999",
      ),
    ),
  ];

  return (
    <>
      <PageHeader
        title={g}
        actions={<CopyPageLink />}
        subtitle={`${head.recipientNameRaw}${head.category ? ` · ${head.category}` : ""} · ${paid.length} of ${milestones.length} milestones paid`}
      />

      <div className="ws-record-meta">
        <span
          className={
            awaiting
              ? "ws-pill ws-pill-accent"
              : head.grantStatus === "completed"
                ? "ws-pill ws-pill-pos"
                : head.grantStatus === "cancelled" ||
                    head.grantStatus === "keyholder_veto" ||
                    head.grantStatus === "funds_returned"
                  ? "ws-pill ws-pill-neg"
                  : "ws-pill ws-pill-accent"
          }
        >
          <i aria-hidden />
          {status}
        </span>
        <span className="ws-pill">{head.category ?? "Uncategorized"}</span>
        <span className="ws-pill">{program}</span>
        <span className="ws-record-meta-sep" aria-hidden>
          ·
        </span>
        <span className="ws-record-meta-label">Recipient</span>
        <Link
          href={`/zcg/recipient?r=${encodeURIComponent(head.recipientNameRaw ?? "")}`}
        >
          {head.recipientNameRaw} →
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Grant value"
          value={formatUsdCents(totalUsd, { compact: true })}
          sub={`sum of ${milestones.length} ${milestones.length === 1 ? "milestone" : "milestones"}`}
        />
        <Stat
          label="Paid"
          value={formatUsdCents(paidUsd, { compact: true })}
          sub={`${paid.length} ${paid.length === 1 ? "milestone" : "milestones"}${
            paidZec > 0n ? ` · ${formatZec(paidZec, { symbol: false })} ZEC` : ""
          }`}
          tone={paid.length > 0 ? "in" : "default"}
        />
        <Stat
          label="Unpaid budget"
          value={formatUsdCents(openUsd, { compact: true })}
          sub={`${open.length} ${open.length === 1 ? "milestone" : "milestones"}, estimated dates`}
        />
        <Stat
          label="Progress"
          value={
            <>
              {paid.length}{" "}
              <span className="ws-stat-of">of {milestones.length}</span>
            </>
          }
          sub={
            <>
              <span className="ws-stat-bar" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </span>
              {pct}% of milestones paid
            </>
          }
        />
      </section>

      <RecordLayout
        aside={
          <>
            {histories.length > 0 && <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4"><h2 className="mb-2 text-sm font-semibold">Follow the project</h2><p className="mb-3 text-xs leading-relaxed text-stone-500">See public work, related grants and the evidence still to link. Shared awards remain separate from project allocations.</p><div className="flex flex-col gap-3">{histories.map(history => <Link key={history.id} className="text-sm font-medium text-amber-800" href={history.href}>{history.name} history →</Link>)}</div></section>}
            <Facts
              title="Grant at a glance"
              rows={[
                [
                  "Recipient",
                  <Link
                    key="recipient"
                    href={`/zcg/recipient?r=${encodeURIComponent(head.recipientNameRaw ?? "")}`}
                  >
                    {head.recipientNameRaw}
                  </Link>,
                ],
                ["Category", head.category ?? "Uncategorized"],
                ["Program", program],
                ["Status", status],
                ["Milestones", String(milestones.length)],
                [
                  "First payment",
                  paid.length > 0
                    ? [...paid]
                        .map((m) => m.paidOutDate ?? "")
                        .filter(Boolean)
                        .sort()[0] || "·"
                    : "none yet",
                ],
                [
                  "Source",
                  <SourceRecordLink
                    key="source"
                    gid={head.sourceSheetGid}
                    rowIndex={head.sourceRowIndex}
                    importedAt={head.importedAt}
                  />,
                ],
              ]}
            />
            <RelatedLinks
              links={[
                {
                  href: "/zcg/grants",
                  label: "All grants",
                  description: "Back to the approved projects list",
                },
                {
                  href: "/zcg/schedule",
                  label: "Payment schedule",
                  description: `${open.filter((m) => m.estimatedPayoutDate).length} future dated milestones`,
                },
                {
                  href: "/zcg/disbursements",
                  label: "Full ledger",
                  description: "All payment records",
                },
                { href: "/zcg/methodology", label: "How to read this record" },
              ]}
            />
          </>
        }
      >
        <SectionHeading
          title="Milestones"
          count={milestones.length}
          description="Budget, payment status and the original evidence for each entry, paid milestones first. Payment status follows the ledger; delivery evidence should be checked at the source."
        />
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-stone-600">
              <tr className="border-b border-stone-200">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Milestone</th>
                <th className="px-4 py-3 text-right font-medium">
                  Budgeted USD
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((m, i) => (
                <tr
                  key={m.id}
                  className="tbl-row border-b border-stone-200 last:border-0"
                >
                  <td className="px-4 py-2.5 text-stone-500 tnum">{i + 1}</td>
                  <td className="max-w-[22rem] px-4 py-2.5">
                    <span className="block font-medium text-stone-900">
                      {m.milestoneLabel && !/^\d+$/.test(m.milestoneLabel)
                        ? m.milestoneLabel
                        : `Milestone ${m.milestoneLabel ?? m.milestoneSeq ?? i + 1}`}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {m.deliverable ?? m.project ?? "·"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-900 tnum">
                    {formatUsdCents(m.amountUsdCents)}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.isPaid ? (
                      <span className="ws-status">
                        <span className="ws-pill ws-pill-pos">Paid</span>
                        <span className="text-xs text-stone-600 tnum">
                          {m.paidOutDate ?? "·"}
                          {m.zecDisbursedZat != null
                            ? ` · ${formatZec(m.zecDisbursedZat, { symbol: false })} ZEC`
                            : ""}
                          {m.usdDisbursedZecRateCents != null
                            ? ` at ${formatUsdCents(m.usdDisbursedZecRateCents)}`
                            : ""}
                        </span>
                      </span>
                    ) : m.estimatedPayoutDate ? (
                      <span className="ws-status">
                        <span className="ws-pill ws-pill-accent">Scheduled</span>
                        <span className="text-xs text-stone-600 tnum">
                          estimated {m.estimatedPayoutDate}
                        </span>
                      </span>
                    ) : (
                      <span className="ws-status">
                        <span className="ws-pill">Unpaid</span>
                        <span className="text-xs text-stone-600 tnum">
                          {m.paidOutRaw || "no date recorded"}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <SourceRecordLink
                      gid={m.sourceSheetGid}
                      rowIndex={m.sourceRowIndex}
                      importedAt={m.importedAt}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <SourceNote>
          USD figures are budgeted milestone values. Unpaid entries may include
          cancelled milestones and are not necessarily outstanding commitments.
          Recorded payment does not independently verify delivery. Source links
          open live spreadsheet rows, which may have changed since collection.
        </SourceNote>
      </RecordLayout>
    </>
  );
}
