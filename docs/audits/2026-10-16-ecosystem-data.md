# Ecosystem data refresh — 16 October 2026

The public repository snapshot was fully recollected at
`2026-10-16T03:25:54.526Z`. The registry baseline remains 8 September 2026;
this collection does not rereview project descriptions or funding associations.

- 582 canonical public repositories, across 14 recorded owners; no collection failures.
- 12,952 currently listed published release records and 19 previously observed
  records retained separately as unlisted.
- Four newly discovered repositories: `btcpay-zcash/zkool-graphql-client`,
  `free2z/openmls`, `zingolabs/orasust`, and `zodl-inc/actions`.
- `zingolabs/zingolib-ffi` is no longer publicly available (GitHub returned 404).
- 23 existing repositories have a changed GitHub latest-release marker.
- Snapshot SHA-256: `67b9d53aded62ab9c911ca9e5c7afb4c4cd7b2d6f85cd3d671c1700ba18b13cf`.

The ecosystem audit passed with zero issues: all 153 history identities have
sources, 112 have repository history, and 41 have no GitHub association. No
finance export was supplied; payment and milestone completion were not assessed.

Validation: 17 collector tests, 3,913 Vitest tests and 56 Node tests passed;
12 database tests were skipped. Build and typecheck passed. Lint reported four
existing warnings and no errors. The served local overview shows 16 October
2026, the latest release records, and no stale-source warning.

This snapshot remedies the stale public data. Daily server collection is tracked
as the follow-up implementation; this data-only change does not add scheduling.
