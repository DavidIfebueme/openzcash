/**
 * Pure parsing helpers for ZCG grant-application issue bodies. Kept free of
 * "server-only" so the logic can be unit-tested directly.
 */

/** A whole trimmed line that is nothing but a dollar amount. Applicants write
 * "$477,658", "24,500", "US$64,430" (issue #355) or "64,430 USD". */
const AMOUNT_LINE = /^(?:US)?\$?\s?\d[\d,]*(\.\d+)?(?:\s?USD)?$/i;

/** A markdown section header at any of the levels applications use. The issue
 * form renders "###", but hand-written re-applications use "##" (e.g. #341). */
const HEADER = /^#{2,4}\s+/;

/** First pure-amount line inside the "<header>" section of an issue body. */
function sectionAmount(body: string, header: string): number | null {
  const lines = body.split(/\r?\n/);
  const target = header.toLowerCase();
  const i = lines.findIndex((l) => {
    const t = l.trim();
    return (
      HEADER.test(t) && t.replace(HEADER, "").trim().toLowerCase() === target
    );
  });
  if (i < 0) return null;
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (HEADER.test(t)) break; // section ended, no amount
    if (AMOUNT_LINE.test(t)) {
      const n = Number(t.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
  }
  return null;
}

/**
 * The requested grant amount from an application's issue body, in whole USD.
 * Applicants sometimes leave the "Requested Grant Amount (USD)" field blank or
 * fill it with prose, so fall back to the "Total Budget (USD)" field (the same
 * figure in well-formed applications).
 */
export function requestedAmountFromBody(
  body: string | undefined,
): number | null {
  if (!body) return null;
  return (
    sectionAmount(body, "Requested Grant Amount (USD)") ??
    sectionAmount(body, "Total Budget (USD)")
  );
}

/** A short, plain-text excerpt of the applicant's own project summary. */
export function projectSummaryFromBody(
  body: string | null | undefined,
): string | null {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const heading = /^#{1,6}\s+/;
  for (const section of ["project summary", "project description"]) {
    const start = lines.findIndex((line) =>
      heading.test(line.trim()) &&
      line.trim().replace(heading, "").replace(/\s*#+\s*$/, "").trim().toLowerCase() === section,
    );
    if (start < 0) continue;
    const end = lines.findIndex((line, index) => index > start && heading.test(line.trim()));
    const text = lines.slice(start + 1, end < 0 ? undefined : end).join("\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/^\s*(?:[-*+]\s+|\d+\.\s+|>\s*)/gm, "")
      .replace(/[*`~]/g, "")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?]|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || /^(?:no response|n\/a|none)\.?$/i.test(text)) continue;
    if (text.length <= 480) return text;
    const excerpt = text.slice(0, 479);
    const boundary = excerpt.lastIndexOf(" ");
    return `${excerpt.slice(0, boundary > 0 ? boundary : undefined).trimEnd()}…`;
  }
  return null;
}
