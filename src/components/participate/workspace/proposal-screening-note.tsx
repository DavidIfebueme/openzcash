import type { OfficialProposalListing } from "@/lib/participate/official-proposals-model";
import { githubProposalOutcome, type ZcgSourceMetadata } from "@/lib/participate/workspace/domain/zcg-source-metadata";

/** Explain spreadsheet screening without presenting it as a committee rejection. */
export function ProposalScreeningNote({ listing, source }: {
  listing: OfficialProposalListing;
  source?: ZcgSourceMetadata;
}) {
  if (listing.outcome !== "filtered") return null;
  const stillUnderReview = source && githubProposalOutcome(source) === "under_review";
  return <div className="proposal-screening-note">
    <p>{listing.statusDetail || "Filtered before committee review."}{listing.statusSourceUrl ? <>{" · "}<a href={listing.statusSourceUrl} target="_blank" rel="noopener noreferrer">Spreadsheet ↗</a></> : null}</p>
    {stillUnderReview ? <p>GitHub shows Under review at the last source check. <a href={source.url} target="_blank" rel="noopener noreferrer">View GitHub ↗</a></p> : null}
  </div>;
}
