import { HEIGHTS, LOCKBOX_DISBURSEMENT, type StreamId } from "./consensus";

/**
 * What each non-miner allocation is, when it ran, the rule that defines it and
 * the coinbase addresses observed paying it. Amounts never live here: they are
 * derived from block heights by consensus.ts.
 */
export type Link = { label: string; href: string };

export type StreamInfo = {
  id: StreamId;
  label: string;
  /** Who the consensus rule pays. */
  recipient: string;
  /** Share of the block subsidy while the stream is active. */
  share: string;
  era: EraId;
  fromHeight: number;
  /** Inclusive. Null while the stream is still running. */
  toHeight: number | null;
  rules: Link[];
  /** Coinbase addresses observed paying this stream (examples, not exhaustive). */
  addresses: string[];
  /** Where the money can be followed next, on OpenZcash or at the source. */
  destinations: Link[];
};

export type EraId = "founders" | "devfund2020" | "nu6";

export const ERAS: Record<
  EraId,
  { label: string; from: string; to: string | null; summary: string }
> = {
  founders: {
    label: "Founders' Reward",
    from: "2016-10-28",
    to: "2020-11-18",
    summary: "20% of every block until the first halving.",
  },
  devfund2020: {
    label: "Dev Fund 2020",
    from: "2020-11-18",
    to: "2024-11-23",
    summary:
      "20% split 7 / 5 / 8 between ECC, the Zcash Foundation and Major Grants.",
  },
  nu6: {
    label: "ZCG and Lockbox",
    from: "2024-11-23",
    to: null,
    summary:
      "8% to Zcash Community Grants and 12% into the in-protocol lockbox, until the third halving.",
  },
};

const SPEC: Link = {
  label: "Protocol spec §7.8",
  href: "https://zips.z.cash/protocol/protocol.pdf",
};
const ZIP = (n: number, title: string): Link => ({
  label: `ZIP ${n} · ${title}`,
  href: `https://zips.z.cash/zip-${String(n).padStart(4, "0")}`,
});

export const STREAMS: StreamInfo[] = [
  {
    id: "foundersReward",
    label: "Founders' Reward",
    recipient: "Zcash Company, 48 rotating 2-of-3 multisig addresses",
    share: "20%",
    era: "founders",
    fromHeight: 1,
    toHeight: HEIGHTS.canopy - 1,
    rules: [SPEC],
    addresses: [
      "t3Vz22vK5z2LcKEdg16Yv4FFneEL1zg9ojd",
      "t3cL9AucCajm3HXDhb5jBnJK2vapVoXsop3",
    ],
    destinations: [],
  },
  {
    id: "devFundEcc",
    label: "Bootstrap (ECC)",
    recipient: "Bootstrap Project, the non-profit parent of ECC",
    share: "7%",
    era: "devfund2020",
    fromHeight: HEIGHTS.canopy,
    toHeight: HEIGHTS.nu6 - 1,
    rules: [
      ZIP(214, "Consensus rules for a Zcash Development Fund"),
      ZIP(1014, "Establishing a Dev Fund"),
    ],
    addresses: [
      "t3LmX1cxWPPPqL4TZHx42HU3U5ghbFjRiif",
      "t3XHAGxRP2FNfhAjxGjxbrQPYtQQjc3RCQD",
    ],
    destinations: [],
  },
  {
    id: "devFundZf",
    label: "Zcash Foundation",
    recipient: "Zcash Foundation",
    share: "5%",
    era: "devfund2020",
    fromHeight: HEIGHTS.canopy,
    toHeight: HEIGHTS.nu6 - 1,
    rules: [
      ZIP(214, "Consensus rules for a Zcash Development Fund"),
      ZIP(1014, "Establishing a Dev Fund"),
    ],
    addresses: ["t3dvVE3SQEi7kqNzwrfNePxZ1d4hUyztBA1"],
    destinations: [{ label: "Zcash Foundation reports", href: "/zf" }],
  },
  {
    id: "devFundMajorGrants",
    label: "Major Grants",
    recipient: "Major Grants, held by the Zcash Foundation; run by ZOMG, then ZCG",
    share: "8%",
    era: "devfund2020",
    fromHeight: HEIGHTS.canopy,
    toHeight: HEIGHTS.nu6 - 1,
    rules: [
      ZIP(214, "Consensus rules for a Zcash Development Fund"),
      ZIP(1014, "Establishing a Dev Fund"),
    ],
    addresses: ["t3XyYW8yBFRuMnfvm5KLGFbEVz25kckZXym"],
    destinations: [
      { label: "ZCG totals", href: "/zcg/totals" },
      { label: "ZCG grants", href: "/zcg/grants" },
    ],
  },
  {
    id: "zcg",
    label: "Zcash Community Grants",
    recipient: "Financial Privacy Foundation, for Zcash Community Grants",
    share: "8%",
    era: "nu6",
    fromHeight: HEIGHTS.nu6,
    toHeight: null,
    rules: [
      ZIP(1015, "Block subsidy allocation for non-direct development funding"),
      ZIP(1016, "Community and coinholder funding model"),
    ],
    addresses: ["t3cFfPt1Bcvgez9ZbMBFWeZsskxTkPzGCow"],
    destinations: [
      { label: "ZCG totals", href: "/zcg/totals" },
      { label: "ZCG grants", href: "/zcg/grants" },
    ],
  },
  {
    id: "lockbox",
    label: "Lockbox",
    recipient: "In-protocol lockbox (no address)",
    share: "12%",
    era: "nu6",
    fromHeight: HEIGHTS.nu6,
    toHeight: null,
    rules: [
      ZIP(1015, "Block subsidy allocation for non-direct development funding"),
      ZIP(2001, "Lockbox funding streams"),
      ZIP(271, "Deferred dev fund lockbox disbursement"),
      ZIP(1016, "Community and coinholder funding model"),
    ],
    addresses: [LOCKBOX_DISBURSEMENT.address],
    destinations: [
      { label: "Coinholder grants", href: "/zcg/coinholder" },
      { label: "Coinholder pool", href: "/zcg/coinholder/pool" },
    ],
  },
];

export const streamInfo = (id: StreamId): StreamInfo => {
  const s = STREAMS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stream ${id}`);
  return s;
};

/** Mainnet coinbases that pin the rules down, for the page's check list. */
export const CHECKED_BLOCKS: { height: number; what: string }[] = [
  { height: 1, what: "First Founders' Reward output, slow-start ramp" },
  { height: 20_000, what: "End of the slow start: 2.5 ZEC Founders' Reward" },
  { height: HEIGHTS.blossom, what: "Blossom: the per-block subsidy halves" },
  { height: HEIGHTS.canopy, what: "First halving: 7 / 5 / 8 Dev Fund outputs" },
  {
    height: HEIGHTS.nu6,
    what: "NU6: 0.125 ZEC to ZCG, 0.1875 ZEC into the lockbox",
  },
  {
    height: HEIGHTS.nu61,
    what: "NU6.1: ten outputs of 7,875 ZEC disburse the lockbox",
  },
];
