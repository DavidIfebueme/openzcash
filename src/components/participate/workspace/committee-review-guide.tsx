import type { CommitteeWorkspace } from "@/lib/participate/workspace/domain/committee";

export function CommitteeReviewGuide({ data, onMembers }: { data: CommitteeWorkspace; onMembers: () => void }) {
  const me = data.members.find(member => member.isMe && member.status === "ACTIVE");
  const preview = data.demo || !data.role;
  return <section className="committee-flow committee-flow--compact" aria-label="Your review workflow">
    <div className="committee-access-note" role="note"><strong>{preview ? "Admin preview · Read only" : data.permissions.canReview ? me?.ready ? "Ready to review" : "Complete your reviewer setup" : "Discussion access"}</strong><button type="button" className="dao-text-button" onClick={onMembers}>Members & access →</button></div>
    <details className="committee-flow-help"><summary>How this works</summary><p>Review the proposal and discussion. Sign your vote with a public reason. All five responses publish the card; Finish shows the chain proof and prepares the proposal row for Google Sheets.</p><p>{preview ? "Admin access does not assign a voting seat. This preview cannot submit votes or save tags." : !data.permissions.canReview ? "Voting requires a reviewer seat; moderators manage discussion." : !me?.ready ? "Accept your invitation, verify your email and add a passkey under Account → Profile → Passkeys." : "Three approvals out of five are required. No deadline."} Source comments keep their original authors. OpenZcash discussion and local tags appear on the public proposal; neither is a vote.</p><p>Pilot reviews remain separate from official ZCG decisions. A signed review is not yet a confirmed chain anchor.</p></details>
  </section>;
}
