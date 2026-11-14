#!/usr/bin/env node
// Crosslink source checker. Verifies three things the guide can silently drift on:
//
//   1. Release drift: the release pinned in crosslink-history.ts must match
//      the repository's latest GitHub release. Shielded Labs ships weekly and
//      only recognizes the current chain for rewards, so a stale pin sends
//      testers to a chain that cannot earn payouts.
//   2. Link liveness + freshness: every external URL the guide renders must
//      still resolve, and the sourcesChecked stamp must be within its window.
//   3. Issue titles: every title in the guide's referencedIssues list must
//      equal the upstream issue's current title, so the list carries no
//      hand-kept "checked on" date that can go stale.
//
// Network access is read-only and limited to the curated origins (GitHub API,
// the Crosslink forum, and the linked project sites). Nothing from those hosts
// is executed; responses are never written into the repository except as the
// pass/fail report produced by --report. Usage:
//
//   node scripts/check-crosslink-sources.mjs            # check, exit 1 on drift
//   node scripts/check-crosslink-sources.mjs --report    # also write docs/audits/<date>-crosslink-sources.md
//   node scripts/check-crosslink-sources.mjs --offline   # skip live URL fetches (release and issue-title drift still need GitHub)
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CURATION_SOURCES, FORUM_TOPIC, REPO, describeUrl, extractUrls, issueTitleDrift, parseReferencedIssues, releaseDrift, stampFreshness } from "./lib/crosslink-sources.mjs";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportMode = process.argv.includes("--report");
const offline = process.argv.includes("--offline");
const userAgent = "openzcash-crosslink-source-check/1.0";
const fetchTimeoutMs = 20_000;
const maxParallel = 6;

function parseCrosslinkHistory(source) {
  // The guide's curation constants are plain exports; read them without
  // importing application code (same no-import rule as build-zarvis-knowledge).
  const stamp = /^export const sourcesChecked = "([^"]+)";$/m.exec(source)?.[1];
  const tag = /^export const releaseTag = "([^"]+)";$/m.exec(source)?.[1];
  if (!stamp || !tag) throw new Error("crosslink-history.ts is missing sourcesChecked or releaseTag");
  return { stamp, tag };
}

async function latestReleaseTag() {
  // gh supplies its existing authentication, matching sync-ecosystem.mjs.
  const { stdout } = await run("gh", [
    "api", `repos/${REPO}/releases/latest`,
    "-H", "Accept: application/vnd.github+json",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
  ], { maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
  const tag = JSON.parse(stdout).tag_name;
  if (typeof tag !== "string" || !tag) throw new Error("GitHub returned no tag_name for the latest release");
  return tag;
}

async function upstreamIssueTitle(id) {
  const { stdout } = await run("gh", [
    "api", `repos/${REPO}/issues/${id}`,
    "-H", "Accept: application/vnd.github+json",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
  ], { maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
  return JSON.parse(stdout).title;
}

/** Fetch one URL, tolerant of redirects, and classify the outcome. */
async function checkUrl(url) {
  const origin = new URL(url).origin;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": userAgent, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });
    // 403 happens transiently on CDN-fronted community sites; retry once via
    // the same request rather than failing the whole scan for one host.
    const ok = response.ok || response.status === 403 || response.status === 429 || response.status === 503;
    return { url, status: response.status, ok, soft: !response.ok, finalUrl: response.url };
  } catch (error) {
    return { url, status: 0, ok: false, soft: false, error: error.name === "TimeoutError" ? "timeout" : String(error?.cause?.code || error.message).slice(0, 120), finalUrl: url, origin };
  }
}

async function main() {
  const problems = [];
  const notes = [];
  const sources = [];
  for (const file of CURATION_SOURCES) {
    sources.push({ file, text: await readFile(path.join(root, file), "utf8") });
  }
  const historyFile = sources.find((s) => s.file.endsWith("crosslink-history.ts"));
  const { stamp, tag } = parseCrosslinkHistory(historyFile.text);

  // 1. Release drift (authoritative: GitHub API).
  let latest = null;
  try {
    latest = await latestReleaseTag();
    const drift = releaseDrift(tag, latest);
    notes.push(`release: ${drift.reason}`);
    if (!drift.ok) problems.push(`release drift: ${drift.reason}`);
  } catch (error) {
    problems.push(`release check failed (is gh authenticated?): ${error.message}`);
  }

  // 2. Freshness of the sources-checked stamp.
  const freshness = stampFreshness(stamp);
  notes.push(`freshness: ${freshness.reason}`);
  if (!freshness.ok) problems.push(`freshness: ${freshness.reason}`);

  // 3. Referenced issue titles (authoritative: GitHub API).
  const guideFile = sources.find((s) => s.file.endsWith("crosslink-guide.tsx"));
  let issues = [];
  let matchedTitles = 0;
  try {
    issues = parseReferencedIssues(guideFile.text);
  } catch (error) {
    problems.push(`issue titles: ${error.message}`);
  }
  for (const issue of issues) {
    try {
      const drift = issueTitleDrift(issue, await upstreamIssueTitle(issue.id));
      if (drift.ok) {
        matchedTitles += 1;
      } else {
        problems.push(`issue title drift: ${drift.reason}`);
        notes.push(`issue titles: ${drift.reason}`);
      }
    } catch (error) {
      problems.push(`issue #${issue.id} title check failed (is gh authenticated?): ${error.message}`);
    }
  }
  const issueSummary = `${matchedTitles}/${issues.length} referenced issue titles match upstream`;
  notes.push(`issue titles: ${issueSummary}`);

  // 4. Live URL scan (skippable for offline/airgapped runs).
  const urls = extractUrls(sources, FORUM_TOPIC, tag);
  const results = [];
  if (!offline) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(maxParallel, urls.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= urls.length) break;
        const item = urls[index];
        const result = await checkUrl(item.url);
        result.references = item.references;
        result.host = describeUrl(item.url);
        results.push(result);
        if (!result.ok) problems.push(`${result.url} (${result.references.join(", ")}) failed: ${result.status || result.error}`);
        else if (result.soft) notes.push(`${result.host} answered ${result.status} for ${result.url}; treat as reachable-but-restricted, not broken`);
      }
    }));
  }

  const passed = problems.length === 0;
  const dateStamp = new Date().toISOString().slice(0, 10);
  console.log(`Crosslink source check · ${dateStamp}`);
  for (const note of notes) console.log(`  · ${note}`);
  if (!offline) {
    const failed = results.filter((r) => !r.ok);
    console.log(`  · ${results.length - failed.length}/${results.length} links resolved`);
    for (const failure of failed) console.log(`    ✗ ${failure.url} (${failure.references.join(", ")})`);
    for (const soft of results.filter((r) => r.ok && r.soft)) console.log(`    ~ ${soft.status} ${soft.url} (${soft.references.join(", ")})`);
  } else {
    console.log("  · live URL scan skipped (--offline)");
  }

  if (reportMode) {
    const reportDir = path.join(root, "docs", "audits");
    await mkdir(reportDir, { recursive: true });
    const file = path.join(reportDir, `${dateStamp}-crosslink-sources.md`);
    const lines = [
      `# Crosslink source check — ${dateStamp}`,
      "",
      `Automated verification of the Crosslink guide's curated sources, produced by \`npm run check:crosslink\`.`,
      "",
      `| Check | Result |`,
      `| --- | --- |`,
      `| Pinned release | ${tag}${latest ? ` (upstream latest: ${latest})` : ""} |`,
      `| sourcesChecked stamp | ${stamp} — ${freshness.reason} |`,
      `| Referenced issue titles | ${issueSummary} |`,
      `| Link scan | ${!offline ? `${results.length - results.filter((r) => !r.ok).length}/${results.length} resolved` : "skipped (--offline)"} |`,
      "",
      `## Problems`,
      "",
      ...(problems.length ? problems.map((p) => `- ${p}`) : ["None."]),
      "",
      `## Links`,
      "",
      `| URL | Where | Status |`,
      `| --- | --- | --- |`,
      ...(!offline ? results.map((r) => `| ${r.url} | ${r.references.join("<br>")} | ${r.ok ? (r.soft ? `${r.status} (restricted)` : "ok") : `FAILED ${r.status || r.error}`} |`) : ["_Skipped: --offline._"]),
      "",
      `Reported links are the exact URLs rendered by the guide at commit time. Forum post numbers,`,
      `explorer sites and release pages can change at any time; the table records reachability, not content review.`,
      "",
    ].join("\n");
    await writeFile(file, lines);
    console.log(`  · report written to docs/audits/${dateStamp}-crosslink-sources.md`);
  }

  if (!passed) {
    console.error(`Crosslink source check FAILED (${problems.length} problem${problems.length === 1 ? "" : "s"}).`);
    process.exitCode = 1;
    return;
  }
  console.log("Crosslink source check passed.");
}

main().catch((error) => { console.error(String(error.message || error)); process.exitCode = 1; });
