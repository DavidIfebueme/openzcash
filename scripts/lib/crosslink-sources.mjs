// Pure helpers for the Crosslink source checker. No network access here:
// fetching lives in scripts/check-crosslink-sources.mjs so these functions
// stay unit-testable and side-effect free.

export const FORUM_TOPIC = "https://forum.zcashcommunity.com/t/crosslink-incentivized-feature-net/55210";
export const REPO = "ShieldedLabs/crosslink_monolith";

// Curation metadata lives in the same module the guide renders from, so the
// check always reads what visitors actually see. Paths are relative to the
// repository root.
export const CURATION_SOURCES = [
  "src/app/ongoing-test/crosslink-guide.tsx",
  "src/app/ongoing-test/crosslink-history.ts",
  "src/app/ongoing-test/community-tools.ts",
];

// `sourcesChecked` and `releaseTag` are exported from crosslink-history.ts.
// The stamp is a human-readable day; the machine-readable UTC cutoff for the
// freshness window is derived from it, so the guide and the checker can never
// disagree about when sources were last verified.
export const FRESHNESS_DAYS = 14;

/**
 * Parse the guide's "2 Nov 2026" stamp into a UTC Date at 00:00 of that day.
 * Returns null for anything that does not match the exact expected format:
 * a wrong stamp must fail loudly, never be guessed into validity.
 */
export function parseStamp(stamp) {
  const match = /^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/.exec(String(stamp ?? "").trim());
  if (!match) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const day = Number(match[1]);
  const month = months[match[2]];
  if (day < 1 || day > 31 || month === undefined) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, day));
  // Reject e.g. "31 Feb 2026": the round-tripped day must equal the input.
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month) return null;
  return date;
}

/** Whole days between two UTC instants (positive when `to` is later). */
export function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/** Freshness verdict for the stamp, given the moment of the check. */
export function stampFreshness(stamp, now = new Date()) {
  const checkedAt = parseStamp(stamp);
  if (!checkedAt) return { ok: false, reason: `cannot parse sourcesChecked stamp: ${JSON.stringify(stamp)}`, days: null };
  const days = daysBetween(checkedAt, now);
  if (days < 0) return { ok: false, reason: `sourcesChecked stamp ${stamp} is in the future`, days };
  if (days > FRESHNESS_DAYS) return { ok: false, reason: `sources checked ${days} days ago (limit ${FRESHNESS_DAYS}); re-verify and refresh the stamp`, days };
  return { ok: true, reason: `sources checked ${days} day(s) ago (limit ${FRESHNESS_DAYS})`, days };
}

/** Drift verdict between the pinned release tag and upstream's latest. */
export function releaseDrift(pinned, latest) {
  const pinnedTag = String(pinned ?? "").trim();
  const latestTag = String(latest ?? "").trim();
  if (!/^v\d+/.test(pinnedTag)) return { ok: false, reason: `unexpected pinned release tag: ${JSON.stringify(pinned)}`, pinnedTag, latestTag };
  if (!/^v\d+/.test(latestTag)) return { ok: false, reason: `unexpected latest release tag from GitHub: ${JSON.stringify(latest)}`, pinnedTag, latestTag };
  if (pinnedTag !== latestTag) {
    return { ok: false, reason: `guide pins ${pinnedTag} but upstream latest is ${latestTag}; update releaseTag in crosslink-history.ts`, pinnedTag, latestTag };
  }
  return { ok: true, reason: `guide matches upstream latest release ${latestTag}`, pinnedTag, latestTag };
}

/**
 * Extract every http(s) URL from the curation source text, resolving the
 * `${forum}` template literal. Forum post references (FORUM/NNN) are expanded
 * so the scan verifies the exact posts the guide links to.
 */
export function extractUrls(sources, forumTopic, releaseTag) {
  // The tag has no default on purpose: the only authoritative value is the one
  // exported from crosslink-history.ts, and a second copy here would go stale.
  if (typeof releaseTag !== "string" || !releaseTag) throw new Error("extractUrls needs the releaseTag pinned in crosslink-history.ts");
  const urls = new Map(); // url -> [file:label]
  const push = (url, file, label) => {
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(`${file}:${label}`);
  };
  for (const { file, text } of sources) {
    // Resolve curation template literals: `${forum}` and `${releaseTag}`.
    // A `${releaseTag}` reference is expanded with the provided tag so the
    // scan verifies the exact release page the guide renders.
    const resolved = text
      .replaceAll("${forum}", forumTopic)
      .replaceAll("${FORUM}", forumTopic)
      .replaceAll("${releaseTag}", releaseTag)
      .replaceAll("${releaseNotes}", `https://github.com/${REPO}/releases/tag/${releaseTag}`);
    const seen = new Set();
    for (const match of resolved.matchAll(/https:\/\/[^\s"'`\\)>]+/g)) {
      let url = match[0].replace(/[.,;:]+$/, "");
      if (seen.has(url)) continue;
      seen.add(url);
      const index = match.index ?? 0;
      const line = text.slice(0, index).split("\n").length;
      push(url, file, `line ${line}`);
    }
  }
  return [...urls.entries()].map(([url, references]) => ({ url, references })).sort((a, b) => a.url.localeCompare(b.url));
}

/** Decode one plain JavaScript string literal; only quote and backslash escapes are accepted. */
function unquote(literal) {
  return literal.slice(1, -1).replace(/\\(.)/gs, (_, char) => {
    if (char === '"' || char === "'" || char === "\\") return char;
    throw new Error(`unsupported escape \\${char} in a referencedIssues title`);
  });
}

/**
 * Read the guide's `referencedIssues` list (one `{ id, title }` entry per
 * line) without importing application code. Anything that is not a plain
 * entry throws: a list the checker cannot read must never pass as empty.
 */
export function parseReferencedIssues(text) {
  const block = /^const referencedIssues = \[\n([\s\S]*?)^\];$/m.exec(String(text ?? ""))?.[1];
  if (block === undefined) throw new Error("crosslink-guide.tsx is missing the referencedIssues list");
  const issues = block.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = /^\{ id: (\d+), title: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*') \},?$/.exec(line);
    if (!match) throw new Error(`cannot parse referencedIssues entry: ${line}`);
    return { id: Number(match[1]), title: unquote(match[2]) };
  });
  if (!issues.length) throw new Error("referencedIssues is empty; remove the section or list an issue");
  return issues;
}

/** Drift verdict between a title the guide shows and the upstream issue's title. */
export function issueTitleDrift(issue, upstreamTitle) {
  const upstream = typeof upstreamTitle === "string" ? upstreamTitle.trim() : "";
  if (!upstream) return { ok: false, reason: `GitHub returned no title for issue #${issue.id}` };
  if (upstream !== issue.title) {
    return { ok: false, reason: `issue #${issue.id} is titled ${JSON.stringify(upstream)} upstream but the guide shows ${JSON.stringify(issue.title)}; update referencedIssues in crosslink-guide.tsx` };
  }
  return { ok: true, reason: `issue #${issue.id} title matches upstream` };
}

/** Classify a URL for reporting. Forum topic roots and post links differ. */
export function describeUrl(url, forumTopic = FORUM_TOPIC) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (url === forumTopic) return `${host} · topic root`;
  if (url.startsWith(`${forumTopic}/`)) return `${host} · post ${url.slice(forumTopic.length + 1)}`;
  return host;
}
