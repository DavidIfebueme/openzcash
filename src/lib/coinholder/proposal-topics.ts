export const TOPIC_ANALYSIS_VERSION = "coinholder-topics-v1";
export const MAX_PROPOSAL_TOPICS = 3;
export const PROPOSAL_TOPICS = [
  { id: "security-research", label: "Security research", tone: "blue", scope: "Finding, investigating and responsibly disclosing vulnerabilities." },
  { id: "bug-bounty", label: "Bug bounty", tone: "amber", scope: "Rewards or bounty-equivalent retroactive compensation for vulnerability reports. A subject, never a claim of approval or payment." },
  { id: "security-audit", label: "Security audit", tone: "purple", scope: "A systematic security review or audit delivered by the applicant." },
  { id: "integration", label: "Integration", tone: "teal", scope: "Connecting Zcash to a product, service, protocol or platform." },
  { id: "cross-chain", label: "Cross-chain", tone: "teal", scope: "Interoperability, swaps or transfers across blockchain networks." },
  { id: "wallets", label: "Wallets", tone: "amber", scope: "Building or improving software for managing keys and sending or receiving funds." },
  { id: "protocol", label: "Protocol", tone: "blue", scope: "Consensus rules, cryptography and network-upgrade implementation." },
  { id: "node-software", label: "Node software", tone: "blue", scope: "Developing, maintaining or deploying Zcash node software as a deliverable, not merely reporting a bug in a node." },
  { id: "developer-tools", label: "Developer tools", tone: "blue", scope: "SDKs, libraries, testing tools and development tooling." },
  { id: "infrastructure", label: "Infrastructure", tone: "blue", scope: "Operating shared network services, indexers, RPCs or hosting." },
  { id: "research", label: "Research", tone: "purple", scope: "Original technical or scientific research that does not fit a more specific topic." },
  { id: "privacy", label: "Privacy", tone: "purple", scope: "Privacy-specific technology or analysis as the actual deliverable, not Zcash privacy in general." },
  { id: "applications", label: "Applications", tone: "teal", scope: "End-user products or applications, excluding more specific wallet work." },
  { id: "education", label: "Education", tone: "teal", scope: "Tutorials, courses, documentation and educational materials." },
  { id: "community", label: "Community", tone: "purple", scope: "Community support, outreach and local organizing." },
  { id: "media", label: "Media", tone: "amber", scope: "Journalism, videos, podcasts and other published media." },
  { id: "events", label: "Events", tone: "purple", scope: "Organizing conferences, meetups and hackathons." },
  { id: "operations", label: "Operations", tone: "neutral", scope: "Administrative and operational work as the funded deliverable." },
] as const;
export type ProposalTopicId = typeof PROPOSAL_TOPICS[number]["id"];
export type TopicEvidence = { id: ProposalTopicId; confidence: number; evidence: string };
export type TopicAnalysis = { version: string; model: string; analyzedAt: string; tags: TopicEvidence[] };
export type TopicInput = { title: string; category: string | null; body: string };

/** A display topic only; the applicant's original category stays in the source record. */
export function proposalTopic(proposal: Pick<TopicInput, "title" | "category">): string {
  const category = proposal.category?.trim() || "Uncategorized";
  const research = /^research\s*(?:&|and)\s*development$/i.test(category);
  const security = /\b(?:CVE-\d{4}-\d{4,}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|vulnerability disclosure|security research|bug bounty)\b/i.test(proposal.title);
  return research && security ? "Security research" : category;
}

/** Validated semantic tags when available; otherwise preserve the existing source fallback. */
export function displayProposalTopics(proposal: Pick<TopicInput, "title" | "category"> & { topicAnalysis?: TopicAnalysis }) {
  if (proposal.topicAnalysis?.tags.length) return proposal.topicAnalysis.tags.map((tag) => {
    const topic = PROPOSAL_TOPICS.find((entry) => entry.id === tag.id)!;
    return { id: tag.id, label: topic.label, tone: topic.tone as string, note: `From the proposal: “${tag.evidence}”` };
  });
  const label = proposalTopic(proposal);
  return [{ id: label, label, tone: label === "Integration" ? "teal" : /research/i.test(label) ? "blue" : "neutral",
    note: proposal.category ? `Source category: ${proposal.category}` : "No source category specified" }];
}
