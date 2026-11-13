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

/** `step` is the window that is open now (-1 between windows); `passed` counts the windows whose announced end is behind us. */
export type CyclePhase = { label: string; step: number; passed: number; beforeVoting: boolean };

export function cyclePhase(cycle: AnnouncedCycle = ACTIVE_CYCLE, now = Date.now()): CyclePhase {
  const passed = cycleWindows(cycle).filter((w) => now > Date.parse(w.end)).length;
  const phase = (label: string, step: number) => ({ label, step, passed, beforeVoting: now < Date.parse(cycle.voteOpen) });
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

function cycleDay(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

/** One sentence on where the round stands. Between windows it names the one that closed and the next to open; after the vote it infers nothing. */
export function cycleNote(cycle: AnnouncedCycle = ACTIVE_CYCLE, now = Date.now()) {
  const { step, passed } = cyclePhase(cycle, now);
  if (step === 0) return "Submissions are open for the next coinholder vote.";
  if (step === 1) return "Community review is underway before the vote.";
  if (step === 2) return "The scheduled voting window is here. Follow FPF for voting instructions.";
  if (passed === 1) return `Submissions are closed. Community review opens ${cycleDay(cycle.reviewOpen)}.`;
  if (passed === 2) return `Community review is closed. Voting is scheduled to open ${cycleDay(cycle.voteOpen)}.`;
  return "Follow the announced schedule and published updates for this round.";
}

/** Historical links always carry an id, so a new default cycle cannot change their meaning. */
export function cycleHref(view: "results" | "activity" | "verify", id: string = ACTIVE_CYCLE.id) {
  return `/coinholders/${view}?round=${encodeURIComponent(id)}`;
}

export function roundParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
}
