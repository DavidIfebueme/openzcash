import { test } from "node:test";
import assert from "node:assert/strict";
import { FORUM_TOPIC, daysBetween, describeUrl, extractUrls, issueTitleDrift, parseReferencedIssues, parseStamp, releaseDrift, stampFreshness } from "./crosslink-sources.mjs";

test("parseStamp accepts only real dates in the guide's exact format", () => {
  const date = parseStamp("2 Nov 2026");
  assert.equal(date?.toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(parseStamp("17 Oct 2026")?.getUTCDate(), 17);
  // Malformed or absent stamps must fail, never be guessed into validity.
  assert.equal(parseStamp("Nov 2 2026"), null);
  assert.equal(parseStamp("2 November 2026"), null);
  assert.equal(parseStamp("31 Feb 2026"), null); // rejected by the day round-trip
  assert.equal(parseStamp(""), null);
  assert.equal(parseStamp(undefined), null);
});

test("stampFreshness flags stale and future stamps", () => {
  const now = new Date("2026-11-02T12:00:00.000Z");
  assert.equal(stampFreshness("2 Nov 2026", now).ok, true);
  assert.equal(stampFreshness("28 Oct 2026", now).ok, true); // exactly the 14-day limit
  assert.equal(stampFreshness("18 Oct 2026", now).ok, false); // one day past the limit
  assert.match(stampFreshness("18 Oct 2026", now).reason, /re-verify/);
  assert.equal(stampFreshness("3 Nov 2026", now).ok, false); // future stamp
  assert.equal(stampFreshness("not a stamp", now).ok, false);
  assert.equal(daysBetween(new Date("2026-10-19T00:00:00Z"), new Date("2026-11-02T00:00:00Z")), 14);
});

test("releaseDrift compares the pinned tag against upstream's latest", () => {
  assert.equal(releaseDrift("v16", "v16").ok, true);
  const drift = releaseDrift("v15", "v16");
  assert.equal(drift.ok, false);
  assert.match(drift.reason, /update releaseTag/);
  // Malformed inputs are failures, not matches.
  assert.equal(releaseDrift("", "v16").ok, false);
  assert.equal(releaseDrift("v16", null).ok, false);
  assert.equal(releaseDrift("w16", "v16").ok, false);
});

test("extractUrls resolves forum template literals and reports file:line provenance", () => {
  const sources = [
    {
      file: "crosslink-history.ts",
      text: 'const forum = "https://forum.zcashcommunity.com/t/crosslink-incentivized-feature-net/55210";\nexport const history = [{ source: `${forum}/49` }, { source: "https://github.com/ShieldedLabs/crosslink_monolith/releases/tag/v16" }];',
    },
    {
      file: "community-tools.ts",
      text: 'export const tools = [{ href: "https://ctaz.cash/", source: `${forum}/117` }];',
    },
  ];
  const urls = extractUrls(sources, FORUM_TOPIC, "v99");
  const byUrl = new Map(urls.map((item) => [item.url, item.references]));
  assert.deepEqual([...byUrl.keys()].sort(), [
    "https://ctaz.cash/",
    FORUM_TOPIC,
    `${FORUM_TOPIC}/117`,
    `${FORUM_TOPIC}/49`,
    "https://github.com/ShieldedLabs/crosslink_monolith/releases/tag/v16",
  ]);
  assert.ok(byUrl.get(`${FORUM_TOPIC}/49`).some((ref) => ref.startsWith("crosslink-history.ts:line")));
  // The same URL in two files keeps both provenance references.
  assert.equal(byUrl.get(`${FORUM_TOPIC}/117`).length, 1);
});

test("extractUrls deduplicates repeats within one file and strips trailing punctuation", () => {
  const urls = extractUrls([{ file: "guide.tsx", text: 'const a = "https://example.com/a", b = "https://example.com/a.";' }], FORUM_TOPIC, "v99");
  assert.deepEqual(urls.map((item) => item.url), ["https://example.com/a"]);
  assert.deepEqual(extractUrls([{ file: "empty.ts", text: "no links here" }], FORUM_TOPIC, "v99"), []);
});

test("extractUrls expands the release templates with the tag it is given, and refuses to guess one", () => {
  const sources = [{ file: "crosslink-history.ts", text: "const notes = `${releaseNotes}`;\nconst zip = `https://example.com/download/${releaseTag}.zip`;" }];
  assert.deepEqual(extractUrls(sources, FORUM_TOPIC, "v99").map((item) => item.url), [
    "https://example.com/download/v99.zip",
    "https://github.com/ShieldedLabs/crosslink_monolith/releases/tag/v99",
  ]);
  // No default: a caller that forgets the tag must fail, not scan a stale release page.
  assert.throws(() => extractUrls(sources), /releaseTag/);
  assert.throws(() => extractUrls(sources, FORUM_TOPIC, ""), /releaseTag/);
});

test("parseReferencedIssues reads ids and exact titles, including escaped quotes", () => {
  const guide = [
    "// A curated index.",
    "const referencedIssues = [",
    '  { id: 255, title: "Crash After Clicking Edit Stake Button Due to Out-of-Bounds" },',
    "  { id: 219, title: '\\\"You are on an old version; please upgrade\\\"' },",
    "];",
    "const after = [];",
  ].join("\n");
  assert.deepEqual(parseReferencedIssues(guide), [
    { id: 255, title: "Crash After Clicking Edit Stake Button Due to Out-of-Bounds" },
    { id: 219, title: '"You are on an old version; please upgrade"' },
  ]);
  // A list the checker cannot read must fail loudly, never pass as "nothing to check".
  assert.throws(() => parseReferencedIssues("no list here"), /referencedIssues/);
  assert.throws(() => parseReferencedIssues("const referencedIssues = [\n];"), /referencedIssues/);
  assert.throws(() => parseReferencedIssues("const referencedIssues = [\n  { id: 1, title: `templated` },\n];"), /cannot parse/);
  assert.throws(() => parseReferencedIssues('const referencedIssues = [\n  { id: 1, title: "line\\nbreak" },\n];'), /unsupported escape/);
});

test("issueTitleDrift compares a listed title against the upstream one", () => {
  const issue = { id: 231, title: "Reliable height/sync status" };
  assert.equal(issueTitleDrift(issue, "Reliable height/sync status").ok, true);
  assert.equal(issueTitleDrift(issue, " Reliable height/sync status ").ok, true); // surrounding space is not drift
  const drift = issueTitleDrift(issue, "Reliable height and sync status");
  assert.equal(drift.ok, false);
  assert.match(drift.reason, /#231/);
  assert.match(drift.reason, /update referencedIssues/);
  // A missing upstream title is a failure, not a match.
  assert.equal(issueTitleDrift(issue, "").ok, false);
  assert.equal(issueTitleDrift(issue, undefined).ok, false);
});

test("describeUrl names the host and forum post number", () => {
  assert.equal(describeUrl(FORUM_TOPIC), "forum.zcashcommunity.com · topic root");
  assert.equal(describeUrl(`${FORUM_TOPIC}/117`), "forum.zcashcommunity.com · post 117");
  assert.equal(describeUrl("https://ctaz.cash/"), "ctaz.cash");
});
