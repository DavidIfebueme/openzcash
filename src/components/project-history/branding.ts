import { COMMUNITIES } from "@/lib/communities/data";
import type { CommunityMarkIdentity } from "@/components/communities/community-mark";
import type { HistoryIdentity } from "@/lib/project-history/types";
import { isLocalBrandAsset, projectBrand, type Brand } from "@/components/ecosystem/branding";

const communitiesById = new Map(COMMUNITIES.map(community => [community.id, community]));

/** Reuse the directory's exact logo or flag without shipping its funding data. */
export function historyCommunityMark(identity: Pick<HistoryIdentity, "communityId">): CommunityMarkIdentity | null {
  const community = identity.communityId ? communitiesById.get(identity.communityId) : undefined;
  if (!community) return null;
  return {
    name: community.name,
    flag: community.flag,
    ...(community.logo && isLocalBrandAsset(community.logo) ? { logo: community.logo } : {}),
  };
}

/** Community identities keep their directory mark, including joined project records. */
export function historyBrand(identity: Pick<HistoryIdentity, "project" | "communityId">): Brand | null {
  const community = identity.communityId ? communitiesById.get(identity.communityId) : undefined;
  if (community) {
    const sourceUrl = community.links.x ?? community.links.site;
    return community.logo && isLocalBrandAsset(community.logo) && sourceUrl
      ? { src: community.logo, name: community.name, kind: "community", sourceUrl }
      : null;
  }
  return identity.project ? projectBrand(identity.project) : null;
}
