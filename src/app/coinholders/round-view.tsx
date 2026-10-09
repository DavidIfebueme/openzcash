import Link from "next/link";
import { PROGRAM } from "@/lib/coinholder/program";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { proposalVerifyHref } from "@/lib/coinholder/proposal-decision";
import {
  QUORUM_ZEC,
  SUPPLY_ZEC,
  approvalShare,
  approvals,
  decidedZec,
  formatChange,
  formatPct,
  formatZec,
  participation,
  summarize,
} from "@/lib/coinholder/derive";
import type { Round } from "@/lib/coinholder/types";
import { ResultsBoard } from "./results-board";
import { RoundTabsNav } from "./round-tabs";
import { Stat } from "./stat";
import { VoteValue, type TodayPrice } from "./vote-value";
import { VerdictsTable, type VerdictRow } from "./verdicts-table";
import styles from "./coinholders.module.css";

const usdCompact = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    ...(cents >= 1_000_000_00
      ? { notation: "compact" as const, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }),
  });
const zecCompact = (zec: number) =>
  zec >= 1_000_000 ? `${(zec / 1_000_000).toFixed(2)}M` : formatZec(zec);
/** Keeps a short phrase on one line when a sub-line wraps in a narrow cell. */
const nb = (s: string) => s.replace(/ /g, "\u00a0");

/** Every round is a view of the results page; the newest is the default. */
export const roundHref = (id: string) =>
  id === ROUNDS[0].id
    ? "/coinholders/results"
    : `/coinholders/results?round=${id}`;
const CHRONOLOGICAL = [...ROUNDS].reverse();
const VOTED = ROUNDS.filter((r) => r.proposals.some((p) => p.tally));

/** Each vote compared with the last earlier round that held one. */
const TIMELINE = CHRONOLOGICAL.map((r, i, all) => {
  const part = participation(r);
  const before = all
    .slice(0, i)
    .reverse()
    .find((x) => participation(x));
  const beforePart = before ? participation(before) : null;
  return {
    r,
    part,
    a: approvals(r),
    s: summarize(r),
    change: part && beforePart ? part.zec / beforePart.zec - 1 : null,
    previous: before?.label ?? null,
  };
});
const LATEST = TIMELINE.filter((x) => x.r.status === "results").at(-1)!;

/** The newest round with results, as the Overview's hero: its figures and the way into its results. */
function Latest() {
  const { r, s, a, part, change, previous } = LATEST;
  const funded = s.counts.funded ?? 0;
  return (
    <section className={styles.panel} aria-labelledby="latest">
      <div className={styles.panelHead}>
        <h2 id="latest" className={styles.panelTitle}>
          {r.label} <span className={styles.panelTag}>Latest round</span>
        </h2>
        <Link href={roundHref(r.id)} className={styles.panelLink}>
          See every result →
        </Link>
      </div>
      <div className={`${styles.stats} ${styles.flush}`}>
        <Stat
          label="Funded"
          value={funded}
          unit={`of ${a.questions}`}
          sub={
            a.questions
              ? `${formatPct(funded / a.questions)} of the proposals`
              : undefined
          }
        />
        <Stat
          label="Funded requests"
          value={usdCompact(s.fundedRequestedUsdCents)}
          unit={`of ${usdCompact(s.requestedUsdCents)}`}
          sub={
            s.requestedUsdCents
              ? `${formatPct(s.fundedRequestedUsdCents / s.requestedUsdCents)} of the money`
              : undefined
          }
        />
        <Stat
          label="Participation"
          value={part ? formatPct(part.supplyShare) : "·"}
          sub={
            part
              ? `of supply${change !== null && previous ? ` · ${nb(`${formatChange(change)} vs ${previous}`)}` : ""}`
              : "no vote"
          }
        />
        <Stat
          label="ZEC voted"
          value={part ? zecCompact(part.zec) : "·"}
          unit={part ? "ZEC" : undefined}
          sub={
            part
              ? `largest single vote · ${nb(`${part.ofMinimum.toFixed(1)}× the minimum`)}`
              : "no vote"
          }
        />
      </div>
    </section>
  );
}

function Insights() {
  const scale =
    Math.max(...TIMELINE.map((x) => x.part?.supplyShare ?? 0)) * 1.08;
  const minShare = QUORUM_ZEC / SUPPLY_ZEC;
  return (
    <section aria-labelledby="insights">
      <h2 id="insights" className="sr-only">
        Participation and approval by round
      </h2>
      <div className={styles.insightGrid}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Participation by round</h3>
          <ol className={styles.bars}>
            {TIMELINE.map(({ r, part, change }) => (
              <li key={r.id}>
                <Link
                  href={roundHref(r.id)}
                  scroll={false}
                  className={styles.barLabel}
                >
                  {r.label}
                </Link>
                <span
                  className={styles.barTrack}
                  data-empty={part ? undefined : true}
                  aria-hidden
                >
                  {part ? (
                    <span
                      className={styles.barFill}
                      style={{ width: `${(part.supplyShare / scale) * 100}%` }}
                    />
                  ) : null}
                  <span
                    className={styles.barMin}
                    style={{ left: `${(minShare / scale) * 100}%` }}
                    aria-hidden
                  />
                </span>
                <span className={styles.barValue}>
                  {part ? (
                    <>
                      {change !== null ? (
                        <em data-dir={change >= 0 ? "up" : "down"}>
                          {formatChange(change)}
                        </em>
                      ) : null}
                      <strong>{formatPct(part.supplyShare)}</strong>
                    </>
                  ) : (
                    "no vote"
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.barNote}>
            <span className={styles.barMinKey} aria-hidden /> Largest single vote, as a share of the 21M supply. The mark is ZIP 1016&apos;s
            2% minimum.
          </p>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Approval by round</h3>
          <table className={styles.mini}>
            <caption className="sr-only">
              Proposals and approval share by round
            </caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">Proposals</th>
                <th scope="col">Approved</th>
                <th scope="col">Of the money</th>
              </tr>
            </thead>
            <tbody>
              {TIMELINE.filter((x) => x.r.status === "results").map(
                ({ r, a, s }) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <Link href={roundHref(r.id)} scroll={false}>
                        {r.label}
                      </Link>
                    </th>
                    <td>{a.questions}</td>
                    <td>
                      {formatPct(a.approvedShare ?? 0)}
                      {s.counts.vetoed ? (
                        <small>{`${s.counts.vetoed} vetoed`}</small>
                      ) : null}
                    </td>
                    <td>
                      {a.valueShare !== null ? formatPct(a.valueShare) : "·"}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

    </section>
  );
}

function Evolution() {
  return (
    <section aria-labelledby="evolution">
      <div className={styles.card}>
        <h2 id="evolution" className={styles.cardTitle}>
          How the rules evolved
        </h2>
        <ol className={styles.evolution}>
          {CHRONOLOGICAL.map((r) => (
            <li key={r.id}>
              <Link
                href={roundHref(r.id)}
                scroll={false}
                className={styles.evoRound}
              >
                {r.label}
              </Link>
              <ul className={styles.bullets}>
                {r.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoundTabs({ current }: { current: string }) {
  return (
    <RoundTabsNav current={current}>
      {ROUNDS.map((r) => (
        <Link
          key={r.id}
          href={roundHref(r.id)}
          scroll={false}
          className={styles.tab}
          title={r.tagline}
          aria-current={r.id === current ? "page" : undefined}
        >
          {r.label}
        </Link>
      ))}
      <span className={styles.tabDivider} aria-hidden />
      <Link
        href="/coinholders/results?round=all"
        scroll={false}
        className={styles.tab}
        title="Every verdict of every round"
        aria-current={current === "all" ? "page" : undefined}
      >
        All rounds
      </Link>
    </RoundTabsNav>
  );
}

/**
 * The round's figures that nothing else on the view repeats: the outcome
 * counts live in the outcome buttons and the round's tooltip, so the strip
 * gives the money and the turnout instead.
 */
function RoundStats({ round }: { round: Round }) {
  const s = summarize(round);
  const { part, change, previous } =
    TIMELINE.find((x) => x.r.id === round.id) ?? {
      part: participation(round),
      change: null,
      previous: null,
    };
  const money = round.proposals.some((p) => p.requestedUsdCents !== null);
  const vetoedUsd = round.proposals
    .filter((p) => p.outcome === "vetoed")
    .reduce((sum, p) => sum + (p.requestedUsdCents ?? 0), 0);
  return (
    <div className={`${styles.stats} ${styles.flush}`}>
      {money ? (
        <Stat
          label="Funded requests"
          value={usdCompact(s.fundedRequestedUsdCents)}
          unit={`of ${usdCompact(s.requestedUsdCents)}`}
          sub={[
            s.requestedUsdCents
              ? `${formatPct(s.fundedRequestedUsdCents / s.requestedUsdCents)} of the money`
              : null,
            vetoedUsd ? nb(`${usdCompact(vetoedUsd)} vetoed later`) : null,
          ]
            .filter((x): x is string => Boolean(x))
            .join(" · ")}
        />
      ) : (
        <Stat label="Poll questions" value={s.questions} sub="program terms" />
      )}
      <Stat
        label="Participation"
        value={part ? formatPct(part.supplyShare) : "·"}
        sub={
          part
            ? `of supply${change !== null && previous ? ` · ${nb(`${formatChange(change)} vs ${previous}`)}` : ""}`
            : "no vote"
        }
      />
      <Stat
        label="ZEC voted"
        value={part ? zecCompact(part.zec) : "·"}
        unit={part ? "ZEC" : undefined}
        sub={
          part
            ? `largest single vote · ${nb(`${part.ofMinimum.toFixed(1)}× the minimum`)}`
            : "no vote"
        }
      />
    </div>
  );
}

const DAY_MS = 86_400_000;
const utcDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

/**
 * A round's calendar as a stepper: a dot per phase on one hairline, its name
 * (and length, when dated) and dates centred below; the decisive last step in
 * accent, a planned date that never came hollow. Phones stack the phases down
 * a vertical hairline.
 */
function Phases({ windows }: { windows: Round["windows"] }) {
  return (
    <ol className={styles.phases}>
      {windows.map((w, i) => {
        const days =
          w.start && w.end ? utcDay(w.end) - utcDay(w.start) + 1 : null;
        const [date, ...time] = w.value.split(" · ");
        return (
          <li
            key={w.label}
            data-final={i === windows.length - 1 || undefined}
            data-missed={w.missed || undefined}
          >
            <span className={styles.phaseDot} aria-hidden />
            <span className={styles.phaseLabel}>
              {w.label}
              {days ? (
                <span className={styles.phaseDays}>{days} days</span>
              ) : null}
            </span>
            <span className={styles.phaseDate}>
              {date}
              {time.length ? <small>{time.join(" · ")}</small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const ROUND_STATUS: Record<Round["status"], string> = {
  results: "Final results",
  ratified: "Ratified",
  postponed: "Postponed",
};
const ROUND_HEADING: Record<Round["status"], (r: Round) => string> = {
  results: (r) => `${r.label} results`,
  ratified: () => "Program ratification",
  postponed: (r) => `${r.label}, postponed`,
};

function RoundResults({ round }: { round: Round }) {
  const headSource = round.sources.find(
    (x) => x.href !== round.talliesSource?.href,
  );
  return (
    <section aria-labelledby="round-heading">
      {/* The selected tab names the round on screen; the heading keeps the outline for assistive tech. */}
      <h2 id="round-heading" className="sr-only">
        {ROUND_HEADING[round.status](round)}
      </h2>
      <div className={styles.roundCard}>
        <div className={styles.roundTop}>
          <span className={styles.status} data-status={round.status}>
            {ROUND_STATUS[round.status]}
          </span>
          <p className={styles.roundLinks}>
            {round.talliesSource ? (
              <a
                href={round.talliesSource.href}
                target="_blank"
                rel="noreferrer"
              >
                Tallies ↗
              </a>
            ) : null}
            {round.proposals.some((p) => p.tally) ? (
              <Link
                href={
                  round.id === ROUNDS[0].id
                    ? "/coinholders/verify"
                    : `/coinholders/verify?round=${round.id}`
                }
                title="Rebuild these results from the published tallies"
              >
                Verify →
              </Link>
            ) : null}
            {headSource ? (
              <a href={headSource.href} target="_blank" rel="noreferrer">
                {headSource.label} ↗
              </a>
            ) : null}
          </p>
        </div>
        <p className={styles.roundSummary}>{round.summary}</p>
        {round.windows.length ? <Phases windows={round.windows} /> : null}
        {round.proposals.length ? <RoundStats round={round} /> : null}
      </div>
      {round.carriedOver?.length ? (
        <h3 className={styles.groupHead}>
          Moved to Q3 2026 <span>{round.carriedOver.length}</span>
        </h3>
      ) : null}
      {round.carriedOver?.length ? (
        <ul className={styles.carried}>
          {round.carriedOver.map((c) => (
            <li key={c.href}>
              {c.title}
              <a href={c.href} target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {round.proposals.length ? (
        <ResultsBoard
          key={round.id}
          roundId={round.id}
          proposals={round.proposals}
          ballot={round.ballot}
        />
      ) : null}
      <details className={styles.more}>
        <summary>Notes, voting system and sources</summary>
        <ul className={styles.bullets}>
          {round.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          {round.votingSystem ? <li>{round.votingSystem}</li> : null}
          {round.turnout ? <li>{round.turnout}</li> : null}
        </ul>
        <p className={styles.sources}>
          {round.talliesSource ? (
            <a href={round.talliesSource.href} target="_blank" rel="noreferrer">
              Tallies ↗
            </a>
          ) : null}
          {round.sources.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
          ))}
        </p>
      </details>
    </section>
  );
}

function AllRounds() {
  const rows: VerdictRow[] = VOTED.flatMap((r) =>
    r.proposals.map((p) => ({
      key: `${r.id}:${p.id}`,
      roundId: r.id,
      roundLabel: r.label,
      roundHref: roundHref(r.id),
      question: p.question ?? null,
      title: p.title,
      applicant: p.applicant,
      requestedUsdCents: p.requestedUsdCents,
      outcome: p.outcome,
      approvalShare: p.tally ? approvalShare(p.tally) : null,
      decidedZec: p.tally ? decidedZec(p.tally) : null,
      abstainZec: p.tally ? p.tally.abstain : null,
      href: proposalVerifyHref(r.id, p.id),
      corrected: Boolean(p.correction),
    })),
  );
  return (
    <section aria-labelledby="every-verdict">
      <h2 id="every-verdict" className="sr-only">
        Every verdict
      </h2>
      <VerdictsTable
        rows={rows}
        rounds={VOTED.map((r) => ({ id: r.id, label: r.label }))}
      />
    </section>
  );
}

function NextRound() {
  return (
    <section aria-labelledby="next">
      <h2 id="next" className={styles.sectionTitle}>
        Next round · {PROGRAM.nextRound.label}
      </h2>
      <ul className={`${styles.stats} ${styles.schedule}`}>
        {PROGRAM.nextRound.windows.map((w) => (
          <Stat key={w.label} as="li" label={w.label} value={w.value} />
        ))}
      </ul>
    </section>
  );
}

function Rules() {
  return (
    <section aria-labelledby="how">
      <h2 id="how" className={styles.sectionTitle}>
        How a round is decided
      </h2>
      <div className={styles.facts}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Coinholders vote</h3>
          <p>{PROGRAM.threshold}</p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Key-holders pay, and can veto</h3>
          <p>{PROGRAM.keyHolders}</p>
        </div>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>FPF administers</h3>
          <p>{PROGRAM.fpfRole}</p>
          <blockquote>
            “{PROGRAM.fpfRoleQuote}.”{" "}
            <a href={PROGRAM.fpfRoleSource} target="_blank" rel="noreferrer">
              Proposal ↗
            </a>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

/** The program's home: the latest round, insights across every round, the next round and the rules. */
export function OverviewView({ today }: { today: TodayPrice }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{PROGRAM.officialName}</h1>
        <p className={styles.lede}>
          Coinholders vote each quarter on grants for finished work, set in USD
          and paid in ZEC from the Coinholder-Controlled Fund.
        </p>
      </header>

      <Latest />
      <Insights />
      <VoteValue today={today} href={roundHref} />
      <Evolution />
      <NextRound />
      <Rules />

      <p className={styles.sources}>
        <Link href="/coinholders">Voting activity →</Link>
        <a href={PROGRAM.zipUrl} target="_blank" rel="noreferrer">
          ZIP 1016 ↗
        </a>
        <a href={PROGRAM.submissionsUrl} target="_blank" rel="noreferrer">
          Submissions on GitHub ↗
        </a>
        <Link href="/coinholders/fund">The fund →</Link>
      </p>
    </div>
  );
}

/** Every round's results on one page: pick a round, or all of them. */
export function ResultsView({ selected }: { selected: Round | "all" }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Results</h1>
        <p className={styles.lede}>
          Every proposal coinholders voted on, round by round, with the ZEC
          behind each answer.
        </p>
      </header>
      <RoundTabs current={selected === "all" ? "all" : selected.id} />
      {selected === "all" ? <AllRounds /> : <RoundResults round={selected} />}
      <p className={styles.sources}>
        <Link href="/coinholders">Voting activity →</Link>
        <Link href="/coinholders/overview">Program overview →</Link>
        <a href={PROGRAM.zipUrl} target="_blank" rel="noreferrer">
          ZIP 1016 ↗
        </a>
      </p>
    </div>
  );
}
