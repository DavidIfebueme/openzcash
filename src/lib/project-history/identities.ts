import type { Catalog } from "@/lib/ecosystem/types";
import { safeExternalUrl } from "@/lib/ecosystem/catalog";
import type { CommunityLinks } from "@/lib/communities/data";
import { COMMUNITIES, COMMUNITIES_VERIFIED_ON } from "@/lib/communities/data";
import { recipientLedgerKeys } from "@/lib/zcg/recipient-aliases";
import { DAO_PROPOSALS_VERIFIED_ON, ZECHUB_DAO_PROPOSALS, daoProposalUrl } from "@/lib/communities/dao-proposals";
import type { HistoryIdentity } from "./types";

const communityLinkLabels: Partial<Record<keyof CommunityLinks, string>> = {
  x: "X", telegram: "Telegram", discord: "Discord", youtube: "YouTube", instagram: "Instagram",
  tiktok: "TikTok", facebook: "Facebook", linkedin: "LinkedIn", whatsapp: "WhatsApp", substack: "Substack",
  medium: "Medium", bluesky: "Bluesky", linktree: "Linktree", site: "Website",
};

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
    // Preserve the community catalog's reviewed public links. Profile URLs are
    // identity references, not extracted posts, reports or proof of delivery.
    identity.referenceSources = Object.entries(community.links).flatMap(([key, value]) => {
      const label = communityLinkLabels[key as keyof CommunityLinks];
      const url = safeExternalUrl(value);
      return label && url ? [{ label: `${community.name} · ${label}`, url, observedAt: COMMUNITIES_VERIFIED_ON }] : [];
    });
    identity.referenceSources.push(...community.forumTopics.filter(topic => Number.isSafeInteger(topic.id) && topic.id > 0).map(topic => ({
      label: topic.title, url: `https://forum.zcashcommunity.com/t/${topic.id}`, observedAt: COMMUNITIES_VERIFIED_ON,
    })));
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
