/** Turnout counts recorded responses, including abstentions; it is not approval. */
export function ReviewTurnout({ recorded, eligible, outcome }: { recorded?: number | null; eligible?: number; outcome?: "approved" | "rejected" }) {
  const known = typeof recorded === "number" && Number.isInteger(recorded) && recorded >= 0
    && typeof eligible === "number" && Number.isInteger(eligible) && eligible > 0 && recorded <= eligible;
  const percent = known ? Math.round(recorded / eligible * 100) : null;
  const tone = percent === null ? "unknown" : outcome === "rejected" ? "rejected" : recorded === eligible ? "complete" : "partial";
  const description = known
    ? `${percent}% turnout: ${recorded} of ${eligible} member responses recorded, including abstentions. Not an approval percentage.`
    : "Turnout unavailable: member responses have not been published.";
  return <div className="proposal-review-turnout" data-tone={tone} role="group" aria-label={description} title={description}>
    <div className="proposal-review-turnout-value"><strong>{percent === null ? "—" : `${percent}%`}</strong><span>Turnout</span></div>
  </div>;
}
