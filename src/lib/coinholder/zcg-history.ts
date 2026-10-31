import type { Q4ProposalSummary } from "./q4";
import { recipientLedgerKeys } from "@/lib/zcg/recipient-aliases";
import { safeExternalUrl } from "@/lib/ecosystem/catalog";

export type PriorZcg =
  | { status: "confirmed"; basis: "proposal" | "recipient"; title: string; recipient: string; href: string }
  | { status: "unconfirmed" | "unavailable" };

export type ZcgPayment = {
  project: string | null; recipient: string; sourceSheet: string;
  isPaid: boolean; paidDate: string | null; isTest: boolean; isInternal: boolean;
};
export type ZcgApproval = {
  title: string; applicantsRaw: string | null; program: string; status: string;
  decisionDate: string | null; platformLink: string | null; forumLink: string | null;
};
export type ZcgHistoryRecords = {
  payments: ZcgPayment[] | null;
  approvals: ZcgApproval[] | null;
};

const key = (name: string) => name.normalize("NFKC").trim().replace(/^@/, "").toLowerCase().replace(/\s+/g, " ");
const meaningful = (name: string) => !!name && !/^(n\/?a|none|unknown|anonymous|not specified|individual|team|[-—])$/i.test(name);
const identities = (name: string) => recipientLedgerKeys(name).map(key).filter(meaningful);
const titleKey = (title: string) => key(title.replace(/^(?:retroactive )?grant application\s*[-–—:]\s*/i, ""));

/** A dated source must precede the current application. A matching software
 * name, an audit beneficiary or a Coinholder award is not recipient identity. */
export function priorZcg(proposal: Q4ProposalSummary, records: ZcgHistoryRecords): PriorZcg {
  const names = new Set([proposal.organization ?? "", proposal.applicant].flatMap(identities));
  const sameRecipient = (name: string | null) => !!name && identities(name).some((value) => names.has(value));
  const created = Date.parse(proposal.createdAt);
  const earlier = (date: string | null) => !!date && Number.isFinite(created) && Number.isFinite(Date.parse(date)) && date.slice(0, 10) < proposal.createdAt.slice(0, 10);

  const approvals = (records.approvals ?? []).filter((row) => row.program === "zcg" && row.status === "approved" &&
    earlier(row.decisionDate) && sameRecipient(row.applicantsRaw));
  // An exact title within the same applicant identifies the earlier proposal;
  // other approvals still establish that the recipient has ZCG history.
  approvals.sort((a, b) => Number(titleKey(b.title) === titleKey(proposal.title)) - Number(titleKey(a.title) === titleKey(proposal.title)));
  for (const row of approvals) {
    const href = safeExternalUrl(row.forumLink) ?? safeExternalUrl(row.platformLink);
    if (href) return { status: "confirmed", basis: titleKey(row.title) === titleKey(proposal.title) ? "proposal" : "recipient",
      title: row.title, recipient: row.applicantsRaw!, href };
  }

  // Keep recipient, payment state and date on the same row. A project-level
  // aggregate can combine one recipient's old date with another's payment.
  const payment = (records.payments ?? []).find((row) => row.sourceSheet === "grants_disbursed" && row.project &&
    row.isPaid && !row.isTest && !row.isInternal && earlier(row.paidDate) && sameRecipient(row.recipient));
  if (payment) return { status: "confirmed", basis: "recipient", title: payment.project!, recipient: payment.recipient,
    href: `/zcg/grant?g=${encodeURIComponent(payment.project!)}` };
  return { status: records.payments === null || records.approvals === null ? "unavailable" : "unconfirmed" };
}
