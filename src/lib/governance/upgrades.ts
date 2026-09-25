import type { SourceLink } from "./decisions";

/**
 * Mainnet protocol changes: the network upgrades the node reports
 * (getblockchaininfo `upgrades`, read through CipherScan's Zebra-backed API on
 * 2026-09-24) plus the June 2026 Orchard soft fork, which has no upgrade entry.
 * `decidedBy` summarises how each change was adopted, per the research record
 * in src/data/governance/record.json; `topics` find the Arborist calls whose
 * agenda named it.
 */
export type UpgradeDef = {
  name: string;
  label: string;
  height: number;
  decidedBy: string;
  zips: number[];
  topics: RegExp[];
};

export const zipLink = (n: number): SourceLink => ({
  label: `ZIP ${n}`,
  href: `https://zips.z.cash/zip-${String(n).padStart(4, "0")}`,
});
export const blockLink = (h: number): SourceLink => ({
  label: "Activation block",
  href: `https://cipherscan.app/block/${h}`,
});

export const UPGRADES: UpgradeDef[] = [
  {
    name: "overwinter",
    label: "Overwinter",
    height: 347_500,
    decidedBy: "ECC-led ZIP process, node release",
    zips: [201, 200, 202, 203, 143],
    topics: [/\boverwinter\b/i],
  },
  {
    name: "sapling",
    label: "Sapling",
    height: 419_200,
    decidedBy: "ECC-led ZIP process, node release",
    zips: [205, 243],
    topics: [/\bsapling upgrade\b/i],
  },
  {
    name: "blossom",
    label: "Blossom",
    height: 653_600,
    decidedBy: "ZIP process (ECC, ZF), node release",
    zips: [206, 208],
    topics: [/\bblossom\b/i],
  },
  {
    name: "heartwood",
    label: "Heartwood",
    height: 903_000,
    decidedBy: "ZIP process (ECC, ZF), node release",
    zips: [250, 213, 221],
    topics: [/\bheartwood\b/i],
  },
  {
    name: "canopy",
    label: "Canopy",
    height: 1_046_400,
    decidedBy: "ZF community sentiment, then ZIP 1014",
    zips: [251, 207, 211, 212, 214, 215, 1014],
    topics: [/\bcanopy\b/i],
  },
  {
    name: "nu5",
    label: "NU5 · Orchard and Halo 2",
    height: 1_687_104,
    decidedBy: "ZIP process (ECC, ZF), node releases",
    zips: [252, 224, 225, 244, 216, 239],
    topics: [/\bnu\s?5\b/i],
  },
  {
    name: "nu6",
    label: "NU6 · ZCG and the lockbox",
    height: 2_726_400,
    decidedBy: "2024 polls and runoff, then ZIP 1015",
    zips: [253, 1015, 2001, 236],
    topics: [/\bnu\s?6(?![.\d])/i],
  },
  {
    name: "nu6.1",
    label: "NU6.1 · coinholder funding",
    height: 3_146_400,
    decidedBy: "2025 polls, then ZIP 1016",
    zips: [255, 1016, 271],
    topics: [/\bnu\s?6\.1\b/i],
  },
  {
    name: "orchard-mitigation",
    label: "Orchard mitigation soft fork",
    height: 3_363_426,
    decidedBy: "Emergency security response",
    zips: [257],
    topics: [/\bsoft fork\b/i],
  },
  {
    name: "nu6.2",
    label: "NU6.2 · Orchard emergency fix",
    height: 3_364_600,
    decidedBy: "Emergency upgrade, no poll",
    zips: [257],
    topics: [/\bnu\s?6\.2\b/i],
  },
  {
    name: "nu6.3",
    label: "NU6.3 · Ironwood",
    height: 3_428_143,
    decidedBy: "Joint proposal, no poll",
    zips: [258, 229, 2005, 2006],
    topics: [/\bnu\s?6\.3\b/i, /\bironwood\b/i],
  },
];

/** Protocol work still being decided, shown apart from activated changes. */
export const PENDING_TOPICS: {
  label: string;
  status: string | null;
  topics: RegExp[];
  sources: SourceLink[];
}[] = [
  {
    label: "NU7 · scope set by coinholder vote",
    status:
      "Coinholder vote closed Sep 14, 2026; ZIP 259 is a draft and activation heights are not set",
    topics: [/\bnu\s?7\b/i, /\bzsas?\b/i, /shielded assets/i],
    sources: [
      zipLink(259),
      {
        label: "Vote results",
        href: "https://forum.zcashcommunity.com/t/nu7-coinholder-vote/56912/42",
      },
    ],
  },
  { label: "Crosslink", status: null, topics: [/\bcrosslink\b/i], sources: [] },
  {
    label: "Network Sustainability Mechanism",
    status: null,
    topics: [/\bnsm\b/i, /sustainability mechanism/i],
    sources: [],
  },
];

export function matchesTopic(text: string, topics: RegExp[]): boolean {
  return topics.some((t) => t.test(text));
}
