import Image from "next/image";
import { ZCG_EXAMPLE_MEMBERS } from "@/lib/participate/workspace/data/zcg-proposal-examples";

import { ReviewTurnout } from "./review-turnout";

/** The roster is context for a review, not evidence that a member has voted. */
export function PendingCommitteeCard() {
  return <section className="proposal-published-decision proposal-pending-committee" aria-label="Committee review awaiting meeting minutes">
    <div className="proposal-published-decision-heading"><div><strong>Committee review</strong><span>Awaiting meeting minutes</span></div><ReviewTurnout /></div>
    <ul className="proposal-pending-members" aria-label="Committee members; no published votes yet">
      {Object.entries(ZCG_EXAMPLE_MEMBERS).map(([id, member]) => <li key={id} className="proposal-pending-member" aria-label={member.name}>
        <span className="dao-zcg-portrait"><Image src={member.avatar} alt="" width={40} height={40} /></span>
        <span>{member.shortName}</span>
      </li>)}
    </ul>
  </section>;
}
