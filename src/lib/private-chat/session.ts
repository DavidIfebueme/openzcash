/** Alias rules shared by the controller and the interface. */
export const ALIAS_MAX_LENGTH = 24;

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
