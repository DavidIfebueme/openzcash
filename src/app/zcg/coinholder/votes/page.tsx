import Link from "next/link";
import { Badge, PageHeader, Stat } from "@/components/ui";
import { SectionHeading, SourceNote } from "@/components/workspace";
import {
  DecidedBy,
  DecisionHomes,
} from "@/components/governance/decision-homes";
import { DecisionsTable } from "@/components/governance/decisions-table";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { listProposals } from "@/lib/zcg/proposals-repo";
import {
  pollDecisions,
  proposalDecisions,
  sortDecisions,
  type RecordPoll,
} from "@/lib/governance/decisions";
import record from "@/data/governance/record.json";
import styles from "@/components/governance/timeline.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Coinholder votes · FPF · OpenZcash",
  description:
    "How Zcash coinholders direct the coinholder fund: the poll that set up the grants program, each quarterly round, and the verdict on every proposal, with the key-holders' veto.",
};

const POLLS = (record as unknown as { polls: RecordPoll[] }).polls;

const shortDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "·";

export default async function CoinholderVotesPage() {
  const proposals = await cached("listProposals:all", LEDGER_TTL_MS, () =>
    listProposals({}),
  ).catch(() => []);

  const verdicts = sortDecisions(
    proposalDecisions(proposals, [], []).filter(
      (r) => r.process === "coinholders",
    ),
  );
  const polls = sortDecisions(pollDecisions(POLLS, "fund"));
  const rounds = POLLS.filter(
    (p) => p.scope === "fund" && p.kind === "grant_decision",
  );
  const roundsDecided = rounds.filter((p) => p.status === "closed").length;
  const open = rounds.find((p) => p.status === "open");
  const openQuarter = open?.name.match(/Q[1-4] \d{4}/)?.[0] ?? null;
  const count = (outcome: string) =>
    verdicts.filter((r) => r.outcome === outcome).length;

  return (
    <>
      <PageHeader
        title="Coinholder votes"
        subtitle="How coinholders direct the fund that received the lockbox at NU6.1: the poll that set up the grants program, each quarterly round, and the verdict on every proposal. A proposal passes when at least 420,000 ZEC vote and a simple majority approves; the key-holders sign the payouts and can veto them (ZIP 1016)."
        actions={<DecidedBy who="Coinholders" how="key-holders can veto" />}
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Rounds decided"
          value={String(roundsDecided)}
          sub={
            open
              ? `${openQuarter ?? "A"} round: voting until ${shortDate(open.date)}`
              : "no round open"
          }
        />
        <Stat
          label="Approved"
          value={String(count("Approved"))}
          sub="passed the coinholder vote"
        />
        <Stat
          label="Rejected"
          value={String(count("Rejected"))}
          sub="by coinholder vote"
        />
        <Stat
          label="Vetoed"
          value={String(count("Vetoed"))}
          sub="by the key-holders"
        />
      </section>

      <SectionHeading
        title="Polls"
        count={polls.length}
        description="The program's ratification and every quarterly round, newest first."
        action={
          <Link
            href="/zcg/coinholder"
            className="text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            Current round →
          </Link>
        }
      />
      <ol className={styles.timeline}>
        {polls.map((p) => (
          <li key={p.id}>
            <time>{shortDate(p.date)}</time>
            <span>
              <strong>{p.subject}</strong>
              {p.detail ? (
                <span className={styles.status}>{p.detail}</span>
              ) : p.outcome === "Voting open" ? (
                <span className={styles.status}>
                  Voting until {shortDate(p.date)}.
                </span>
              ) : null}
            </span>
            <span className={styles.outcome}>
              <Badge tone={p.tone}>{p.outcome}</Badge>
              <span className={styles.links}>
                {p.sources.slice(0, 2).map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.label} ↗
                  </a>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <SectionHeading
        title="Every proposal"
        count={verdicts.length}
        description="The verdict on each proposal put to coinholders. Filter by outcome or decider; export the view as CSV."
        action={
          <Link
            href="/zcg/coinholder/pool"
            className="text-xs font-medium text-amber-700 hover:text-amber-900"
          >
            The fund →
          </Link>
        }
      />
      <DecisionsTable
        rows={verdicts}
        csvName="coinholder-fund-verdicts.csv"
        hide={["process"]}
      />

      <DecisionHomes current="fund" />

      <SourceNote>
        Proposal verdicts come from the official Coinholder sheet; polls from
        their published results and the program&apos;s forum threads. Voting
        rules from ZIP 1016.
      </SourceNote>
    </>
  );
}
