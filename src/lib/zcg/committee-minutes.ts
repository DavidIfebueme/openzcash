import { ZCG_EXAMPLE_MEMBERS, type ZcgMemberId, type ZcgProposalExample } from "@/lib/participate/workspace/data/zcg-proposal-examples";

const forum = "https://forum.zcashcommunity.com/t";
const minutes = `${forum}/zcash-community-grants-meeting-minutes-10-12-2026/58182`;
export const OCTOBER_12_MINUTES = { url: minutes, meetingDate: "2026-10-12", publishedAt: "2026-10-14T12:54:55.751Z", reviewedAt: "2026-10-14" } as const;

export type PublishedCommitteeDecision = ZcgProposalExample & {
  issueNumber: number;
  issueUrl: string;
  publishedAt: string;
};

type Entry = {
  issue: number; topic: number; title: string; usd: number;
  outcome?: "approved" | "rejected"; part?: 1 | 2;
  asyncDate?: string;
  feedback: Partial<Record<ZcgMemberId, string>>;
};

/**
 * Reviewed against both posts of the official minutes and the sheet's exact
 * forum-topic → GitHub-issue links on October 14. The opening statement records
 * unanimous votes by the five attending members. Missing individual comments
 * stay explicitly missing; attendance alone never supplies a vote.
 */
const entries: readonly Entry[] = [
  { issue: 435, topic: 57741, title: "P2P Cash-to-ZEC Onboarding via Bank CDMs", usd: 40500, feedback: {
    artkor: "Preferred the more developed 0xramp proposal; questioned parallel funding and legal feasibility.",
    paul: "Raised banking and legal feasibility concerns.", hanh: "Found no explanation of the required operating agreements or licences.",
    zerodartz: "Supported more on/off-ramps but considered this project too early.",
  } },
  { issue: 441, topic: 57752, title: "Bitcointalk Signature Campaign & ZEC Community Engagement", usd: 90000, asyncDate: "2026-10-02", feedback: {
    artkor: "Opposed a promotion format associated with past scams.", zerodartz: "Did not see sufficient value in this campaign format today.",
    gguy: "Agreed with the objections to the campaign.", hanh: "Worried that this promotion would damage Zcash's reputation.",
  } },
  { issue: 442, topic: 57796, title: "Zcash Africa Privacy Engineering Residency Pilot", usd: 49000, feedback: {
    artkor: "Wanted evidence from existing regional initiatives before funding similar programmes.",
    paul: "Needed stronger confidence in the team's delivery record.", hanh: "Found insufficient team information and track record.",
    zerodartz: "Wanted local community feedback and evidence from a smaller pilot.", gguy: "Agreed with the concerns raised.",
  } },
  { issue: 444, topic: 57799, title: "Independent Recomputation of the Zcash Supply Ledger, including the NU7 NSM Reserve", usd: 50000, feedback: {
    artkor: "Considered the requested budget excessive for the proposed computation.",
    hanh: "Distinguished simple turnstile accounting from validating blocks or transactions.", zerodartz: "Found the ask high and demand unproven.",
  } },
  { issue: 447, topic: 57829, title: "Mexico Tech Week October 2026 — Zcash México", usd: 6380, outcome: "approved", asyncDate: "2026-10-02", feedback: {
    artkor: "Valued Palmar's sustained community work before receiving grant funding.",
    zerodartz: "Supported the experienced team and wanted an event report with lessons learned.",
  } },
  { issue: 448, topic: 57843, title: "Zcash Privacy Ecosystem Mapping & Adoption Data", usd: 5000, feedback: {
    paul: "Questioned additional funding given the analytics tools already available.",
    artkor: "Preferred this work to run through ZecHub's bounty programme.", hanh: "Found the previous report superficial compared with existing ZecHub data.",
    zerodartz: "Saw potential value but preferred smaller tasks through ZecHub bounties.",
  } },
  { issue: 449, topic: 57848, title: "Zcash Türkiye University Tour 2026", usd: 27000, outcome: "approved", asyncDate: "2026-10-09", feedback: {
    artkor: "Supported the preparation already completed and looked forward to the results.",
    gguy: "Welcomed the university outreach and the team's track record.",
    zerodartz: "Valued consistent delivery and considered students a suitable audience.",
    paul: "Saw university outreach as a valuable opportunity to introduce Zcash.",
  } },
  { issue: 450, topic: 57860, title: "Zcash Global Community & Marketing Operations", usd: 12000, feedback: {
    artkor: "Questioned this marketing approach and its potential effect on Zcash's reputation.",
    hanh: "Found the plan too weak for the scale of the marketing task.", gguy: "Did not support investment in this form of marketing.",
    zerodartz: "Wanted substantial coordination with existing communities before funding.",
  } },
  { issue: 454, topic: 57892, title: "0xramp: ZEC payments and wallet integrations (revision of #408)", usd: 45000, outcome: "approved", feedback: {
    artkor: "Trusted the team's working product, SDK work and plan to expand testing in Brazil.",
    gguy: "Welcomed the stronger revision addressing earlier concerns and considered it good value.",
    zerodartz: "Supported the reduced risks and existing reach; wanted risks clearly shown before a swap.",
  } },
  { issue: 453, topic: 57884, title: "zswap by stalllion labs", usd: 50000, feedback: {
    artkor: "Questioned delivery experience and the case for funding this implementation.",
    gguy: "Saw atomic-swap potential but found adoption and implementation needs insufficiently addressed.",
    hanh: "Raised liquidity, technical understanding and unresolved design concerns.",
    zerodartz: "Lacked confidence in the team's applied cryptography experience.",
  } },
  { issue: 455, topic: 57896, title: "Nozy Sync Engine public", usd: 45000, feedback: {
    artkor: "Did not see a sufficiently new contribution to fund.", gguy: "Found the added value to Zcash users unclear.",
    zerodartz: "Respected the developer but did not consider this proposal distinctive enough.", paul: "Agreed with the concerns about added value.",
  } },
  { issue: 456, topic: 57930, title: "Zcash Privacy Payment Rail & NFC Programmable Cards", usd: 150000, feedback: {
    gguy: "Found this type of proposal difficult to fund.", artkor: "Questioned demand, adoption evidence and the increased budget.",
    hanh: "Found differentiation and the expanded scope insufficiently explained.", zerodartz: "Raised third-party dependence and NFC security concerns.",
    paul: "Wanted a stronger team track record to support the ambitious concept.",
  } },
  { issue: 386, topic: 57698, title: "ZKP-cryptography course", usd: 5000, feedback: {
    gguy: "Wanted greater relevance to current Zcash proving systems and broader community benefit.",
    artkor: "Respected the lecturers and budget but wanted concrete Zcash outcomes.",
    hanh: "Preferred a course centred on Halo or Tachyon rather than unrelated technologies.", zerodartz: "Agreed with the objections to the proposed course.",
  } },
  { issue: 458, topic: 57939, title: "VaihtoFX: Shielded ZEC On/Off-Ramp via M-Pesa & Airtel Money in Kenya", usd: 132092, part: 2, feedback: {
    paul: "Did not want to fund uncertain regulatory classification.", artkor: "Wanted feasibility and a confirmed conversion partner before licensing-related funding.",
    gguy: "Found too many unresolved hurdles and insufficient likelihood of success.",
    hanh: "Wanted a demonstrated, reliable crypto-to-local-currency flow before adding Zcash.", zerodartz: "Wanted a stronger track record from the new team.",
  } },
  { issue: 460, topic: 57965, title: "Fixing, Updating & Streamlining of Zcash Documentation", usd: 40904, part: 2, feedback: {
    artkor: "Questioned the budget and whether these documents would remain useful during the node transition.",
    hanh: "Expected the old site to redirect to newer documentation.", zerodartz: "Preferred current node documentation and found the budget high.",
  } },
  { issue: 457, topic: 58008, title: "Build Buddies x Zcash: Privacy Education and Community Adoption in Latin America and Asia", usd: 10000, part: 2, feedback: {
    artkor: "Encouraged smaller collaborations with ZecHub and local communities before another application.",
    gguy: "Agreed with starting smaller and showed interest in reusable onboarding materials.",
    zerodartz: "Wanted a Zcash delivery record first, while seeing value in reusable materials.",
    hanh: "Valued a reusable activation kit but questioned the event plan across distant regions.",
  } },
  { issue: 462, topic: 58025, title: "Tells: a privacy checkup for Zcash wallets", usd: 24000, part: 2, feedback: {
    artkor: "Questioned what analysis using a viewing key could establish about an outside observer.",
    gguy: "Preferred education about viewing-key risks over funding this tool.",
    hanh: "Questioned outdated statistics and the reliance on a viewing key.", zerodartz: "Agreed that a separate tool was unnecessary.",
  } },
  { issue: 468, topic: 58051, title: "Hito Zcash: Stable Firmware, Internal Security Review, and Maintenance", usd: 88000, part: 2, feedback: {
    hanh: "Wanted working-product and user evidence before funding costly device UI optimisation.",
    zerodartz: "Saw wallet potential but considered this ask high and raised hardware security concerns.",
    gguy: "Questioned the delivery plan and how user demand was measured without purchase or preorder options.",
  } },
  { issue: 467, topic: 58046, title: "Zcash Shielded Payments: An English/Korean Research Report", usd: 20000, part: 2, feedback: {
    artkor: "Preferred a smaller Korean-localisation effort using existing research.",
    hanh: "Needed stronger evidence of research quality and value.", paul: "Did not see sufficient value in funding another research report.",
    zerodartz: "Agreed with the concerns raised.",
  } },
  { issue: 477, topic: 58090, title: "VKX Wallet: Native Shielded Zcash Integration & Open-Source React Native Module", usd: 48000, part: 2, feedback: {
    hanh: "Found the implementation plan missing, despite potential interest in a React Native integration.",
    zerodartz: "Considered the wallet's small user base insufficient to justify the grant.",
  } },
  { issue: 478, topic: 58092, title: "Travel Support for Devcon 8 Mumbai — Speaker, Curator, Performer (ZK-Music)", usd: 1000, part: 2, feedback: {
    zerodartz: "Liked creative projects but found no direct Zcash involvement here.",
    gguy: "Appreciated the artistic work but considered it outside ZCG's funding scope.",
  } },
];

export const PUBLISHED_COMMITTEE_DECISIONS: readonly PublishedCommitteeDecision[] = entries.map(entry => {
  const outcome = entry.outcome ?? "rejected";
  return {
    id: `zcg-github-${entry.issue}`, issueNumber: entry.issue,
    issueUrl: `https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/${entry.issue}`,
    title: entry.title, requestedUsd: entry.usd, tags: [], outcome,
    decisionDate: entry.asyncDate ?? OCTOBER_12_MINUTES.meetingDate,
    meetingDate: OCTOBER_12_MINUTES.meetingDate, publishedAt: OCTOBER_12_MINUTES.publishedAt,
    decisionMode: entry.asyncDate ? "async" : "meeting", unanimous: true,
    proposalUrl: `${forum}/${entry.topic}`, minutesUrl: `${minutes}/${entry.part ?? 1}`, voteEvidenceUrl: `${minutes}/1`,
    votes: (Object.keys(ZCG_EXAMPLE_MEMBERS) as ZcgMemberId[]).map(memberId => ({
      memberId, vote: outcome === "approved" ? "approve" : "reject",
      summary: entry.feedback[memberId] ?? "No individual comment published. Vote recorded through the minutes' unanimous decision.",
      basis: entry.feedback[memberId] ? "individual" : "unanimous",
    })),
  };
});

/** Only an exact official issue identity can receive committee annotations. */
export function publishedDecisionForIssue(url: string | null | undefined, now = Date.now()) {
  const match = url?.match(/^https:\/\/github\.com\/ZcashCommunityGrants\/zcashcommunitygrants\/issues\/([1-9]\d*)\/?(?:[?#].*)?$/i);
  return match ? PUBLISHED_COMMITTEE_DECISIONS.find(decision => decision.issueNumber === Number(match[1]) && Date.parse(decision.publishedAt) <= now) ?? null : null;
}
