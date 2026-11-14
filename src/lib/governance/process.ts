/**
 * How a change becomes a Zcash rule, as the short record the governance page
 * shows. The process follows ZIP 0 (https://zips.z.cash/zip-0000) and the
 * polling practice recorded in src/data/governance/record.json; the wording
 * is OpenZcash's own and stays descriptive.
 */
export type PieceId = "community" | "organizations" | "network";

export interface Piece {
  id: PieceId;
  name: string;
  /** What this piece does, in one word. */
  verb: string;
}

/** No one decides alone: a change needs the three, in this order. */
export const PIECES: readonly Piece[] = [
  { id: "community", name: "Community", verb: "signals" },
  { id: "organizations", name: "Organizations", verb: "build" },
  { id: "network", name: "Network", verb: "adopts" },
];

export interface Step {
  name: string;
  /** Where the step happens or what it rests on. */
  where: string;
  piece: PieceId;
}

/** From idea to activation. A proposal can stop at any step. */
export const STEPS: readonly Step[] = [
  { name: "Idea", where: "forum", piece: "community" },
  { name: "Draft ZIP", where: "zcash/zips", piece: "community" },
  { name: "Discussion", where: "public", piece: "community" },
  { name: "Polls", where: "panels, coinholders", piece: "community" },
  { name: "Result read", where: "rough consensus", piece: "organizations" },
  {
    name: "Network upgrade",
    where: "activation height",
    piece: "organizations",
  },
  { name: "Adoption", where: "miners, nodes, wallets", piece: "network" },
];

export interface NumberedStep extends Step {
  number: number;
}

export interface Phase {
  piece: Piece;
  steps: NumberedStep[];
}

/** The steps grouped by the piece that holds them, numbered in order. */
export function phases(): Phase[] {
  const numbered = STEPS.map((step, index) => ({ ...step, number: index + 1 }));
  return PIECES.map((piece) => ({
    piece,
    steps: numbered.filter((step) => step.piece === piece.id),
  })).filter((phase) => phase.steps.length > 0);
}

export interface Fact {
  question: string;
  answer: string;
  detail: string;
}

export const FACTS: readonly Fact[] = [
  {
    question: "Are polls binding?",
    answer: "No",
    detail: "They are signals.",
  },
  {
    question: "Could the chain split?",
    answer: "Yes, by design",
    detail: "Polls test support first.",
  },
  {
    question: "Who has the final say?",
    answer: "The network",
    detail: "Whoever runs the software.",
  },
];

export interface Role {
  who: string;
  does: string;
  cannotAlone: string;
  /** The one role nothing overrides. */
  finalSay?: boolean;
}

export const ROLES: readonly Role[] = [
  {
    who: "Development organizations",
    does: "Write ZIPs, build the nodes, read the polls",
    cannotAlone: "Make the network run a change",
  },
  {
    who: "ZIP editors",
    does: "Review drafts and assign numbers",
    cannotAlone: "Activate a change",
  },
  {
    who: "ZCG committee",
    does: "Awards grants from the 8% share",
    cannotAlone: "Change its own share",
  },
  {
    who: "Coinholders",
    does: "Vote by ZEC weight",
    cannotAlone: "Bind the network",
  },
  {
    who: "ZCAP and other panels",
    does: "Answer polls; ZCAP elects the ZCG committee",
    cannotAlone: "Decide on their own",
  },
  {
    who: "Key-holder organizations",
    does: "Hold the keys of the coinholder fund",
    cannotAlone: "Direct the fund",
  },
  {
    who: "Whoever runs the network",
    does: "Miners, node operators, exchanges and wallets choose what to run",
    cannotAlone: "Holds the final say",
    finalSay: true,
  },
];

export interface Term {
  term: string;
  meaning: string;
}

export const TERMS: readonly Term[] = [
  { term: "Rough consensus", meaning: "Broad support, not unanimity" },
  { term: "ZIP", meaning: "Zcash Improvement Proposal" },
  { term: "Network upgrade", meaning: "A rule change at a set block height" },
  {
    term: "Dev Fund",
    meaning: "20% of each block subsidy, until the third halving",
  },
  { term: "Lockbox", meaning: "A protocol reserve awaiting a decision" },
  { term: "NSM", meaning: "ZEC removed now, reissued later" },
  { term: "ZCAP", meaning: "Community panel that answers polls" },
  { term: "Halving", meaning: "The subsidy halves; next in 2028" },
];
