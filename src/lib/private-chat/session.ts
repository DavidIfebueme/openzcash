/** Local UI rehearsal only. This model does not publish presence or send messages. */
export const AVAILABILITY_TTL_MS = 5 * 60 * 1000;
export const ALIAS_MAX_LENGTH = 24;

export type PreviewSession = {
  alias: string | null;
  availableUntil: number | null;
};

export type SessionAction =
  | { type: "enter"; alias: string }
  | { type: "availability"; enabled: boolean; now: number }
  | { type: "expire"; now: number }
  | { type: "offline" }
  | { type: "leave" };

export const EMPTY_SESSION: PreviewSession = {
  alias: null,
  availableUntil: null,
};

export function normalizeAlias(value: string): string | null {
  const alias = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (
    Array.from(alias).length < 2 ||
    Array.from(alias).length > ALIAS_MAX_LENGTH
  )
    return null;
  // No invisible control characters, markup, links or bidi overrides in display names.
  return /^[\p{L}\p{M}\p{N} ._-]+$/u.test(alias) ? alias : null;
}

export function sessionReducer(
  state: PreviewSession,
  action: SessionAction,
): PreviewSession {
  switch (action.type) {
    case "enter": {
      const alias = normalizeAlias(action.alias);
      // Editing an alias also requires a fresh opt-in to discovery.
      return alias ? { alias, availableUntil: null } : state;
    }
    case "availability":
      return {
        ...state,
        availableUntil:
          action.enabled && state.alias && Number.isFinite(action.now)
            ? action.now + AVAILABILITY_TTL_MS
            : null,
      };
    case "expire":
      return state.availableUntil !== null && action.now >= state.availableUntil
        ? { ...state, availableUntil: null }
        : state;
    case "offline":
      return { ...state, availableUntil: null };
    case "leave":
      return { ...EMPTY_SESSION };
  }
}
