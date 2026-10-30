import Link from "next/link";
import { Q4 } from "@/lib/coinholder/q4";
import { Card, Stat } from "@/components/ui";
import { OrgHeader } from "@/components/org-header";
import { listGrants } from "@/lib/zcg/grants-repo";
import { listProposals, proposalsFunnel } from "@/lib/zcg/proposals-repo";
import {
  listDisbursements,
  summarizeDisbursements,
} from "@/lib/zcg/disbursements-repo";
import { getLinks } from "@/lib/zcg/governance-repo";
import { formatUsdCents } from "@/lib/zcg/format";
import {
  FpfGrantsTable,
  FpfProposalsTable,
  type GrantTableRow,
  type ProposalTableRow,
} from "./fpf-tables";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { publicationDay } from "@/lib/zcg/publication-policy";
import {
  COINHOLDER_VERDICT_LABEL,
  grantStatusLabel as sharedGrantStatusLabel,
} from "@/lib/zcg/status-labels";
import {
  awaitingGrantsMissingFrom,
  coinholderGrantViews,
  officialProposalVerdict,
} from "@/lib/coinholder/official-status";
import { pageMetadata } from "@/lib/seo/page-metadata";

/** The coinholder tab has a few dozen rows; the list's default cap of 250 is far above it. */
const LEDGER_ROWS = 1000;

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Financial Privacy Foundation · program administrator · OpenZcash",
  description:
    "The Financial Privacy Foundation administers the Coinholder-Directed Retroactive Grants Program: submissions, review, KYC and reporting. Coinholders decide the grants.",
  path: "/zcg/fpf",
  card: { title: "Financial Privacy Foundation", section: null },
});

// Shared vocabularies; the coinholder programme keeps its own verdict wording.
const PROPOSAL_VERDICT_LABEL = COINHOLDER_VERDICT_LABEL;

function grantStatusLabel(status: string | null): string {
  return sharedGrantStatusLabel(status, "·");
}

export default async function FpfCoinholderGrantsPage() {
  const [grants, proposals, funnel, links, paid, entries] = await Promise.all([
    cached("listGrants:coinholder", LEDGER_TTL_MS, () =>
      listGrants({ program: "coinholder" }),
    ),
    cached(`listProposals:coinholder:${publicationDay()}`, LEDGER_TTL_MS, () =>
      listProposals({ program: "coinholder" }),
    ),
    cached(`proposalsFunnel:${publicationDay()}`, LEDGER_TTL_MS, () =>
      proposalsFunnel(),
    ),
    cached("links", LEDGER_TTL_MS, () => getLinks()),
    cached("summarizeDisbursements:coinholder_grants", LEDGER_TTL_MS, () =>
      summarizeDisbursements({ sheet: "coinholder_grants" }),
    ),
    cached("listDisbursements:coinholder_grants", LEDGER_TTL_MS, () =>
      listDisbursements({ sheet: "coinholder_grants", limit: LEDGER_ROWS }),
    ),
  ]);
  const proposalFpf = links.proposal_fpf ?? "#";
  const cryptpadMilestone = links.cryptpad_milestone ?? "#";

  // Paid USD of the coinholder ledger: settled entries only, so grants
  // approved and still awaiting payment do not count as paid.
  const coinholderPaidCents = paid.usdPaidCents;
  const coinholderProposalCount =
    funnel.byProgram.find((p) => p.program === "coinholder")?.count ??
    proposals.length;

  // Closed rounds follow FPF's published results; the ledger's "Open" on an
  // approved, unpaid grant of such a round reads as awaiting payment. A
  // project name FPF reused for a later grant is shown as its two grants.
  const grantViews = grants.flatMap((g) =>
    coinholderGrantViews(g, entries).map((v) => ({ ...g, ...v })),
  );
  const grantRows: GrantTableRow[] = grantViews.map((g) => ({
    grantKey: g.grantKey,
    grantee: g.grantee,
    category: g.category ?? "·",
    status: g.official?.status ?? g.status,
    statusLabel: g.official?.label ?? grantStatusLabel(g.status),
    _usd: Number(g.usdCents),
  }));
  // Approved grants the tab does not list yet (it lags the results post).
  const unlisted = grantRows.length
    ? awaitingGrantsMissingFrom(grantViews)
    : [];

  const proposalRows: ProposalTableRow[] = proposals.map((p) => {
    const status = officialProposalVerdict(p)?.status ?? p.status;
    return {
      id: p.id,
      title: p.title,
      applicant: p.applicantsRaw ?? "·",
      status,
      verdictLabel: PROPOSAL_VERDICT_LABEL[status] ?? status,
      platformLink: p.platformLink,
      _usd: p.requestedUsdCents == null ? 0 : Number(p.requestedUsdCents),
    };
  });

  return (
    <>
      <OrgHeader
        name="Financial Privacy Foundation"
        logo="/logos/fpf.png"
        tagline="Administrator of the Coinholder-Directed Retroactive Grants Program: it runs the calls for proposals, review summaries, KYC and reporting, and coordinates payouts with the key-holders. Coinholders decide every grant."
        links={[
          { href: proposalFpf, label: "Submit a proposal" },
          { href: cryptpadMilestone, label: "Submit a milestone" },
        ]}
      />

      <Link
        href="/coinholders"
        className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 hover:border-amber-500/40"
      >
        <span>
          <strong className="font-semibold text-stone-900">
            Coinholder-Directed Retroactive Grants Program
          </strong>
          {" · "}every round, outcome and vote tally
        </span>
        <span aria-hidden>→</span>
      </Link>

      <Link href={Q4.href} className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 hover:border-amber-500/40">
        <span><strong className="font-semibold text-stone-900">Coinholder proposals</strong>{" · "}current round</span>
        <span aria-hidden>→</span>
      </Link>

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat
          label="Grants"
          value={String(grantRows.length)}
          sub="coinholder directed"
        />
        <Stat
          label="Total paid"
          value={formatUsdCents(coinholderPaidCents, { compact: true })}
          sub="USD settled across coinholder grants"
        />
        <Stat
          label="Proposals"
          value={String(coinholderProposalCount)}
          sub="submitted to the program"
          tone="warn"
        />
      </section>

      <>
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-stone-700">
            Coinholder grants
          </h2>
          <Card className="p-0 overflow-hidden">
            <FpfGrantsTable grantRows={grantRows} />
          </Card>
          <p className="mt-3 text-xs text-stone-600">
            {grantRows.length} grants · one approved grant per row · amounts in
            USD with ZEC equivalents tracked in the ledger.
            {grantRows.some((g) => g.status === "awaiting_payment")
              ? " Awaiting payment: approved by coinholders, no payout recorded yet."
              : ""}
            {unlisted.length
              ? ` Approved but not in FPF's grants tab yet: ${unlisted
                  .map((u) => `${u.title} (${u.roundLabel})`)
                  .join(", ")}.`
              : ""}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-700">
            Coinholder proposals
          </h2>
          <Card className="p-0 overflow-hidden">
            <FpfProposalsTable proposalRows={proposalRows} />
          </Card>
          <p className="mt-3 text-xs text-stone-600">
            {proposals.length} proposals · the pipeline upstream of the grants
            above · only approved proposals become paid grants. Verdicts of
            closed rounds follow FPF&apos;s official results; other rows mirror
            the spreadsheet.
          </p>
        </section>
      </>
    </>
  );
}
