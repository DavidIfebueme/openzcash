import type { Catalog } from "@/lib/ecosystem/types";
import { COMMUNITIES, COMMUNITIES_VERIFIED_ON } from "@/lib/communities/data";
import { recipientLedgerKeys } from "@/lib/zcg/recipient-aliases";
import { DAO_PROPOSALS_VERIFIED_ON, ZECHUB_DAO_PROPOSALS, daoProposalUrl } from "@/lib/communities/dao-proposals";
import type { HistoryIdentity } from "./types";

/** Explicit catalog identities only. Search can suggest; it never associates money. */
export function historyIdentities(catalog: Catalog): HistoryIdentity[] {
  const identities: HistoryIdentity[] = catalog.registry.projects.map(project => ({
    id: project.id, name: project.name, description: project.description,
    category: project.category, website: project.website, project,
    communityId: null, recipientKeys: [], applicationTopics: [], reportTopics: [],
    checkedAt: project.checkedAt ?? catalog.registry.checkedAt,
    repositories: catalog.snapshot.repositories.filter(repo =>
      project.repositories.some(name => [repo.fullName, ...repo.aliases].some(alias => alias.toLowerCase() === name.toLowerCase()))),
  }));
  for (const community of COMMUNITIES) {
    // Only ZecHub is deliberately shared by the two independently curated catalogs.
    const existing = community.id === "zechub" ? identities.find(item => item.id === "zechub") : undefined;
    const identity: HistoryIdentity = existing ?? {
      id: `community-${community.id}`, name: community.name, description: community.about,
      category: "Community", website: community.links.site ?? `/communities`, project: null,
      communityId: null, recipientKeys: [], applicationTopics: [], reportTopics: [], repositories: [],
      checkedAt: COMMUNITIES_VERIFIED_ON,
    };
    identity.communityId = community.id;
    identity.recipientKeys = community.zcg.recipient ? recipientLedgerKeys(community.zcg.recipient) : [];
    identity.applicationTopics = community.forumTopics.filter(topic => topic.kind === "application").map(topic => topic.id);
    identity.reportTopics = community.forumTopics.filter(topic => topic.kind === "report").map(({ id, title }) => ({ id, title }));
    identity.daoFundingSources = (community.zcg.zechubDao?.proposals ?? []).map(ref => {
      const proposal = ZECHUB_DAO_PROPOSALS[ref];
      if (!proposal) throw new Error(`Unknown ZecHub DAO proposal: ${ref}`);
      return { ref, title: proposal.title, url: daoProposalUrl(ref), createdAt: proposal.created,
        period: proposal.period, reviewedAt: DAO_PROPOSALS_VERIFIED_ON };
    });
    if (!existing) identities.push(identity);
  }
  return identities.sort((a, b) => a.name.localeCompare(b.name));
}

export function searchHistoryIdentities(identities: HistoryIdentity[], query: string) {
  const q = query.trim().toLowerCase();
  const exact = identities.filter(item => item.id.toLowerCase() === q || item.name.toLowerCase() === q);
  if (exact.length) return exact;
  const terms = q.split(/\s+/).filter(Boolean);
  return identities.filter(item => terms.every(term => `${item.id} ${item.name} ${item.category}`.toLowerCase().includes(term)));
}
