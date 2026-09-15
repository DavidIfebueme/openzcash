import { isDeepStrictEqual } from "node:util";

/** Public ZCG updates include completed calendar days in Brasilia (D-1). */
export const PUBLICATION_TIME_ZONE = "America/Sao_Paulo";

export function publicationDay(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PUBLICATION_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

export type PublicationState<T> = {
  published: T | null;
  pending: T | null;
  observedAt: Date;
};

export function publishedValue<T>(state: PublicationState<T>, now = new Date()): T | null {
  return publicationDay(state.observedAt) < publicationDay(now)
    ? state.pending : state.published;
}

/** Reimports do not restart the delay; same-day corrections replace the draft. */
export function observePublication<T>(
  previous: PublicationState<T> | undefined,
  value: T | null,
  initial: T | null,
  now = new Date(),
): PublicationState<T> {
  if (previous && isDeepStrictEqual(previous.pending, value)) return previous;
  return {
    published: previous ? publishedValue(previous, now) : initial,
    pending: value,
    observedAt: now,
  };
}

type ProposalIdentity = {
  id: string; program: string; titleKey: string;
  platformLink?: string | null; submittedDate?: string | null; origin?: string | null;
};

/** Sheet row positions and issue comment fragments are not proposal identities. */
export function proposalPublicationKey(p: ProposalIdentity): string {
  if (p.origin === "admin") return `admin:${p.id}`;
  const link = p.platformLink?.trim().split("#")[0].replace(/\/+$/, "").toLowerCase();
  return `${p.program}|${link || `${p.titleKey}|${p.submittedDate ?? ""}`}`;
}

export type ProposalVerdict = {
  status: string;
  statusRaw: string;
  decisionDate: string | null;
  decisionTurnaroundDays: number | null;
};

export function proposalVerdict(p: {
  status: string; statusRaw?: string | null; decisionDate?: string | null;
  decisionTurnaroundDays?: number | null;
}): ProposalVerdict {
  return {
    status: p.status, statusRaw: p.statusRaw ?? p.status,
    decisionDate: p.decisionDate ?? null,
    decisionTurnaroundDays: p.decisionTurnaroundDays ?? null,
  };
}

/** New undecided applications can appear immediately; new verdicts wait. */
export function initialProposalVerdict(p: Parameters<typeof proposalVerdict>[0]): ProposalVerdict {
  return p.status === "pending" || p.status === "under_review"
    ? proposalVerdict(p)
    : proposalVerdict({ status: "pending", statusRaw: "Pending" });
}
