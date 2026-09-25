import { titlesMatch } from "@/lib/zcg/match-titles";
import { proposalStatusLabel } from "@/lib/zcg/status-labels";

/**
 * The decision register: one row per decision taken by a Zcash governance
 * body, dated, attributed to the process that took it and linked to its
 * source. Pure builders over records the site already imports and a compiled
 * record of polls and elections (src/data/governance/record.json); nothing
 * here infers a decision that no source records.
 */

export type DecisionProcess = "committee" | "coinholders" | "protocol";

export const PROCESS_LABEL: Record<DecisionProcess, string> = {
  committee: "ZCG committee",
  coinholders: "Coinholders",
  protocol: "Network upgrade",
};

/**
 * Where a coinholder poll belongs: the coinholder fund (its grants program and
 * rounds, run by FPF) or the whole network (protocol scope, funding model).
 */
export type PollScope = "fund" | "network";

export type Tone = "emerald" | "rose" | "amber" | "zinc" | "sky" | "violet";
export type SourceLink = { label: string; href: string };

export type DecisionRow = {
  id: string;
  date: string;
  process: DecisionProcess;
  outcome: string;
  tone: Tone;
  subject: string;
  /** Internal record the decision led to (a grant), when there is one. */
  subjectHref: string | null;
  detail: string | null;
  decidedBy: string;
  sources: SourceLink[];
};

export type ProposalInput = {
  id: string;
  program: string;
  title: string;
  status: string;
  decisionDate: string | null;
  applicantsRaw: string | null;
  requestedUsdCents: bigint | number | null;
  platformLink: string | null;
};
export type MeetingInput = { meetingDate: string; title: string; url: string };

/** An election as the committee records keep it (admin-editable table). */
export type DbElection = {
  id: string;
  title: string;
  seats: number;
  url: string;
  votingCloses: string | null;
  resultsBy: string | null;
  elected: string[] | null;
};
/** An election from the compiled public record, with tallies. */
export type RecordElection = {
  id: string;
  label: string;
  date: string | null;
  /** "2024-12" when only the month of the results is known. */
  month?: string | null;
  seats: number;
  ballots: number | null;
  elected: { name: string; approvals: number | null }[];
  sources: string[];
};
export type RecordPoll = {
  id: string;
  name: string;
  status: string;
  informal: boolean;
  kind: string;
  scope: PollScope;
  date: string | null;
  /** ZEC on the most-voted question when the poll asked several. */
  totalZec: number | null;
  /** How many questions (or proposals) the poll asked; 1 when absent. */
  questions?: number;
  quorum: string | null;
  outcome: string | null;
  verifiable: string | null;
  sources: string[];
};
export type UpgradeInput = {
  name: string;
  label: string;
  height: number;
  date: string;
  decidedBy: string;
  zips: number[];
  sources: SourceLink[];
};

/** Verdicts a decision body takes. Withdrawals are the applicant's own choice. */
const VERDICTS = new Set(["approved", "rejected", "filtered", "vetoed"]);

const toneOf = (status: string): Tone =>
  status === "approved"
    ? "emerald"
    : status === "rejected" || status === "vetoed"
      ? "rose"
      : "zinc";

const usd = (cents: bigint | number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(cents) / 100);
const zec = (n: number) =>
  `${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n)} ZEC`;

export function proposalDecisions(
  proposals: ProposalInput[],
  meetings: MeetingInput[],
  grantKeys: string[],
): DecisionRow[] {
  const minutesOn = new Map(meetings.map((m) => [m.meetingDate, m]));
  const rows: DecisionRow[] = [];
  for (const p of proposals) {
    if (!p.decisionDate || !VERDICTS.has(p.status)) continue;
    const coinholder = p.program === "coinholder";
    const grant =
      p.status === "approved"
        ? grantKeys.find((g) => g === p.title || titlesMatch(g, p.title))
        : undefined;
    const minutes = coinholder ? undefined : minutesOn.get(p.decisionDate);
    const sources: SourceLink[] = [];
    if (p.platformLink)
      sources.push({ label: "Application", href: p.platformLink });
    if (minutes) sources.push({ label: "Minutes", href: minutes.url });
    const detail = [
      p.applicantsRaw,
      p.requestedUsdCents != null
        ? `${usd(p.requestedUsdCents)} requested`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    rows.push({
      id: `proposal-${p.id}`,
      date: p.decisionDate,
      process: coinholder ? "coinholders" : "committee",
      outcome:
        coinholder && p.status === "filtered"
          ? "Not considered"
          : proposalStatusLabel(p.status),
      tone: toneOf(p.status),
      subject: p.title,
      subjectHref: grant ? `/zcg/grant?g=${encodeURIComponent(grant)}` : null,
      detail: detail || null,
      decidedBy: coinholder
        ? p.status === "vetoed"
          ? "Key-holders"
          : "Coinholder poll"
        : "ZCG committee",
      sources,
    });
  }
  return rows;
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "June 2024" (or a date) → "2024-06": the cycle an election belongs to. */
export function electionCycle(
  text: string,
  date?: string | null,
): string | null {
  const m = text
    .toLowerCase()
    .match(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{4})\\b`));
  if (m) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}`;
  return date ? date.slice(0, 7) : null;
}

/** One committee election as the Committee page lists it. */
export type ElectionEntry = {
  id: string;
  /** The admin-kept row behind this entry, so administrators can edit it. */
  dbId: string | null;
  label: string;
  /** Results date; null when only the month is known. */
  date: string | null;
  month: string | null;
  seats: number;
  ballots: number | null;
  elected: { name: string; approvals: number | null }[];
  sources: SourceLink[];
};

const electionKey = (e: ElectionEntry) => e.date ?? `${e.month ?? ""}-00`;

/**
 * Every committee election, newest first: the compiled record with its
 * tallies, completed with the admin-kept table. A cycle in both keeps the
 * record's tallies and borrows the table's date when the record has none; a
 * decided cycle only in the table is added with its names.
 */
export function electionRecord(
  record: RecordElection[],
  db: DbElection[],
): ElectionEntry[] {
  const dbByCycle = new Map(
    db.map((e) => [electionCycle(e.title, e.resultsBy ?? e.votingCloses), e]),
  );
  const entries: ElectionEntry[] = [];
  const seen = new Set<string | null>();
  for (const e of record) {
    const cycle = electionCycle(e.label, e.date);
    seen.add(cycle);
    const fromDb = dbByCycle.get(cycle);
    const date = e.date ?? fromDb?.resultsBy ?? fromDb?.votingCloses ?? null;
    entries.push({
      id: e.id,
      dbId: fromDb?.id ?? null,
      label: e.label,
      date,
      month: e.month ?? date?.slice(0, 7) ?? null,
      seats: e.seats,
      ballots: e.ballots,
      elected: e.elected,
      sources: e.sources.length
        ? e.sources.map((href, i) => ({
            label: i === 0 ? "Results" : "Thread",
            href,
          }))
        : fromDb
          ? [{ label: "Results", href: fromDb.url }]
          : [],
    });
  }
  for (const e of db) {
    const cycle = electionCycle(e.title, e.resultsBy ?? e.votingCloses);
    const date = e.resultsBy ?? e.votingCloses;
    if (seen.has(cycle) || !date || !e.elected?.length) continue;
    entries.push({
      id: e.id,
      dbId: e.id,
      label: e.title,
      date,
      month: date.slice(0, 7),
      seats: e.seats,
      ballots: null,
      elected: e.elected.map((name) => ({ name, approvals: null })),
      sources: [{ label: "Results", href: e.url }],
    });
  }
  return entries.sort((a, b) => electionKey(b).localeCompare(electionKey(a)));
}

const POLL_OUTCOME: Record<string, { outcome: string; tone: Tone }> = {
  decided: { outcome: "Decided", tone: "emerald" },
  advisory: { outcome: "Advisory", tone: "zinc" },
  informal: { outcome: "Informal", tone: "zinc" },
  open: { outcome: "Voting open", tone: "amber" },
  paused: { outcome: "Paused", tone: "zinc" },
  postponed: { outcome: "Postponed", tone: "zinc" },
};

function pollState(p: RecordPoll): keyof typeof POLL_OUTCOME {
  if (p.status === "open") return "open";
  if (p.status.startsWith("paused")) return "paused";
  if (p.status.startsWith("postponed")) return "postponed";
  if (
    p.informal ||
    p.status === "closed_no_official_tally" ||
    p.status === "closed_final_tally_not_preserved"
  )
    return "informal";
  return p.kind === "sentiment" ? "advisory" : "decided";
}

/** "1.2M ZEC voted", or the most-voted question when the poll asked several. */
function pollVolume(p: RecordPoll): string | null {
  if (p.totalZec == null) return null;
  if ((p.questions ?? 1) <= 1) return `${zec(p.totalZec)} voted`;
  const per = p.kind === "grant_decision" ? "proposal" : "question";
  return `up to ${zec(p.totalZec)} per ${per}`;
}

/**
 * Coin-weighted polls, excluding tests of the voting tools themselves;
 * limited to one home when a scope is given.
 */
export function pollDecisions(
  polls: RecordPoll[],
  scope?: PollScope,
): DecisionRow[] {
  return polls
    .filter((p) => p.kind !== "test" && p.date)
    .filter((p) => scope === undefined || p.scope === scope)
    .map((p) => {
      const state = pollState(p);
      const organizers = state === "paused" || state === "postponed";
      return {
        id: `poll-${p.id}`,
        date: p.date!,
        process: "coinholders" as const,
        ...POLL_OUTCOME[state],
        subject: p.name,
        subjectHref: null,
        detail:
          [p.outcome, pollVolume(p)]
            .filter(Boolean)
            .join(" · ") || null,
        decidedBy: organizers ? "Poll organizers" : "Coin-weighted poll",
        sources: p.sources.map((href, i) => ({
          label: i === 0 ? "Results" : "Source",
          href,
        })),
      };
    });
}

export function upgradeDecisions(upgrades: UpgradeInput[]): DecisionRow[] {
  return upgrades.map((u) => ({
    id: `upgrade-${u.name}`,
    date: u.date,
    process: "protocol" as const,
    outcome: "Activated",
    tone: "sky" as const,
    subject: u.label,
    subjectHref: null,
    detail: [
      `Block ${u.height.toLocaleString("en-US")}`,
      u.zips.length ? `ZIP ${u.zips.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    decidedBy: u.decidedBy,
    sources: u.sources,
  }));
}

/** Newest first; ties keep a stable order by process, then subject. */
export function sortDecisions(rows: DecisionRow[]): DecisionRow[] {
  const order: DecisionProcess[] = ["protocol", "coinholders", "committee"];
  return [...rows].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      order.indexOf(a.process) - order.indexOf(b.process) ||
      a.subject.localeCompare(b.subject),
  );
}
