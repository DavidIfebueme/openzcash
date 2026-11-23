import { ACTIVE_CYCLE } from "./cycles";
import type { Q4Proposal } from "./q4";

const forumUrl = "https://forum.zcashcommunity.com/t/retroactive-grant-application-zcash-address-fixes-nu7-readiness-board-and-zec-refund-tools-cryppit/58901";

// The application and dates below come from forum posts 1 and 8. FPF kept
// #87 in review while hidden and requested restoration about a week before
// review closes. Stop relying on that provisional decision in the final week.
const cryppit: Q4Proposal = {
  number: 87,
  title: "Zcash address fixes, NU7 readiness board and ZEC refund tools (Cryppit)",
  applicant: "Anirudh-712",
  organization: "Cryppit (Anirudh Tumuluru, solo)",
  category: "Integration",
  summary: "Cryppit reports fixes for Zcash address handling, a board tracking NU7 readiness, and tools for checking refunds and shielded receipts.",
  requestedUsdCents: 1_600_000,
  createdAt: "2026-11-05T11:54:00Z",
  updatedAt: "2026-11-21T13:52:00Z",
  url: forumUrl,
  reviewDecisionUrl: forumUrl + "/8",
  body: "",
};

export function retainedCryppitProposal(now: number) {
  const finalReviewWeek = Date.parse(ACTIVE_CYCLE.reviewClose) - 7 * 24 * 60 * 60_000;
  if (ACTIVE_CYCLE.id === "q4-2026" && now >= Date.parse(cryppit.updatedAt) && now < finalReviewWeek) return cryppit;
}
