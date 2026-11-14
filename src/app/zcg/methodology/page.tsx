
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { Synced } from "@/components/synced";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "How we compute this · OpenZcash",
  description:
    "OpenZcash is a read-only mirror: it never holds spend keys and moves no funds. Every figure comes from public sources. Here is how.",
  path: "/zcg/methodology",
});

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-stone-800">{title}</h2>
      <Card className="text-sm leading-relaxed text-stone-600">{children}</Card>
    </section>
  );
}

const SOURCES: { name: string; what: string }[] = [
  {
    name: "ZCG public spreadsheet",
    what: "The disbursements ledger, recipient and classification pivots, and ZCG and Coinholder proposal history. Collection is scheduled every six hours. A successful collection does not mean the source was recently edited.",
  },
  {
    name: "GitHub issue tracker",
    what: "Live grant applications (ZcashCommunityGrants/zcashcommunitygrants), read first-hand from open issues: applications carry the “Grant Application” label, and “Ready For ZCG Review” marks the queue awaiting the committee's judgement. Hand-filed re-applications can arrive without labels and are recognised by their title; an open application with no decision label counts as awaiting review. This is the rawest stage, before anything reaches the spreadsheet. The issue list is cached for about fifteen minutes.",
  },
  {
    name: "Zcash Community Forum",
    what: "ZCG meeting minutes, imported from the Discourse #grants category during the six-hour cycle, best-effort: a failed forum import never marks the collection stale.",
  },
  {
    name: "On-chain (lightwalletd)",
    what: "The Lockbox / ZIP-1016 ZEC balance: the latest spreadsheet Lockbox snapshot plus protocol-deterministic accrual (0.06249999 ZEC per block since NU7 and 0.1875 ZEC before it, ZIP-1015 and ZIP-218) up to the live chain tip, which lightwalletd supplies read-only. No viewing-key scans run. Market prices, grant approvals and milestone delivery are not facts supplied by the chain.",
  },
  {
    name: "CoinGecko, CoinPaprika, Coinbase",
    what: "The current ZEC/USD market price from CoinGecko, or from CoinPaprika and then Coinbase when CoinGecko is unavailable, cached for approximately ten minutes; every quote names its provider and quote time. If all three are unavailable, the last cached price or the spreadsheet's recorded rate may be used. This price is not read from the Zcash chain.",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        title="How we compute this"
        subtitle="OpenZcash is a read-only mirror: it never holds spend keys and moves no funds. Every figure comes from public sources. Here is how."
      />

      <>
        <Section title="Where the data comes from" id="sources">
          <ul className="space-y-2">
            {SOURCES.map((s) => (
              <li key={s.name}>
                <span className="font-medium text-stone-800">{s.name}</span>:{" "}
                {s.what}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Rule 1 · Source precedence" id="precedence">
          <p>
            When sources disagree, the disagreement is published rather than
            blended, and each figure names the source that wins for it:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="font-medium text-stone-800">
                Grant payments, budgets and recipient totals
              </span>
              : the official spreadsheet is the primary ledger. OpenZcash
              mirrors it; it does not correct it.
            </li>
            <li>
              <span className="font-medium text-stone-800">
                Proposal status
              </span>
              : a committee decision visible on GitHub is shown until the
              spreadsheet records the same verdict; once the spreadsheet&apos;s
              verdict is publication-eligible, it takes priority.
            </li>
            <li>
              <span className="font-medium text-stone-800">
                Application text and requested amounts
              </span>
              : the GitHub issue is first-hand.
            </li>
            <li>
              <span className="font-medium text-stone-800">
                Third-party grant lists
              </span>{" "}
              (for example the pgpz prototype API) are supplementary: never a
              substitute for ledger totals, and disagreements are flagged
              rather than silently resolved.
            </li>
            <li>
              <span className="font-medium text-stone-800">The forum</span>{" "}
              provides discussion and minutes, not figures.
            </li>
          </ul>
        </Section>

        <Section
          title="Rule 2 · Refresh is retrieval, not source edit"
          id="refresh"
        >
          <p>
            Every source runs on its own schedule, and none of these timestamps
            describe when the underlying source was last edited. A stale pull
            does not imply a stale source; a fresh pull does not imply a recent
            one.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="py-1.5 pr-3 font-medium">Source</th>
                  <th className="py-1.5 pr-3 font-medium">Cadence</th>
                  <th className="py-1.5 font-medium">
                    What the timestamp means
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="py-1.5 pr-3 align-top">Spreadsheet</td>
                  <td className="py-1.5 pr-3 align-top">every 6 hours</td>
                  <td className="py-1.5 align-top">
                    Retrieval time of the last complete import, stamped even
                    when the sheet is unchanged; flagged overdue after a
                    seven-hour grace.
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 align-top">GitHub issues</td>
                  <td className="py-1.5 pr-3 align-top">
                    cached ~15 minutes
                  </td>
                  <td className="py-1.5 align-top">
                    Fetch time of the issue list, independent of the six-hour
                    cycle.
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 align-top">Market price</td>
                  <td className="py-1.5 pr-3 align-top">cached ~10 minutes</td>
                  <td className="py-1.5 align-top">
                    The provider&apos;s own quote time is named on every quote;
                    provider order is CoinGecko, CoinPaprika, Coinbase.
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 align-top">Chain tip</td>
                  <td className="py-1.5 pr-3 align-top">cached ~60 seconds</td>
                  <td className="py-1.5 align-top">
                    Height read from lightwalletd; separate from the sheet and
                    price caches.
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 align-top">Forum minutes</td>
                  <td className="py-1.5 pr-3 align-top">
                    inside the 6-hour cycle
                  </td>
                  <td className="py-1.5 align-top">
                    Import time, best-effort: a failed forum import never marks
                    the collection stale.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="How each classification is tagged" id="classifications">
          <p className="mb-2">
            On the{" "}
            <Link href="/zcg/totals" className="text-amber-700 hover:underline">
              totals
            </Link>{" "}
            page every classification is labelled by its <em>nature</em>, so a
            reader can tell a grant apart from ZCG spending on itself:
          </p>
          <ul className="space-y-1.5">
            <li>
              <span className="font-medium text-emerald-700">Grant</span>:
              funding paid to an external project or contributor.
            </li>
            <li>
              <span className="font-medium text-amber-700">ZCG operations</span>
              : the committee&apos;s own budget (travel, conferences, tooling);
              the{" "}
              <span className="font-mono text-xs">
                ZCG Discretionary Budget
              </span>{" "}
              bucket.
            </li>
            <li>
              <span className="font-medium text-violet-700">
                Committee stipends
              </span>
              : salaries paid to ZCG members; see{" "}
              <Link
                href="/zcg/stipends"
                className="text-amber-700 hover:underline"
              >
                stipends
              </Link>
              .
            </li>
            <li>
              <span className="font-medium text-sky-700">
                Security · audits
              </span>
              : third-party security audits and bug bounties (the{" "}
              <span className="font-mono text-xs">Audits</span> classification).
              Bounties also appear as milestones inside individual grants.
            </li>
          </ul>
        </Section>

        <Section title="Why the two “discretionary” figures differ" id="discretionary">
          <p>
            The discretionary budget appears two ways, and the two numbers
            differ on purpose:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              The <span className="font-medium">ZCG operations</span> figure on
              the totals split (~$1.8M) comes from the{" "}
              <span className="font-medium">totals pivot</span>: the cumulative
              classification total published in the spreadsheet.
            </li>
            <li>
              The discretionary <span className="font-medium">budget tab</span>{" "}
              ($1M annual cap, ~$1.27M spent) is a separate annual worksheet.
            </li>
          </ul>
          <p className="mt-2">
            Two readings of the same programme at different scopes (cumulative
            pivot vs. annual budget). That is why the{" "}
            <Link href="/zcg/totals" className="text-amber-700 hover:underline">
              totals
            </Link>{" "}
            page shows a live ledger-vs-published cross-check instead of
            asserting they match.
          </p>
        </Section>

        <Section title="Rule 3 · USD vs ZEC" id="usd-vs-zec">
          <p>
            Three quantities appear across this site. They describe different
            things and must not be added together:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <span className="font-medium text-stone-800">Budgeted USD</span>:
              includes paid and unpaid entries, including amounts recorded for
              cancelled grants.
            </li>
            <li>
              <span className="font-medium text-stone-800">USD paid</span>: the
              budgeted value of entries marked paid, not their current market
              value.
            </li>
            <li>
              <span className="font-medium text-stone-800">ZEC paid</span>: the
              quantity recorded by the spreadsheet, at its own recorded rate.
            </li>
          </ul>
          <p className="mt-2">
            Historical ZEC is never revalued at today&apos;s price. Treasury
            USD valuations use the available market price; historical entries
            keep their recorded rate. The{" "}
            <Link
              href="/zcg/reconciliation"
              className="text-amber-700 hover:underline"
            >
              reconciliation
            </Link>{" "}
            page shows ZEC paid and USD paid side by side: read them as two
            columns of one ledger, not one total.
          </p>
        </Section>

        <Section title="Rule 4 · Payment ≠ delivery" id="payment-not-delivery">
          <p>
            An approval is not a payment. A recorded payment is a ledger entry,
            not independent proof that a milestone was delivered or that it had
            impact. Unpaid entries are not necessarily outstanding commitments:
            check the grant&apos;s status and the original source. Cancelled
            grants remain inside some budgeted totals and are labelled as such.
          </p>
          <p className="mt-2">
            This is the rule agents quoting these figures repeat: Zarvis and
            the published ZCG copilot skill state the same thing.
          </p>
        </Section>

        <Section title="Rule 5 · Reconciliation limits" id="reconciliation">
          <p>
            The transparent treasury reveals aggregate flow only: the Lockbox
            feeds ZCG&apos;s operating treasury, which moves ZEC into the
            shielded pool. Individual grantee payments leave the shielded pool
            and are private by design; auditing them one by one would require
            ZCG&apos;s shielded viewing key, which OpenZcash does not hold or
            use. The cross-check is stored treasury flow plus spreadsheet
            integrity — never a per-payment on-chain proof. Current figures and
            the stored scan:{" "}
            <Link
              href="/zcg/reconciliation"
              className="text-amber-700 hover:underline"
            >
              reconciliation
            </Link>
            .
          </p>
        </Section>

        <section id="limits" className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-stone-800">
            What this page does not claim
          </h2>
          <Card className="border-amber-500/20 bg-amber-500/[0.06] text-sm leading-relaxed text-amber-800/80">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                OpenZcash is a read-only mirror: it never holds spend keys,
                moves no funds, does not audit ZCG and does not speak for the
                committee.
              </li>
              <li>Nothing here is real time; every figure carries a retrieval time.</li>
              <li>An approval is not a payment, and a payment is not delivery.</li>
              <li>
                There is no per-payment on-chain proof; see{" "}
                <Link
                  href="/zcg/reconciliation"
                  className="underline hover:no-underline"
                >
                  reconciliation
                </Link>
                .
              </li>
            </ul>
          </Card>
        </section>

        <Section title="Reproduce it yourself" id="api">
          <p>
            Every number here is queryable.{" "}
            <Link href="/api/zcg" className="text-amber-700 hover:underline">
              /api/zcg
            </Link>{" "}
            is a read-only JSON index of the endpoints; the data endpoints
            under{" "}
            <span className="font-mono text-xs">/api/zcg/data/</span>{" "}
            (disbursements, recipients, grants) also return CSV via{" "}
            <span className="font-mono text-xs">?format=csv</span>.
            Disbursement rows carry provenance: the source sheet and row, a
            link to the live source row, and the collection time — which is
            retrieval, not publication.
          </p>
        </Section>

        <Section title="Corrections" id="corrections">
          <p>
            Spot a wrong figure? Open an issue at{" "}
            <a
              href="https://github.com/Michae2xl/openzcash/issues"
              className="text-amber-700 hover:underline"
            >
              github.com/Michae2xl/openzcash/issues
            </a>
            . Source corrections reach this site on the next scheduled
            collection and are recorded automatically in the overview changelog
            and the{" "}
            <a
              href="/api/feeds/zcg.xml"
              className="text-amber-700 hover:underline"
            >
              RSS feed
            </a>
            . Errors in this site&apos;s own copy are fixed in the repository.
          </p>
        </Section>
      </>
      <Synced className="mt-6" />
    </>
  );
}
