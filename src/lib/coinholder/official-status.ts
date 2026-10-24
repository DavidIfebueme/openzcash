/**
 * Official outcomes of closed Coinholder-Directed Retroactive Grants rounds,
 * read from the curated ROUNDS (each round's FPF results post), for the pages
 * that otherwise show the ZCG spreadsheet's coinholder tabs.
 *
 * The spreadsheet lags the results post and the site publishes its status
 * changes a day later, so a closed round can still read "Pending vote" there.
 * Rows of a closed round take the published result instead; every other row
 * (new submissions, rows not considered for a vote) stays as the sheet says.
 *
 * Matching: the FPF GitHub issue number in the row's link, which is the `id`
 * of a round proposal. Only a row without an issue link falls back to its
 * normalised title, through the exact titles of the rounds and a short list
 * of the spreadsheet's own wordings; a title shared by two rounds matches none.
 */
import type { PayoutEntry } from "./fund";
import { PAYOUTS } from "./program";
import { ROUNDS } from "./rounds";
import type { Outcome, Round, RoundProposal } from "./types";

const FPF_ISSUE =
  /github\.com\/Financial-Privacy-Foundation\/ZcashCoinholderGrantsProgram\/issues\/(\d+)/i;

/** Verdict vocabulary of the proposal tables (`COINHOLDER_VERDICT_LABEL`). */
export type OfficialVerdict = "approved" | "rejected" | "vetoed";

/** Outcomes that settle a grant question; passed polls and discarded questions have no verdict here. */
const VERDICT: Partial<Record<Outcome, OfficialVerdict>> = {
  funded: "approved",
  rejected: "rejected",
  rejected_lower: "rejected",
  vetoed: "vetoed",
};

type Match = { round: Round; proposal: RoundProposal };

export type OfficialProposalVerdict = {
  status: OfficialVerdict;
  outcome: Outcome;
  roundId: string;
  roundLabel: string;
  proposalId: string;
};

export type OfficialGrantStatus = {
  status: "awaiting_payment";
  label: "Awaiting payment";
  roundId: string;
  roundLabel: string;
  proposalId: string;
};

/** One row of FPF's coinholder grants tab, as the ledger stores it. */
export type CoinholderLedgerEntry = {
  project: string | null;
  grantStatus: string | null;
  isPaid: boolean;
  amountUsdCents: bigint | null;
};

/** A grant as the grants list aggregates it: every ledger row under one project name. */
export type AggregatedGrant = {
  grantKey: string;
  status: string | null;
  milestoneCount: number;
  paidCount: number;
  usdCents: bigint;
};

/** One grant to show: the aggregate, or one part of a project the list summed across two grants. */
export type CoinholderGrantView = AggregatedGrant & {
  official: OfficialGrantStatus | null;
};

/** What the overlay needs of a payout record: its round, and whether FPF has reported it paid. */
export type PayoutRecord = Pick<PayoutEntry, "roundId" | "status">;

/** The FPF issue number in a link, or null for any other link. */
export function fpfIssueNumber(link: string | null | undefined): string | null {
  return link?.match(FPF_ISSUE)?.[1] ?? null;
}

const titleKey = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Spreadsheet wordings that differ from the round's title: sheet title → [round, proposal id]. */
const SHEET_TITLES: [string, string, string][] = [
  [
    "FPF Admin for Coinhold-Directed Retroactive Grants Program",
    "q4-2025",
    "fpf-admin",
  ],
  ["ZcashCommunity.com Website Hosting", "q4-2025", "3"],
  ["CipherScan Coinholder Retroactive Grant 2026", "q3-2026", "47"],
  [
    "Project Tachyon - Bonus Grant for Ironwood zk-SNARK Formal Verification",
    "q3-2026",
    "52",
  ],
  [
    "Taylor Hornby - Bonus Grant for Orchard Counterfeiting Vulnerability Bug Bounty",
    "q3-2026",
    "53",
  ],
  ["Zec.rocks (16 months of uptime for Zcash wallets)", "q3-2026", "61"],
];

function buildIndexes(closed: readonly Round[]) {
  const byIssue = new Map<string, Match>();
  const byTitle = new Map<string, Match | null>();
  for (const round of closed) {
    for (const proposal of round.proposals) {
      // ROUNDS is newest first: a resubmitted issue keeps its latest outcome.
      if (/^\d+$/.test(proposal.id) && !byIssue.has(proposal.id))
        byIssue.set(proposal.id, { round, proposal });
      const key = titleKey(proposal.title);
      byTitle.set(key, byTitle.has(key) ? null : { round, proposal });
    }
  }
  for (const [sheetTitle, roundId, id] of SHEET_TITLES) {
    const round = closed.find((r) => r.id === roundId);
    const proposal = round?.proposals.find((p) => p.id === id);
    if (round && proposal)
      byTitle.set(titleKey(sheetTitle), { round, proposal });
  }
  return { byIssue, byTitle };
}

/** Shortest project name matched inside a longer proposal title. */
const MIN_CONTAINED_KEY = 6;

const toCents = (v: bigint | number | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

/** The status every entry shares; null when they differ, which keeps the aggregate. */
function partStatus(rows: CoinholderLedgerEntry[]): string | null {
  const first = rows[0]?.grantStatus ?? null;
  return rows.every((r) => r.grantStatus === first) ? first : null;
}

const sumCents = (rows: CoinholderLedgerEntry[]) =>
  rows.reduce((sum, r) => sum + (r.amountUsdCents ?? 0n), 0n);

/**
 * The overlay for a set of rounds and payout records. The site uses the live
 * one built below from ROUNDS and PAYOUTS; tests build one around a fixture,
 * such as a closed round whose payout FPF has not reported yet.
 */
export function createOfficialStatus(
  rounds: readonly Round[],
  payouts: readonly PayoutRecord[],
) {
  /** Rounds with published results; their outcomes are final. */
  const closed = rounds.filter((r) => r.status === "results");
  const index = buildIndexes(closed);

  /** Rounds whose payout FPF has reported. */
  const paidRounds: ReadonlySet<string> = new Set(
    payouts.filter((p) => p.status === "paid").map((p) => p.roundId),
  );

  /** Grants coinholders funded in a closed round whose payout FPF has not reported. */
  const awaiting: Match[] = closed
    .filter((r) => !paidRounds.has(r.id))
    .flatMap((round) =>
      round.proposals
        .filter((p) => p.outcome === "funded")
        .map((proposal) => ({ round, proposal })),
    );

  /** The closed-round proposal a spreadsheet row stands for, or null. */
  function findOfficial(row: {
    platformLink?: string | null;
    title: string;
  }): Match | null {
    const issue = fpfIssueNumber(row.platformLink);
    if (issue) return index.byIssue.get(issue) ?? null;
    return index.byTitle.get(titleKey(row.title)) ?? null;
  }

  /** Published verdict for a coinholder proposal row of a closed round; null leaves the row as it is. */
  function officialProposalVerdict(row: {
    platformLink?: string | null;
    title: string;
  }): OfficialProposalVerdict | null {
    const match = findOfficial(row);
    const status = match ? VERDICT[match.proposal.outcome] : undefined;
    if (!match || !status) return null;
    return {
      status,
      outcome: match.proposal.outcome,
      roundId: match.round.id,
      roundLabel: match.round.label,
      proposalId: match.proposal.id,
    };
  }

  /**
   * The awaiting grant a ledger entry stands for. The spreadsheet's own title
   * comes first. FPF's tab can also reuse a project name for a later grant
   * (Unstoppable Wallet: paid in Q4 2025, "Expanding Zcash In Unstoppable
   * Wallet" approved in Q3 2026): an entry whose name sits inside exactly one
   * awaiting grant's title, for exactly its requested amount, is that grant.
   */
  function findAwaitingGrant(
    title: string,
    usdCents: number | null,
  ): Match | null {
    const direct = findOfficial({ title });
    if (
      direct?.proposal.outcome === "funded" &&
      !paidRounds.has(direct.round.id)
    )
      return direct;
    const key = titleKey(title);
    if (usdCents === null || key.length < MIN_CONTAINED_KEY) return null;
    const hits = awaiting.filter(
      (m) =>
        m.proposal.requestedUsdCents === usdCents &&
        titleKey(m.proposal.title).includes(key),
    );
    return hits.length === 1 ? hits[0] : null;
  }

  /**
   * The ledger's "Open" on a coinholder grant means approved and not yet paid:
   * retroactive grants are paid in one transfer, and every open row carries no
   * payout date. For a grant coinholders funded in a closed round whose payout
   * FPF has not reported, say so; anything else keeps the ledger's status.
   * `usdCents` lets an entry that reuses an earlier grant's name find its own
   * round (see `findAwaitingGrant`).
   */
  function officialGrantStatus(grant: {
    grantKey: string;
    status: string | null;
    paidCount?: number;
    usdCents?: bigint | number | null;
  }): OfficialGrantStatus | null {
    if (grant.status !== "open" || (grant.paidCount ?? 0) > 0) return null;
    const match = findAwaitingGrant(grant.grantKey, toCents(grant.usdCents));
    if (!match) return null;
    return {
      status: "awaiting_payment",
      label: "Awaiting payment",
      roundId: match.round.id,
      roundLabel: match.round.label,
      proposalId: match.proposal.id,
    };
  }

  /**
   * The grants list sums every ledger row under one project name, so a project
   * FPF paid once and coinholders funded again reads "Completed" with 1 of 2
   * paid. When its unpaid rows are a grant still awaiting payment, show the
   * paid and the unpaid grant apart; otherwise keep the aggregate. `entries`
   * are the coinholder ledger rows (any project; only this one's are read).
   */
  function coinholderGrantViews(
    grant: AggregatedGrant,
    entries: CoinholderLedgerEntry[],
  ): CoinholderGrantView[] {
    const whole = { ...grant, official: officialGrantStatus(grant) };
    if (grant.paidCount === 0 || grant.paidCount >= grant.milestoneCount)
      return [whole];
    const own = entries.filter((e) => e.project === grant.grantKey);
    const paid = own.filter((e) => e.isPaid);
    const unpaid = own.filter((e) => !e.isPaid);
    if (!paid.length || !unpaid.length) return [whole];
    const unpaidPart: AggregatedGrant = {
      grantKey: grant.grantKey,
      status: partStatus(unpaid),
      milestoneCount: unpaid.length,
      paidCount: 0,
      usdCents: sumCents(unpaid),
    };
    const official = officialGrantStatus(unpaidPart);
    if (!official) return [whole];
    return [
      {
        grantKey: grant.grantKey,
        status: partStatus(paid),
        milestoneCount: paid.length,
        paidCount: paid.length,
        usdCents: sumCents(paid),
        official: null,
      },
      { ...unpaidPart, official },
    ];
  }

  /**
   * Grants still awaiting payment that no ledger row stands for yet: FPF's tab
   * lags the results post (Connaugh Zcash Videos was funded after a correction).
   * Empty once FPF has reported every closed round paid.
   */
  function awaitingGrantsMissingFrom(
    rows: { grantKey: string; usdCents: bigint | number | null }[],
  ): { roundLabel: string; title: string; proposalId: string }[] {
    const listed = new Set(
      rows
        .map((r) => findAwaitingGrant(r.grantKey, toCents(r.usdCents)))
        .filter((m): m is Match => m !== null)
        .map((m) => `${m.round.id}:${m.proposal.id}`),
    );
    return awaiting
      .filter((m) => !listed.has(`${m.round.id}:${m.proposal.id}`))
      .map((m) => ({
        roundLabel: m.round.label,
        title: m.proposal.title,
        proposalId: m.proposal.id,
      }));
  }

  return {
    officialProposalVerdict,
    officialGrantStatus,
    coinholderGrantViews,
    awaitingGrantsMissingFrom,
  };
}

/** The live overlay: the curated rounds and the payouts FPF has reported. */
const LIVE = createOfficialStatus(ROUNDS, PAYOUTS);

export const {
  officialProposalVerdict,
  officialGrantStatus,
  coinholderGrantViews,
  awaitingGrantsMissingFrom,
} = LIVE;
