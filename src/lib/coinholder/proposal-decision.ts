import type { Round } from "./types";
import { QUORUM_ZEC } from "./derive";
import type { VerifyRow } from "./verify";

/** A stable proposal id is scoped to its round, never confused with a ballot number. */
export const proposalVerifyHref = (roundId: string, proposalId: string) =>
  `/coinholders/verify/${encodeURIComponent(roundId)}/${encodeURIComponent(proposalId)}`;

const FIELD = { approve: "accept", reject: "reject", rejectLower: "lower", abstain: "abstain" } as const;

/** All figures share the existing verifier; chart coordinates never decide an outcome. */
export function proposalDecision(round: Round, row: VerifyRow) {
  if (row.total === null || row.accept === null || row.reject === null) return null;
  const rejected = row.reject + (row.lower ?? 0);
  const directional = row.accept + rejected;
  const total = row.total;
  let bottom = 0;
  const scaleMax = Math.max(total, QUORUM_ZEC);
  const options = round.ballot.map(option => {
    const value = row[FIELD[option.key]] ?? 0;
    const segment = { ...option, value, share: total > 0 ? value / total : null,
      directionalShare: option.key !== "abstain" && directional > 0 ? value / directional : null,
      start: bottom / scaleMax, size: value / scaleMax };
    bottom += value;
    return segment;
  });
  return { total, rejected, directional, majorityCutoff: directional / 2,
    majorityMet: row.accept > rejected, quorumMet: row.quorumMet === true,
    approveShare: row.approveShare, options, scaleMax,
    quorumPosition: QUORUM_ZEC / scaleMax,
    majorityPosition: (directional / 2) / scaleMax };
}
