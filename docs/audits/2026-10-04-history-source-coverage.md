# Project-history source coverage audit — 4 October 2026

The WebZjs report exposed a projection problem: the project registry already contained source links and a correctly mapped repository, but the history page only surfaced dated releases, explicitly reviewed evidence, reports and financial events. Existing website, registry and repository references were not retained as a source directory. A repository without GitHub releases could therefore look empty despite having useful primary sources.

## Scope and reproducibility

This coverage audit uses the checked local registry, the repository snapshot collected at **2026-10-04T21:05:24.676Z**, reviewed evidence and curated community links. It does **not** connect to the financial database, import the ledger, reconcile settlement or certify grant delivery. Funding results require the separately supplied public mirror and its own reconciliation.

Run the existing read-only audit from the repository root:

```sh
npm run audit:ecosystem -- --output /private/tmp/history-source-final-audit.json
```

The output includes each identity's source directory, omitted safe registry URLs, repository mappings, latest dated work and evidence counts. Omitting a safe registry source is an audit failure. Missing dated work remains a reported research gap. Existing freshness, collection and identity controls still apply.

## Coverage before and after

| Measure | Before | After |
| --- | ---: | ---: |
| History identities | 153 | 153 |
| Identities with at least one directory source | Directory absent | 153 |
| Identities with existing registry references omitted from the visible history | 99 | 0 |
| Omitted registry reference rows | 173 | 0 |
| Histories with repository context exposed | No repository-context directory | 112 |
| Histories without dated work evidence | 97 | 96 |
| Histories without a public-work event | 83 | 82 |

The 99 affected histories already held the omitted URLs in the registry. The source projection now preserves all safe registry URLs and every curated community URL/topic. The final seven community gaps were records whose website was the internal `/communities` fallback or whose available sources were forum applications, announcements or discussions. These are now visible as references; the internal fallback is never presented as an external source.

The reduction from 97 to 96 histories without dated work comes from the seven reviewed WebZjs reports below. Exposing references does not improve a project's publication, acceptance or usage score. The remaining 96 histories require dated work extraction where appropriate; this is not evidence of inactivity or non-delivery.

## WebZjs source review

Seven maintainer reports were linked with their actual publication dates and retained as **team reported**, not independently accepted delivery:

| Publication date | Report | Source |
| --- | --- | --- |
| 2024-10-18 | Browser-library phase completion, with demonstration security limitations | [Maintainer post 24](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/24) |
| 2025-08-06 | MetaMask Snap availability and maintenance announcement | [Maintainer post 48](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/48) |
| 2025-09-04 | August maintenance report | [Maintainer post 49](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/49) |
| 2025-11-06 | October maintenance report, including ongoing work | [Maintainer post 51](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/51) |
| 2026-01-05 | Unresolved NU6.1 compatibility limitations | [Maintainer post 52](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/52) |
| 2026-02-13 | Reported NU6.1 update and transaction history | [Maintainer post 58](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/58) |
| 2026-04-13 | February–March wallet storage and reliability work | [Maintainer post 64](https://forum.zcashcommunity.com/t/zcash-browser-wallet-library/47897/64) |

Three requested-amount records were reviewed separately from approvals, ledger budgets and payments:

| Grant | Requested amount basis | Source |
| --- | --- | --- |
| WebZjs browser library | Revised ZCG request: USD 150,000; excludes the separate MetaMask contribution | [ZCG July 22, 2024 minutes](https://forum.zcashcommunity.com/t/zcash-community-grants-meeting-minutes-7-22-2024/48437/1) |
| Chainsafe Systems maintenance | Annual ceiling: USD 168,000, based on USD 350/hour and up to 40 hours/month | [Official application #2](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/2) |
| 2026 maintenance renewal | Requested annual ceiling: USD 168,000; does not imply approval | [Official application #272](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/272) |

The repository snapshot's April 16 push timestamp is shown only as repository context. It is not substituted for a release, report publication, milestone acceptance or proof of current network compatibility. The renewal's rejection remains separate from these historical requests and reports.

## Implementation and validation

Source projection and boundaries:

- `src/lib/project-history/types.ts`
- `src/lib/project-history/identities.ts`
- `src/lib/project-history/sources.ts`
- `src/lib/project-history/build.ts`
- `src/lib/project-history/sources.test.ts`
- `scripts/audit-ecosystem.ts`

Reviewed WebZjs records and requested-amount validation:

- `src/data/project-history/evidence.json`
- `src/data/project-history/requested-amounts.json`
- `src/lib/project-history/requested-amounts.ts`
- `src/lib/project-history/requested-amounts.test.ts`
- `src/lib/project-history/requested-amount-integration.test.ts`

Targeted source/build/insights tests passed (37 tests); community/identity coverage and source-label checks subsequently passed (13 tests, overlapping the earlier set). Tests cover safe-URL omission, canonical deduplication, preserved registry references and community links, observation versus event dates, withdrawn publications and bounded source-directory size with 1,000 timeline releases. Source projection lint and whitespace checks passed.

Integration validation: 2,687 application tests and six knowledge tests passed, with nine existing skips. The final source-label changes passed 109 focused history/UI/Zarvis tests; targeted ESLint and a fresh production build passed. Full lint had zero errors and four pre-existing warnings; typecheck passed.

Rendered preview checks covered WebZjs Overview, Funding, Sources navigation, the expandable request basis and all 22 source links. Desktop and 390 × 844 mobile were inspected; funding and source lists had no horizontal overflow. The served API retained all 17 payment rows, the rejected renewal and seven separately dated maintainer reports. This record does not claim publication or deployment.
