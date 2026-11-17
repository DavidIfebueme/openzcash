import { ACTIVE_CYCLE } from "./cycles";

/** Program administration requests are filed on the forum, not as GitHub
 * applications, so the ready-for-vote listing never contains them. Each entry
 * is transcribed from its forum post and bound to the cycle whose vote carries it. */
export type AdministrationRequest = {
  id: string;
  cycleId: string;
  title: string;
  applicant: string;
  requestedUsdCents: number;
  url: string;
  filedAt: string;
  summary: string;
  disclosure: string;
};

export const ADMINISTRATION_REQUESTS: readonly AdministrationRequest[] = [
  {
    id: "fpf-admin-2027",
    cycleId: "q4-2026",
    title: "FPF Administrative & Operational Role for the Coinholder-Directed Retroactive Grants Program: 2027 Renewal",
    applicant: "Financial Privacy Foundation (FPF)",
    requestedUsdCents: 5_800_000,
    url: "https://forum.zcashcommunity.com/t/proposal-funding-fpf-s-administrative-operational-role-for-the-coinholder-directed-retroactive-grants-program-2027-renewal/59063",
    filedAt: "2026-11-09T14:29:56Z",
    summary: "Unlike the proposals above, this request funds future work: FPF’s administration of the program for calendar year 2027 (the Q1–Q4 2027 rounds), as a one-year pre-paid flat fee in shielded ZEC, unchanged from FPF’s first term. It covers quarterly calls for proposals, GitHub intake and triage, vetting and KYC, voting coordination, payout coordination and public reporting.",
    disclosure: "Disclosure: FPF administers this program and authored this request.",
  },
];

export function cycleAdministration(cycleId: string = ACTIVE_CYCLE.id): AdministrationRequest[] {
  return ADMINISTRATION_REQUESTS.filter((request) => request.cycleId === cycleId);
}
