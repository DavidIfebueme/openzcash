import { SectionHeading, SourceNote } from "@/components/workspace";
import {
  DecidedBy,
  DecisionHomes,
} from "@/components/governance/decision-homes";
import { DecisionsTable } from "@/components/governance/decisions-table";
import { GovernanceViews } from "@/components/governance/governance-views";
import { HowItWorks } from "@/components/governance/how-it-works";
import { OpenDecisionView } from "@/components/governance/open-decision";
import { PollComparison } from "@/components/governance/poll-comparison";
import {
  GovernanceTerms,
  WhoDoesWhat,
} from "@/components/governance/who-does-what";
import { getArboristCalls, type ArboristCall } from "@/lib/arborist/notes";
import { dateOfHeight } from "@/lib/funding/history";
import {
  pollDecisions,
  sortDecisions,
  type RecordPoll,
} from "@/lib/governance/decisions";
import { OPEN_DECISION, todayUtc } from "@/lib/governance/open-decisions";
import {
  PENDING_TOPICS,
  UPGRADES,
  blockLink,
  matchesTopic,
  zipLink,
} from "@/lib/governance/upgrades";
import record from "@/data/governance/record.json";
import styles from "@/components/governance/timeline.module.css";
import { pageMetadata } from "@/lib/seo/page-metadata";
import pageStyles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Zcash governance · OpenZcash",
  description:
    "How a change becomes a Zcash rule, what is being decided now, and the record: every network upgrade and how it was decided, and the coinholder polls on protocol and funding.",
  path: "/governance",
});

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

function callsAbout(calls: ArboristCall[], topics: RegExp[]) {
  return calls.filter((c) => matchesTopic(c.agenda.join(" · "), topics));
}

function CallLinks({
  calls,
  agendas,
}: {
  calls: ArboristCall[];
  agendas: boolean;
}) {
  if (!agendas)
    return <span className={styles.muted}>Agendas unavailable</span>;
  if (calls.length === 0)
    return <span className={styles.muted}>No agenda mention</span>;
  const shown = calls.slice(0, 3);
  return (
    <span className={styles.links}>
      {shown.map((c) => (
        <a
          key={`${c.number}-${c.date}`}
          href={c.video ?? c.url ?? "/arborist"}
          target="_blank"
          rel="noreferrer"
        >
          {c.number ? `#${c.number}` : "Call"} · {shortDate(c.date)} ↗
        </a>
      ))}
      {calls.length > shown.length ? (
        <span className={styles.muted}>
          +{calls.length - shown.length} more
        </span>
      ) : null}
    </span>
  );
}

export default async function GovernancePage() {
  const calls = await getArboristCalls().catch(() => [] as ArboristCall[]);
  const byNewest = [...calls].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  // The archive can fall back to recordings without agendas (for example when
  // the notes repository is rate limited): never read that as "not discussed".
  const agendas = calls.some((c) => c.agenda.length > 0);

  const upgrades = UPGRADES.map((u) => ({
    ...u,
    date: dateOfHeight(u.height) ?? "",
  })).filter((u) => u.date);
  const polls = sortDecisions(pollDecisions(POLLS, "network"));

  const pollsPanel = (
    <>
      <PollComparison />
      <SectionHeading
        title="Coinholder polls"
        count={polls.length}
        description="Coin-weighted polls on the protocol and the funding model. Polls about the coinholder fund's grants live with the fund."
      />
      <DecisionsTable
        rows={polls}
        csvName="zcash-network-polls.csv"
        hide={["process"]}
      />
    </>
  );

  const upgradesPanel = (
    <>
      <SectionHeading
        title="Network upgrades"
        description="Every activated upgrade with its block, the process that decided it, its ZIP and the Arborist calls whose agenda named it."
      />
      <ol className={styles.timeline}>
        {[...upgrades].reverse().map((u) => {
          const block = blockLink(u.height);
          const zip = u.zips[0] !== undefined ? zipLink(u.zips[0]) : null;
          return (
            <li key={u.name}>
              <time>{shortDate(u.date)}</time>
              <span>
                <strong>{u.label}</strong>
                <span className={styles.muted}> · {u.decidedBy}</span>
                <span className={styles.status}>
                  <a href={block.href} target="_blank" rel="noreferrer">
                    Block {u.height.toLocaleString("en-US")} ↗
                  </a>
                  {zip ? (
                    <a href={zip.href} target="_blank" rel="noreferrer">
                      {zip.label} ↗
                    </a>
                  ) : null}
                </span>
              </span>
              <CallLinks
                calls={callsAbout(byNewest, u.topics)}
                agendas={agendas}
              />
            </li>
          );
        })}
      </ol>

      <SectionHeading
        title="Still being decided"
        description="The decision open now, and protocol work that Arborist call agendas keep returning to, not yet activated on mainnet."
      />
      <ol className={styles.timeline}>
        <li>
          <time dateTime={OPEN_DECISION.opens}>{OPEN_DECISION.window}</time>
          <span>
            <strong>{OPEN_DECISION.title}</strong>
            <span className={styles.muted}> · {OPEN_DECISION.round}</span>
          </span>
          <span className={styles.links}>
            <a
              href={OPEN_DECISION.source.href}
              target="_blank"
              rel="noreferrer"
            >
              {OPEN_DECISION.source.label} ↗
            </a>
          </span>
        </li>
        {PENDING_TOPICS.map((t) => {
          const about = callsAbout(byNewest, t.topics);
          return (
            <li key={t.label}>
              <time>{agendas ? `${about.length} calls` : "·"}</time>
              <span>
                <strong>{t.label}</strong>
                <span className={styles.muted}>
                  {" "}
                  {agendas && about.length > 0
                    ? `· first on the agenda ${shortDate(about.at(-1)?.date ?? null)}`
                    : ""}
                </span>
                {t.status ? (
                  <span className={styles.status}>
                    {t.status}.{" "}
                    {t.sources.map((s) => (
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
                ) : null}
              </span>
              <CallLinks calls={about} agendas={agendas} />
            </li>
          );
        })}
      </ol>
    </>
  );

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.heading}>
        <div>
          <h1>Zcash governance</h1>
          <p>How Zcash decides, what is open now, and the record so far.</p>
        </div>
        <div className={pageStyles.decision}>
          <DecidedBy
            who="ZIP process and coinholders"
            how="each row names its process"
          />
        </div>
      </header>

      <GovernanceViews
        live="now"
        counts={{ polls: polls.length, upgrades: upgrades.length }}
        panels={{
          how: <HowItWorks decision={OPEN_DECISION} />,
          now: (
            <OpenDecisionView
              decision={OPEN_DECISION}
              today={todayUtc()}
              earlierPolls={polls.length}
            />
          ),
          polls: pollsPanel,
          upgrades: upgradesPanel,
          who: (
            <>
              <WhoDoesWhat />
              <DecisionHomes current="network" />
              <GovernanceTerms />
            </>
          ),
        }}
      />

      <SourceNote>
        Upgrade heights from a Zebra node; the process behind each upgrade from
        its ZIPs and the community forum. Polls from their published results;
        tests of the voting tools are left out. Arborist links use the call
        agendas only, so a call that discussed a topic without naming it on the
        agenda is not linked. The open decision follows the organizers&apos;
        timeline on the Zcash Community Forum, read on{" "}
        {shortDate(OPEN_DECISION.reviewedAt)}; the steps follow ZIP 0.
      </SourceNote>
    </div>
  );
}
