/**
 * The views of the governance page. The menu swaps the view in place and
 * keeps it in the address (`?view=`), so a view can be shared and the reader
 * is never scrolled.
 */
export const VIEWS = [
  { id: "how", label: "How it works" },
  { id: "now", label: "Being decided now" },
  { id: "polls", label: "Polls" },
  { id: "upgrades", label: "Network upgrades" },
  { id: "who", label: "Who does what" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

export const DEFAULT_VIEW: ViewId = "how";

/**
 * Parameters the poll comparison writes when a reader shares a question
 * (src/components/governance/poll-comparison.tsx). Keep the two in step: a
 * parameter added there and missing here would open such a link on the
 * default view.
 */
const POLL_PARAMETERS = ["round", "question", "basis"] as const;

interface QueryReader {
  get(name: string): string | null;
  has(name: string): boolean;
  toString(): string;
}

export function isViewId(value: string | null | undefined): value is ViewId {
  return VIEWS.some((view) => view.id === value);
}

/**
 * The view an address asks for. Links to a poll comparison question, shared
 * before the page had views, carry no `view` and still open on the polls.
 */
export function resolveView(params: QueryReader): ViewId {
  const named = params.get("view");
  if (isViewId(named)) return named;
  if (POLL_PARAMETERS.some((name) => params.has(name))) return "polls";
  return DEFAULT_VIEW;
}

/** The query string for a view, keeping every other parameter. */
export function viewQuery(params: QueryReader, view: ViewId): string {
  const next = new URLSearchParams(params.toString());
  next.set("view", view);
  return `?${next.toString()}`;
}
