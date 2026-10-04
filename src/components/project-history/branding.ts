import { COMMUNITIES } from "@/lib/communities/data";
import type { HistoryIdentity } from "@/lib/project-history/types";
import { isLocalBrandAsset, projectBrand, type Brand } from "@/components/ecosystem/branding";

const communitiesById = new Map(COMMUNITIES.map(community => [community.id, community]));

/** Presentation only: reuse verified catalogs, never infer a logo from a name. */
export function historyBrand(identity: Pick<HistoryIdentity, "project" | "communityId">): Brand | null {
  if (identity.project) {
    const brand = projectBrand(identity.project);
    if (brand) return brand;
  }
  const community = identity.communityId ? communitiesById.get(identity.communityId) : undefined;
  if (!community?.logo || !isLocalBrandAsset(community.logo)) return null;
  const sourceUrl = community.links.x ?? community.links.site;
  if (!sourceUrl) return null;
  return { src: community.logo, name: community.name, kind: "community", sourceUrl };
}
