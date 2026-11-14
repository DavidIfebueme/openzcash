/**
 * Explicit direction controls. A donor can place them in a memo to make it
 * read differently from what it says, so the page shows memos without them.
 * Right-to-left letters are untouched: they need no control to display.
 */
const DIRECTION_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g;

/** Donor-supplied memo text as the page shows it. */
export function displayMemo(memo: string): string {
  return memo.replace(DIRECTION_CONTROLS, "");
}

/** One line for a transaction's memos, cut on whole characters. */
export function memoPreview(memos: readonly string[], limit = 90): string {
  const characters = Array.from(
    memos.map(displayMemo).join(" · ").replace(/\s+/g, " "),
  );
  return characters.length > limit
    ? `${characters.slice(0, limit).join("")}…`
    : characters.join("");
}
