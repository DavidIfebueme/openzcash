import { MAX_PROPOSAL_TAGS, PROPOSAL_TAGS, type ProposalTagId } from "./proposal-tags";

const signals: readonly [ProposalTagId, RegExp][] = [
  ["wallets", /\b(wallets?|seedsigner|signer|viewing[ -]keys?|group vaults?)\b/i],
  ["security", /\b(security|audits?|privacy checkup|viewing[ -]keys?|key recovery)\b/i],
  ["research", /\b(research|formal verification|recomputation|market segmentation|comparative intelligence|quantitative|ecosystem mapping|adoption data)\b/i],
  ["education", /\b(education|courses?|documentation|workshops?|literacy|developer onboarding)\b/i],
  ["events", /\b(devcon|conferences?|meetups?|events?|travel support|festivals?|hackathons?)\b/i],
  ["applications", /\b(applications?|apps?|checkout|marketplaces?|invoices?|payments?|payouts?)\b/i],
  ["integration", /\b(integrations?|integrating|cross[ -]chain|bridges?|bridging|on[ /-]off[ -]ramps?|on[ -]ramps?|off[ -]ramps?|checkout|payment rails?|swaps?|zswap)\b/i],
  ["infrastructure", /\b(infrastructure|nodes?|indexers?|lightwalletd|zaino|sdks?|sync engine|execution layer|mining|rpc)\b/i],
  ["community", /\b(communit(?:y|ies)|adoption|outreach)\b/i],
  ["media", /\b(media|podcasts?|videos?|magazines?|marketing|signature campaign)\b/i],
  ["protocol", /\b(protocol|consensus|network upgrade|zip[ -]\d+)\b/i],
  ["operations", /\b(maintenance|dedicated resources|operations)\b/i],
  ["retroactive", /\bretroactive\b/i],
];
const known = new Set<string>(PROPOSAL_TAGS.map(tag => tag.id));

/** Display enrichment available from the first listing, independently of ZCG labels or archive import. */
export function classifyOpenZcashSectors(title: string, curated: readonly string[] = []): ProposalTagId[] {
  const subject = title.replace(/^\s*grant application\b(?:\s*[-–—:]\s*)?/i, "");
  return [...new Set([...curated, ...signals.filter(([, rule]) => rule.test(subject)).map(([id]) => id)])]
    .filter((id): id is ProposalTagId => known.has(id)).slice(0, MAX_PROPOSAL_TAGS);
}
