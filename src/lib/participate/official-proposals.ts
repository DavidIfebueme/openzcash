import "server-only";
import { readPublishedProposals } from "@/lib/zcg/published-proposals";
import { officialProposalListings, type OfficialProposalSnapshot } from "./official-proposals-model";

export async function readOfficialProposals(): Promise<OfficialProposalSnapshot> {
  const published = await readPublishedProposals();
  return { version: 1, readAt: new Date().toISOString(), proposals: officialProposalListings(published.rows) };
}

/** Source collection must not hold up account, credits or discussions on a cold start. */
export async function initialOfficialProposals(): Promise<OfficialProposalSnapshot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([readOfficialProposals().catch(() => null),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1_000); })]);
  } finally { clearTimeout(timer); }
}
