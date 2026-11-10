import {
  Facts,
  RelatedLinks,
  RecordLayout,
  SectionHeading,
} from "@/components/workspace";
import { CopyPageLink } from "@/components/record-actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { recipientMilestones } from "@/lib/zcg/grants-repo";
import { normalizeKey } from "@/lib/zcg/normalize";
import { formatUsdCents } from "@/lib/zcg/format";
import {
  canonicalRecipient,
  recordedRecipientNames,
} from "@/lib/zcg/recipient-aliases";
import { recipientEntryPresentation } from "@/lib/zcg/recipient-entry";
import { formatZec } from "@/lib/zcash/units";
import { SourceRecordLink } from "@/components/source-record-link";
import {
  recipientMetadata,
  type RecipientShare,
} from "@/lib/seo/detail-metadata";
import { cache } from "react";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ r?: string | string[] }> };

// One ledger query per request, shared by the link preview and the page.
const loadRecipient = cache((r: string) => recipientMilestones(normalizeKey(r)));

/** The recipient the link names, as the ledger names it; null when none matches. */
async function recipientShare(
  r: string | undefined,
): Promise<RecipientShare | null> {
  if (!r) return null;
  try {
    const rows = await loadRecipient(r);
    const stored = rows.find((m) => m.recipientNameRaw)?.recipientNameRaw;
    if (!stored) return null;
    const paid = rows.filter((m) => m.isPaid).length;
    return {
      name: canonicalRecipient(stored),
      paid,
      unpaid: rows.length - paid,
    };
  } catch (error) {
    console.error("[recipient] ledger lookup for the link preview failed", error);
    return null;
  }
}

// The card never repeats text from the URL: only a name the ledger returned.
export async function generateMetadata({ searchParams }: Props) {
  const { r } = await searchParams;
  return recipientMetadata(
    await recipientShare(typeof r === "string" ? r : undefined),
  );
}

type RecipientEntry = Awaited<ReturnType<typeof recipientMilestones>>[number];

function LedgerEntryName({ entry }: { entry: RecipientEntry }) {
  const presentation = recipientEntryPresentation(entry);
  const label = presentation.isGrant ? (
    <Link
      href={`/zcg/grant?g=${encodeURIComponent(entry.project ?? "")}`}
      className="block truncate hover:text-amber-700"
    >
      {presentation.label}
    </Link>
  ) : (
    <span className="block truncate">{presentation.label}</span>
  );

  return (
    <div className="min-w-0">
      {label}
      {presentation.detail ? (
        <span className="mt-0.5 block truncate text-[11px] font-normal text-stone-500">
          {presentation.detail}
        </span>
      ) : null}
    </div>
  );
}

export default async function RecipientPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  if (!r) notFound();

  const rows = await loadRecipient(r);
  if (rows.length === 0) notFound();

  const name = canonicalRecipient(
    rows.find((m) => m.recipientNameRaw)?.recipientNameRaw ?? r,
  );
  // The sheet can record one recipient under several names; say which.
  const recordedAs = recordedRecipientNames(rows.map((m) => m.recipientNameRaw));
  const open = rows.filter((m) => !m.isPaid);
  const paid = rows.filter((m) => m.isPaid);
  const sum = (xs: typeof rows) =>
    xs.reduce((s, m) => s + (m.amountUsdCents ?? 0n), 0n);

  return (
    <>
      <PageHeader
        title={name}
        actions={<CopyPageLink />}
        subtitle={`${open.length} unpaid and ${paid.length} paid entries in the public ledger. This detail view includes committee stipends, grants and reimbursements; the recipient ranking excludes internal costs.`}
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Unpaid budget"
          value={formatUsdCents(sum(open), { compact: true })}
          sub={`${open.length} ${open.length === 1 ? "entry" : "entries"}`}
        />
        <Stat
          label="Paid to date"
          value={formatUsdCents(sum(paid), { compact: true })}
          sub={`${paid.length} ${paid.length === 1 ? "entry" : "entries"}`}
        />
        <Stat
          label="ZEC paid"
          value={formatZec(
            paid.reduce((s, m) => s + (m.zecDisbursedZat ?? 0n), 0n),
            { symbol: false },
          )}
          sub="recorded ledger amount"
          tone="in"
        />
        <Stat
          label="Ledger entries"
          value={String(rows.length)}
          sub="all recorded entry types"
        />
      </section>

      <RecordLayout
        aside={
          <>
            <Facts
              title="Recipient profile"
              rows={[
                ["Name", name],
                ...(recordedAs.length > 1
                  ? [["Recorded as", recordedAs.join(" · ")] as [string, string]]
                  : []),
                ["Paid entries", String(paid.length)],
                ["Unpaid entries", String(open.length)],
                ["Coverage", "Grants, stipends and reimbursements"],
              ]}
            />
            <RelatedLinks
              title="Recorded projects"
              links={Array.from(
                new Set(
                  rows
                    .filter((m) => recipientEntryPresentation(m).isGrant)
                    .map((m) => m.project)
                    .filter((p): p is string => Boolean(p)),
                ),
              ).map((p) => ({
                href: `/zcg/grant?g=${encodeURIComponent(p)}`,
                label: p,
              }))}
            />
            <RelatedLinks
              links={[
                {
                  href: "/zcg/recipients",
                  label: "Recipient ranking",
                  description: "Excludes internal operating costs",
                },
                { href: "/zcg/stipends", label: "Committee stipends" },
                { href: "/zcg/methodology", label: "Sources & methodology" },
              ]}
            />
          </>
        }
      >
        <SectionHeading
          title="Payment history"
          description="All public ledger entries for this recipient, including stipends and reimbursements where recorded."
        />
        <p className="mb-6 text-xs text-stone-600">
          USD figures are budgeted entry values. Unpaid entries may include
          cancelled milestones; they are not necessarily outstanding
          commitments. Recorded payment does not independently verify delivery.
          Source links open live spreadsheet rows, which may have changed since
          collection.
        </p>

        {open.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
              Unpaid entries
              <Badge tone="amber">{open.length}</Badge>
            </h2>
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-stone-600">
                  <tr className="border-b border-stone-200">
                    <th className="px-4 py-3 font-medium">Record</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Budgeted USD
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Estimated date
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((m) => (
                    <tr
                      key={m.id}
                      className="tbl-row border-b border-stone-200 last:border-0"
                    >
                      <td className="max-w-[18rem] px-4 py-2.5 font-medium text-stone-900">
                        <LedgerEntryName entry={m} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-amber-700/90 tnum">
                        {formatUsdCents(m.amountUsdCents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-stone-600 tnum">
                        {(m.estimatedPayoutDate ?? m.paidOutRaw) || "TBD"}
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
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
            Paid entries
            <Badge tone="emerald">{paid.length}</Badge>
          </h2>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-stone-600">
                <tr className="border-b border-stone-200">
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Budgeted USD
                  </th>
                  <th className="px-4 py-3 text-right font-medium">ZEC</th>
                  <th className="px-4 py-3 text-right font-medium">Paid on</th>
                  <th className="px-4 py-3 text-right font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {paid.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-stone-600"
                    >
                      No paid entries yet.
                    </td>
                  </tr>
                ) : null}
                {paid.map((m) => (
                  <tr
                    key={m.id}
                    className="tbl-row border-b border-stone-200 last:border-0"
                  >
                    <td className="max-w-[18rem] px-4 py-2.5 font-medium text-stone-900">
                      <LedgerEntryName entry={m} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-amber-700/90 tnum">
                      {formatUsdCents(m.amountUsdCents)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-stone-700 tnum">
                      {m.zecDisbursedZat != null
                        ? formatZec(m.zecDisbursedZat, { symbol: false })
                        : "·"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-stone-600 tnum">
                      {m.paidOutDate ?? m.paidOutRaw ?? "·"}
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
        </section>
      </RecordLayout>
    </>
  );
}
