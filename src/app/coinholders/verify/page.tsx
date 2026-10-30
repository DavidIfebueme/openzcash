import Link from "next/link";
import { ACTIVE_CYCLE, cycleHref, roundParam } from "@/lib/coinholder/cycles";
import { CycleTab, PendingCycle } from "../cycle-view";
import { formatZec } from "@/lib/coinholder/derive";
import { PROGRAM } from "@/lib/coinholder/program";
import {
  VERIFIABLE_ROUNDS,
  ZIP_1016_RULE,
  findVerifiableRound,
  verifyRound,
  type RoundCheck,
} from "@/lib/coinholder/verify";
import {
  chainReport,
  zecDigits,
  type ChainReport,
} from "@/lib/coinholder/verify-export";
import { VOTE_CHAIN_ROUNDS } from "@/lib/coinholder/verify-sources";
import {
  chartText,
  decisionRows,
  nounOf,
  sortDecisions,
} from "@/lib/coinholder/verify-view";
import { fetchVoteSummary } from "@/lib/coinholder/vote-chain";
import type { Round } from "@/lib/coinholder/types";
import { APPS } from "@/lib/design-routes";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { RoundTabsNav } from "../round-tabs";
import { DecisionChart } from "./decision-chart";
import { Rebuild } from "./rebuild";
import { VerdictCard } from "./verdict-card";
import { VerifyTable } from "./verify-table";
import styles from "../coinholders.module.css";
import own from "./verify.module.css";

// The latest round is compared live with the vote chain (cached in-process for an hour).
export const dynamic = "force-dynamic";

/** The program's name as the sidebar gives it ("Coinholder Grants"). */
const PROGRAM_LABEL =
  APPS.find((a) => a.id === "coinholders")?.label ?? PROGRAM.officialName;

export const metadata = pageMetadata({
  title: `Verify it yourself · ${PROGRAM.officialName} · OpenZcash`,
  description:
    "Every coinholder vote's ZEC per option, ZIP 1016 applied to it and the published outcome, with the vote-chain data, CSV, JSON and a script to check it yourself.",
  path: "/coinholders/verify",
  card: {
    title: "Verify it yourself",
    kicker: "Every tally, the ZIP 1016 rule and the published outcome",
    stat: `${ACTIVE_CYCLE.label} · In progress`,
  },
});

const verifyHref = (id: string) => cycleHref("verify", id);
const resultsHref = (id: string) => cycleHref("results", id);
function RoundTabs({ current }: { current: string }) {
  return (
    <RoundTabsNav current={current}>
      <CycleTab view="verify" current={current} />
      {VERIFIABLE_ROUNDS.map((r) => (
        <Link
          key={r.id}
          href={verifyHref(r.id)}
          scroll={false}
          className={styles.tab}
          title={r.tagline}
          aria-current={r.id === current ? "page" : undefined}
        >
          {r.label}
        </Link>
      ))}
    </RoundTabsNav>
  );
}

/** What the page checked this time, and what it cannot check yet; every line follows from the check itself. */
function Limits({
  round,
  check,
  chain,
}: {
  round: Round;
  check: RoundCheck;
  chain: ChainReport | null;
}) {
  const c = check.counts;
  const noun = check.kind === "poll" ? "questions" : "proposals";
  const agreed =
    c.ruleAgrees === c.ruleChecked
      ? `all ${c.ruleChecked}`
      : `${c.ruleAgrees} of ${c.ruleChecked}`;
  const differ =
    chain?.status === "ok" ? (c.chainChecked ?? 0) - (c.chainMatches ?? 0) : 0;
  const abstain = round.ballot.some((o) => o.key === "abstain");
  const minimum = `${formatZec(ZIP_1016_RULE.quorumZec)} ZEC`;
  return (
    <section aria-labelledby="limits">
      <h2 id="limits" className={styles.sectionTitle}>
        What this checks, and what it does not yet
      </h2>
      <div className={own.pair}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Checked here</h3>
          <ul className={styles.bullets}>
            {chain?.status === "ok" ? (
              <li>
                {differ === 0
                  ? "Each tally on this site equals the vote chain's finalized summary, all four options to the 0.125 ZEC, fetched live and hashed."
                  : `Each tally was compared with the vote chain's finalized summary, fetched live and hashed; ${differ} ${differ === 1 ? "differs and is" : "differ and are"} marked in the table.`}
              </li>
            ) : null}
            {check.kind === "poll" ? (
              <li>
                ZIP 1016&apos;s test, applied for comparison only: the poll set
                the program&apos;s terms. It gives the published result for{" "}
                {agreed} {noun}.
              </li>
            ) : (
              <li>
                ZIP 1016 applied to these tallies gives the published outcome
                for {agreed} {noun}.
              </li>
            )}
            {abstain ? (
              <li>
                {c.turnsOnAbstain === 0
                  ? `No outcome depends on whether Abstain counts toward the ${minimum} minimum.`
                  : `${c.turnsOnAbstain} ${c.turnsOnAbstain === 1 ? "outcome depends" : "outcomes depend"} on whether Abstain counts toward the ${minimum} minimum, which ZIP 1016 does not say.`}
              </li>
            ) : null}
            {check.rows.some((r) => r.note) ? (
              <li>
                Corrections, vetoes and discarded questions are shown where they
                changed or ended a result.
              </li>
            ) : null}
          </ul>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Not checked yet</h3>
          <ul className={styles.bullets}>
            {chain?.status === "unavailable" ? (
              <li>
                The comparison with the vote chain did not run this time:
                neither server answered. Reload in a few minutes, or run the
                steps above.
              </li>
            ) : null}
            {chain ? (
              <li>
                Re-deriving the finalized summary from the encrypted shares in
                the vote chain&apos;s blocks. This page reads the summary the
                chain&apos;s servers publish; the hash shows you read the same
                bytes.
              </li>
            ) : (
              <>
                <li>
                  That each figure here matches the post it comes from: the
                  table is this site&apos;s copy of the published totals, not
                  read from the post on each visit. The post is linked above.
                </li>
                <li>
                  Recounting the ballots themselves. The published seeds let
                  anyone do it with the tools above.
                </li>
              </>
            )}
            <li>How many holders voted: the vote reveals ZEC, not people.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { round: param } = await searchParams;
  const id = roundParam(param);
  const round = id ? findVerifiableRound(id) : undefined;
  if (!round) {
    return <div className={styles.page}>
      <header className={styles.head}><h1 className={styles.title}>Verify it yourself</h1></header>
      <RoundTabs current={ACTIVE_CYCLE.id} />
      <PendingCycle view="verify" />
    </div>;
  }
  const chainId = VOTE_CHAIN_ROUNDS[round.id];
  const live = chainId ? await fetchVoteSummary(chainId) : null;
  const check = verifyRound(round, live?.ok ? live.summary : null);
  const chain = chainReport(round.id, live);
  const digits = zecDigits(check);
  const decisions = decisionRows(round, check, digits);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Verify it yourself</h1>
        <p className={styles.lede}>
          Check published tallies against the voting rules, with source data
          and a reproducible script.
        </p>
      </header>
      <RoundTabs current={round.id} />
      <VerdictCard
        round={round}
        check={check}
        chain={chain}
        program={PROGRAM_LABEL}
      />
      <Rebuild round={round} check={check} chain={chain} />
      <DecisionChart
        roundId={round.id}
        rows={decisions}
        orders={{
          share: sortDecisions(decisions, "share").map((r) => r.id),
          ballot: sortDecisions(decisions, "ballot").map((r) => r.id),
        }}
        text={chartText(round, check)}
      />
      <details className={own.allFigures}>
        <summary>
          <h2 id="every" className={own.allTitle}>
            All figures{" "}
            <span>
              ({check.rows.length} {nounOf(check, check.rows.length)})
            </span>
          </h2>
          <span className={own.chev} aria-hidden />
        </summary>
        <VerifyTable
          check={check}
          ballot={round.ballot}
          digits={digits}
          flush
        />
      </details>
      <Limits round={round} check={check} chain={chain} />
      <p className={styles.sources}>
        <Link href={resultsHref(round.id)}>{round.label} results →</Link>
        <a href={ZIP_1016_RULE.href} target="_blank" rel="noreferrer">
          ZIP 1016 ↗
        </a>
        <a
          href={ZIP_1016_RULE.participationConfirmedBy.href}
          target="_blank"
          rel="noreferrer"
        >
          {ZIP_1016_RULE.participationConfirmedBy.label} ↗
        </a>
        {round.sources
          .filter((s) => s.href !== round.talliesSource?.href)
          .slice(0, 1)
          .map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
          ))}
      </p>
    </div>
  );
}
