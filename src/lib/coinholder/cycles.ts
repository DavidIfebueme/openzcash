/** Announced cycles are configured explicitly; dates never imply a published vote or result. */
export const READY_FOR_VOTE_LABEL = "Ready For Vote - All Steps Completed";
export const COINHOLDER_REPOSITORY = "Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram";

export const ACTIVE_CYCLE = {
  id: "q4-2026",
  label: "Q4 2026",
  href: "/coinholders/proposals",
  source: "https://forum.zcashcommunity.com/t/q4-coinholder-directed-retroactive-grant-program-call-for-proposals/58598",
  submissionsOpen: "2026-10-30T00:00:00Z",
  submissionsClose: "2026-11-13T20:00:00Z",
  reviewOpen: "2026-11-16T00:00:00Z",
  reviewClose: "2026-12-16T20:00:00Z",
  voteOpen: "2026-12-17T00:00:00Z",
  voteClose: "2026-12-29T20:00:00Z",
  // No round label exists on GitHub yet. Bound intake to the announced call and quarter.
  intakeEnds: "2027-01-01T00:00:00Z",
  issuesUrl: `https://github.com/${COINHOLDER_REPOSITORY}/issues?q=${encodeURIComponent(`is:issue is:open label:"${READY_FOR_VOTE_LABEL}" created:2026-10-30..2026-12-31`)}`,
  applyUrl: `https://github.com/${COINHOLDER_REPOSITORY}/issues/new/choose`,
} as const;

export type AnnouncedCycle = { [K in keyof typeof ACTIVE_CYCLE]: string };

export function cycleWindows(cycle: AnnouncedCycle = ACTIVE_CYCLE) {
  return [
    { label: "Submissions", start: cycle.submissionsOpen, end: cycle.submissionsClose },
    { label: "Review", start: cycle.reviewOpen, end: cycle.reviewClose },
    { label: "Voting", start: cycle.voteOpen, end: cycle.voteClose },
  ];
}

export function cycleDateRange(start: string, end: string) {
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${date.format(new Date(start))} – ${date.format(new Date(end))}`;
}

export function cycleDeadline(cycle: AnnouncedCycle = ACTIVE_CYCLE) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(cycle.submissionsClose)) + " UTC";
}

export function cyclePhase(cycle: AnnouncedCycle = ACTIVE_CYCLE, now = Date.now()): { label: string; step: number; beforeVoting: boolean } {
  const phase = (label: string, step: number) => ({ label, step, beforeVoting: now < Date.parse(cycle.voteOpen) });
  if (now < Date.parse(cycle.submissionsOpen)) return phase("Upcoming round", -1);
  if (now <= Date.parse(cycle.submissionsClose)) return phase("Accepting proposals", 0);
  if (now < Date.parse(cycle.reviewOpen)) return phase("Submissions closed", -1);
  if (now <= Date.parse(cycle.reviewClose)) return phase("Community review", 1);
  if (now < Date.parse(cycle.voteOpen)) {
    const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(cycle.voteOpen));
    return phase(`Voting starts ${date}`, -1);
  }
  if (now <= Date.parse(cycle.voteClose)) return phase("Scheduled voting period", 2);
  return phase("Awaiting published results", -1);
}

/** Historical links always carry an id, so a new default cycle cannot change their meaning. */
export function cycleHref(view: "results" | "activity" | "verify", id: string = ACTIVE_CYCLE.id) {
  return `/coinholders/${view}?round=${encodeURIComponent(id)}`;
}

export function roundParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
}
