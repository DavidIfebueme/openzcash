# Ongoing Test maintenance: Crosslink

The Crosslink guide (`/ongoing-test/crosslink`) is a curated snapshot: every
number, date and link was verified against its original source on the day
recorded in the footer. Shielded Labs now ships weekly, only recognizes the
current release's chain for rewards, and ends support for each version two
weeks after it ships. The guide therefore needs a scheduled refresh, not
one-off fixes.

Budget: about 10 minutes per week (or per release, whichever comes first).

## What lives where

| Concern | Location |
| --- | --- |
| Pinned release, `sourcesChecked` stamp, payout rounds, timeline | `src/app/ongoing-test/crosslink-history.ts` |
| Community tools directory and per-tool caveats | `src/app/ongoing-test/community-tools.ts` |
| Guide copy, steps, participation paths, footer | `src/app/ongoing-test/crosslink-guide.tsx` |
| Checker script (release drift, freshness, link scan) | `scripts/check-crosslink-sources.mjs` |
| Pure helpers + unit tests | `scripts/lib/crosslink-sources.mjs`, `scripts/lib/crosslink-sources.test.mjs` |
| Automated weekly check | `.github/workflows/crosslink-freshness.yml` |
| Generated check reports | `docs/audits/YYYY-MM-DD-crosslink-sources.md` |

## Weekly procedure

1. Run `npm run check:crosslink` locally. It verifies three things:
   - **Release drift** — the `releaseTag` export in `crosslink-history.ts`
     matches `ShieldedLabs/crosslink_monolith`'s latest GitHub release.
   - **Freshness** — the `sourcesChecked` stamp is at most 14 days old.
   - **Link scan** — all 40+ rendered URLs still resolve. Rate-limit
     responses (429/403/503) from community CDNs are warnings, not failures.
2. If the release drifted (it will, weekly):
   - Read the new release notes at
     `https://github.com/ShieldedLabs/crosslink_monolith/releases`.
   - Update `releaseTag` and `releaseNotes` in `crosslink-history.ts` — the
     hero CTA and all release links derive from them.
   - Add a timeline entry to `history` for network-changing releases
     (upgrades, required updates, policy changes). Same-network patch
     releases with only crash fixes still deserve an entry when they change
     what testers must download.
   - Re-check the "Selected public issues" list in `crosslink-guide.tsx`
     against the issue tracker; note that listings record history, and a
     closed issue stays listed only while its title is still useful context.
3. Re-verify anything time-sensitive by hand: the pinned forum posts (topic
   55210), Round 3 status, and the community tools' network labels (ctaz.cash
   announces the network it currently indexes).
4. Update `sourcesChecked` to the verification date, then regenerate the
   Zarvis index so chat answers stay in sync:
   `npm run knowledge:build && npm run test:knowledge`.
5. Optionally file the evidence: `npm run check:crosslink:report` writes
   `docs/audits/<today>-crosslink-sources.md` with the full link table.
6. Land the changes on a `vinib/` or `Michae2xl/` branch; CI runs the full
   gate, and the freshness workflow keeps watch until the next cycle.

## Cadence and escalation

- The GitHub workflow runs every Monday 04:23 UTC and on demand. It is
  intentionally **not** a required check yet: community sites rate-limit, and
  a flaky external host must never block an unrelated merge.
- When the check fails, the failure output names the exact file and line for
  each drifted link — treat it as a work queue, not a build break.
- If the weekly cadence proves quiet for a month, promote the release-drift
  job to a required status check (it only reads the GitHub API and is
  deterministic).

## Editorial rules carried over from the original build

- Payout numbers come only from Shielded Labs payment reports (forum posts);
  never from community tallies.
- Listing a community tool records the contribution, not an endorsement or a
  live-availability guarantee. Keep the per-tool caveats honest.
- Curated GitHub issues keep their original titles; the list implies no
  assignment or funding.
