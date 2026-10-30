import type { PayoutEntry } from "./fund";
import { ACTIVE_CYCLE, cycleDateRange, cycleDeadline, cycleWindows } from "./cycles";

/**
 * Standing facts about the Coinholder-Directed Retroactive Grants Program:
 * who decides, who pays, who administers, and the next round. Sources beside
 * each fact; quotes are kept short and exact.
 */
export const PROGRAM = {
  officialName: "Coinholder-Directed Retroactive Grants Program",
  shortName: "CDRGP",
  threshold: "At least 420,000 ZEC voted and a simple majority in favour (ZIP 1016). Abstentions don't count toward the majority.",
  keyHolders: "The fund sits in a 2-of-3 multisig. Shielded Labs and the Zcash Foundation sign the payouts. One can veto on legal grounds, two on principle; no one can overturn a rejection.",
  fund:
    "The Coinholder-Controlled Fund (ZIP 1016) was seeded with the lockbox at NU6.1 and receives 12% of the block subsidy until the third halving. Grants are set in USD and paid in ZEC.",
  fpfRole: "Runs calls, review, KYC above $50,000 and reporting, and coordinates payouts. It does not decide. Coinholders approved its one-year $58,000 fee.",
  fpfRoleQuote: "FPF will administer the Coinholder Grants Program, but in a more limited role than ZCG",
  fpfRoleSource: "https://forum.zcashcommunity.com/t/nu6-1-coinholder-directed-retroactive-grants-program/51713",
  zipUrl: "https://zips.z.cash/zip-1016",
  submissionsUrl: "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues",
  nextRound: {
    label: ACTIVE_CYCLE.label,
    note: "Dates announced by FPF for the current cycle.",
    source: ACTIVE_CYCLE.source,
    href: ACTIVE_CYCLE.href,
    windows: cycleWindows().map((w) => ({
      label: w.label,
      value: `${cycleDateRange(w.start, w.end)}, ${new Date(w.end).getUTCFullYear()} · ${cycleDeadline()}`,
    })),
  },
} as const;

/** ZIP 1016's disbursement process, in the order a grant goes through it. */
export const DISBURSEMENT_STEPS = [
  {
    title: "Apply",
    text: "Anyone can submit a grant application through the process the key-holders agreed on: FPF's GitHub template and a forum thread. Grants are retroactive, for finished work.",
  },
  {
    title: "Review for 30 days",
    text: "Applications are open for community review at least 30 days before the vote. A question added later is discarded, as the Q1 2026 rescission question was.",
  },
  {
    title: "Coinholders vote",
    text: "Every three months. A grant needs at least 420,000 ZEC voted and a simple majority in favour; abstentions are left out of the majority. Coins used in one question also count in the others.",
  },
  {
    title: "Veto window",
    text: "One key-holder can veto a grant that would breach its legal or reporting obligations; two can veto on principle, with a rationale. Payments stop on a veto. No one can overturn a rejection.",
  },
  {
    title: "Key-holders pay",
    text: "The key-holders sign the multisig transactions. Grants are set in USD and paid in ZEC at the time of payment, after KYC for grants above $50,000. If the fund is short, grants can be partly paid.",
  },
] as const;

export const ZIP_1016_PROCESS = "https://zips.z.cash/zip-1016#disbursementprocess";

/** FPF's Coinholder Grants tab of the ZCG spreadsheet: one row per payout, with the date, the ZEC sent and the ZEC/USD price. */
export const COINHOLDER_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1FQ28rDCyRW0TiNxrm3rgD8ai2KGUsXAjPieQmI1kKKg/edit?gid=722519692#gid=722519692";

/** The key-holders' 2-of-3 multisig that received the lockbox at NU6.1 (ZIP 271) and pays the grants. */
export const FUND_MULTISIG = {
  address: "t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo",
  explorer:
    "https://mainnet.zcashexplorer.app/address/t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo",
} as const;

/**
 * Payouts from the fund, by round. `usdCents` is the grants' value; `zec` is
 * what the key-holders sent from the multisig to the grantees (fees aside),
 * as FPF's Coinholder sheet records it; `source` is FPF's announcement.
 */
export const PAYOUTS = [
  {
    round: "Q4 2025",
    roundId: "q4-2025",
    date: "Feb 3, 2026",
    usdCents: 12_194_100,
    zec: 436.77,
    grants: "FPF administration, Bitcoin VN, ZcashCommunity.com hosting, Unstoppable Wallet",
    status: "paid",
    source: "https://forum.zcashcommunity.com/t/coinholder-directed-retroactive-grants-program-results-nov-2025/53487/19",
  },
  {
    round: "Q1 2026",
    roundId: "q1-2026",
    date: "Apr 14, 2026",
    usdCents: 4_500_000,
    zec: 129.82,
    grants: "Maya Protocol",
    status: "paid",
    source: "https://forum.zcashcommunity.com/t/polling-closed-coinholder-directed-grants-program-q1-round/55048/23",
  },
  {
    round: "Q3 2026",
    roundId: "q3-2026",
    date: "Oct 16, 2026",
    usdCents: 838_999_200,
    zec: 7320.535,
    grants: "17 grants, paid in one day through the shielded pool",
    status: "paid",
    source: "https://forum.zcashcommunity.com/t/q3-coinholder-directed-retroactive-grants-program-results/57909/23",
  },
] as const satisfies readonly PayoutEntry[];
