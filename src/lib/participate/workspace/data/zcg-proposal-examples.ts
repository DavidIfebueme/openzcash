/** Read-only historical examples. Never create DAO ballots, members or treasury entries. */
export const ZCG_EXAMPLE_MEMBERS = {
  artkor: { name: "Artkor", shortName: "Artkor", avatar: "/images/zcg/artkor.png" },
  hanh: { name: "Hanh", shortName: "Hanh", avatar: "/images/zcg/hanh.png" },
  gguy: { name: "GGuy", shortName: "GGuy", avatar: "/images/zcg/gguy.png" },
  paul: { name: "Paul Brigner", shortName: "Paul", avatar: "/images/zcg/paulbrigner.png" },
  zerodartz: { name: "Zerodartz", shortName: "Zerodartz", avatar: "/images/zcg/zerodartz.png" }
} as const;

export type ZcgMemberId = keyof typeof ZCG_EXAMPLE_MEMBERS;
export type ZcgVote = "approve" | "reject" | "abstain";
export type ZcgMemberFeedback = { memberId: ZcgMemberId; vote: ZcgVote; summary: string; basis?: "individual" | "unanimous" };
export type ZcgProposalExample = {
  id: string;
  title: string;
  decisionDate: string;
  outcome: "approved" | "rejected";
  requestedUsd: number;
  tags: string[];
  proposalUrl: string;
  minutesUrl: string;
  votes: readonly ZcgMemberFeedback[];
  meetingDate?: string;
  decisionMode?: "meeting" | "async";
  unanimous?: boolean;
  voteEvidenceUrl?: string;
};

const forum = "https://forum.zcashcommunity.com/t";
const september28 = `${forum}/zcash-community-grants-zcg-meeting-minutes-9-28-2026/57928`;
const september14 = `${forum}/zcash-community-grants-meeting-minutes-9-14-2026/57615`;

/** Reviewed against the linked ZCG minutes on 2026-10-09. Feedback is paraphrased. */
export const ZCG_PROPOSAL_EXAMPLES: readonly ZcgProposalExample[] = [
  {
    id: "zcg-graphsense-2026-09-28",
    title: "GraphSense Zcash Shielded Accounting Repair",
    decisionDate: "2026-09-28", outcome: "approved", requestedUsd: 8000,
    tags: ["infrastructure", "research"],
    proposalUrl: `${forum}/grant-application-graphsense-zcash-shielded-accounting-repair/57585`,
    minutesUrl: `${september28}/1`,
    votes: [
      { memberId: "artkor", vote: "reject", summary: "Preferred ZCG funding to prioritize privacy improvements over blockchain analytics." },
      { memberId: "hanh", vote: "approve", summary: "Supported a modest, one-time tool for community privacy assessment." },
      { memberId: "gguy", vote: "approve", summary: "Valued open research tools and broader access to privacy analysis." },
      { memberId: "paul", vote: "approve", summary: "Accepted the modest cost and research value despite reservations about analytics." },
      { memberId: "zerodartz", vote: "approve", summary: "Wanted accurate Zcash results in open-source research despite mixed feelings." }
    ]
  },
  {
    id: "zcg-ironwood-2026-09-28",
    title: "Human-readable Ironwood verification: Bulletproofs in the AGM",
    decisionDate: "2026-09-28", outcome: "approved", requestedUsd: 8000,
    tags: ["research", "protocol"],
    proposalUrl: `${forum}/grant-application-human-readable-version-of-ironwood-formal-verification-first-steps-bulletproofs-in-the-agm/57726`,
    minutesUrl: `${september28}/2`,
    votes: [
      { memberId: "artkor", vote: "approve", summary: "Found the idea interesting and hoped it would succeed." },
      { memberId: "hanh", vote: "approve", summary: "Curious about future work, despite limited immediate value and considerable complexity." },
      { memberId: "gguy", vote: "approve", summary: "Considered the funding request reasonable." },
      { memberId: "paul", vote: "abstain", summary: "Abstention recorded; no individual rationale was published." },
      { memberId: "zerodartz", vote: "approve", summary: "Wanted an understandable explanation, while questioning the broader impact." }
    ]
  },
  {
    id: "zcg-seedsigner-2026-09-14",
    title: "Zcash SeedSigner: DIY signer for shielded ZEC",
    decisionDate: "2026-09-14", outcome: "rejected", requestedUsd: 65000,
    tags: ["wallets", "security"],
    proposalUrl: `${forum}/grant-application-zcash-seedsigner-a-diy-open-source-air-gapped-signer-for-shielded-zec/57381`,
    minutesUrl: `${september14}/1`,
    votes: [
      { memberId: "artkor", vote: "reject", summary: "Considered the audience too niche for the budget and current priorities." },
      { memberId: "hanh", vote: "reject", summary: "Questioned cost, security and integration for a hobbyist device." },
      { memberId: "gguy", vote: "reject", summary: "Found the project interesting but its value insufficient for the ask." },
      { memberId: "paul", vote: "reject", summary: "Wanted agreed wallet integration before funding." },
      { memberId: "zerodartz", vote: "reject", summary: "Considered the limited user group insufficient to justify funding." }
    ]
  },
  {
    id: "zcg-mumbai-2026-09-14",
    title: "Zcash World, Mumbai — Devcon 8 week",
    decisionDate: "2026-09-14", outcome: "approved", requestedUsd: 20300,
    tags: ["events", "community"],
    proposalUrl: `${forum}/grant-application-zcash-world-mumbai-devcon-8-week/57253`,
    minutesUrl: `${september14}/1`,
    votes: [
      { memberId: "artkor", vote: "approve", summary: "Valued shielded payments, low-end wallet testing and local merchant onboarding." },
      { memberId: "hanh", vote: "approve", summary: "Backed the concrete plan, known team and reasonable budget." },
      { memberId: "gguy", vote: "approve", summary: "Supported the event and looked forward to its results." },
      { memberId: "paul", vote: "approve", summary: "Saw potential to reuse the approach at future events." },
      { memberId: "zerodartz", vote: "approve", summary: "Valued the team's track record and WebZero collaboration." }
    ]
  },
  {
    id: "zcg-arabia-2026-08-31",
    title: "Zcash Arabia — August to December 2026",
    decisionDate: "2026-08-31", outcome: "approved", requestedUsd: 27000,
    tags: ["community", "education"],
    proposalUrl: `${forum}/grant-application-zcash-arabia-august-to-december-2026/57170`,
    minutesUrl: `${forum}/zcash-community-grants-meeting-minutes-8-31-2026/57394/2`,
    votes: [
      { memberId: "artkor", vote: "reject", summary: "Questioned the authenticity of meetup images and opposed the requested funding." },
      { memberId: "hanh", vote: "approve", summary: "Recognized delivery of requested activities, particularly in-person events and distinctive community work." },
      { memberId: "gguy", vote: "approve", summary: "Saw improving impact and encouraged deeper collaboration across communities." },
      { memberId: "paul", vote: "approve", summary: "Valued the community work and the team's responsiveness to feedback." },
      { memberId: "zerodartz", vote: "reject", summary: "Acknowledged improvements but wanted original meetup photos reviewed before approving." }
    ]
  }
];

/** Every recorded position, including abstention, occupies one equal seat. */
export function summarizeZcgVotes(votes: readonly ZcgMemberFeedback[]) {
  const approve = votes.filter(vote => vote.vote === "approve").length;
  const reject = votes.filter(vote => vote.vote === "reject").length;
  const abstain = votes.filter(vote => vote.vote === "abstain").length;
  return { approve, reject, abstain, total: votes.length, supportPercent: votes.length ? approve / votes.length * 100 : null };
}

/** Participation uses the full five-seat roster, including recorded abstentions. */
export function summarizeZcgParticipation(votes: readonly ZcgMemberFeedback[]) {
  const roster = Object.keys(ZCG_EXAMPLE_MEMBERS) as ZcgMemberId[];
  const recorded = roster.map(memberId => votes.find(vote => vote.memberId === memberId)).filter(vote => vote !== undefined);
  return {
    eligible: roster.length,
    recorded: recorded.length,
    turnoutPercent: recorded.length / roster.length * 100,
    supportPercent: recorded.filter(vote => vote.vote === "approve").length / roster.length * 100
  };
}
