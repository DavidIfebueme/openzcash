import type { SignedReviewSummary } from "@/lib/participate/workspace/domain/proposal-participation";
import { AccountAvatar } from "./workspace-account";

import { ReviewTurnout } from "./review-turnout";

export function SignedReviewCard({ review, communityId, recordId }: { review?: SignedReviewSummary | null; communityId: string; recordId: string }) {
  if (!review) return null;
  const published = review.state === "PUBLISHED" && review.signed === 5 && review.eligible === 5 && review.positions?.length === 5;
  return <section className="proposal-published-decision signed-review-card" aria-label="Independent signed review">
    <div className="proposal-published-decision-heading"><div><strong>Signed pilot review</strong><span>{published ? `${review.outcome === "APPROVED" ? "Approved" : "Rejected"} · ${review.approve} approve · ${review.reject} reject · ${review.abstain} abstain` : "Collecting responses"}</span></div>
      <ReviewTurnout recorded={review.signed} eligible={review.eligible} outcome={published && review.outcome === "REJECTED" ? "rejected" : undefined} /></div>
    {published ? <ul className="signed-review-positions">{review.positions!.map((position, i) => <li key={i}><details><summary><AccountAvatar name={position.name} /><span><strong>{position.name}</strong><small>{position.choice === "APPROVE" ? "Approve" : position.choice === "REJECT" ? "Reject" : "Abstain"}</small></span></summary><p>{position.rationale}</p></details></li>)}</ul> : <p className="proposal-published-decision-caption">Choices and reasons appear together after all five responses.</p>}
    <div className="proposal-decision-source"><p className="proposal-published-decision-caption">Independent review of revision {review.revision}. Official ZCG outcomes follow the published source. Check Activity for the review’s separate chain proof.</p>{published ? <a className="dao-text-button" href={`/api/communities/${encodeURIComponent(communityId)}/archives/${encodeURIComponent(recordId)}/decisions/${encodeURIComponent(review.roundId)}`}>Signed receipt ↓</a> : null}</div>
  </section>;
}
