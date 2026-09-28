# Official ZIP catalog: local evaluation

Date: September 28, 2026 UTC. Local preview only; this record does not establish production deployment.

## Source coverage

- Official repository: https://github.com/zcash/zips
- Revision: `afa086bd976e316612a5c06fb139429958d07d84`
- Retrieved: `2026-09-28T00:50:52.801Z`
- 127 numbered ZIP source files and 7 unnumbered draft source files; 2,482,408 characters of complete source text.
- Includes Reserved, Withdrawn and Obsolete documents, retaining multi-revision statuses. Reserved entries may contain headers only. Templates, images, PR-only proposals, Git history and the full protocol PDF are not included.
- Created/Last-Updated are document headers; neither proves first publication or current chain activation. The rendered site can lag the repository, so pinned source URLs remain available.

## Real provider results

Same local preview, Grok 4.7. Synthetic public questions, no private conversation data or API credentials. Hosted-search counts and token usage are from provider-reported development metrics.

| Case | Seconds | Model requests | Hosted searches | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original broad newest-ZIP query before catalog | 54.09 | 1 | 22 | 260,347 | 3,681 |
| Plain latest ZIP, internal deterministic answer | 0.14 | 0 | 0 | 0 | 0 |
| Identical broad newest-ZIP query with catalog | 7.03 | 1 | 0 | 5,937 | 468 |
| ZIP 32 hardened derivation | 4.33 | 1 | 0 | 5,984 | 196 |
| Follow-up: non-hardened derivation | 16.35 | 3 | 0 | 26,369 | 902 |

The original query had also timed out at the 55-second application deadline in earlier runs. The deadline and model have not been increased. These are observations from a small evaluation, not latency guarantees or a claim of zero model cost. The technical follow-up used three model requests and three extra local lookups; zero hosted search does not mean zero tokens. Answers and case timings are preserved in `zarvis-zip-live-results.json`.

Review found that pool-specific derivation passages benefit from explicit section ancestry. The final retrieval format keeps those headings with each ZIP excerpt; a focused regression verifies Orchard context. Freshness and missing-ID behavior are tested independently of model phrasing.

## Verification

- Full corpus hash/header validation and every numbered ZIP retrievable by its number within the 5,000-character document budget.
- Incremental fixed-host fetches, unchanged revisions, truncated catalogs, corrupt blobs, excessive changes, deadline cancellation, shared refreshes and stale fallback.
- Local-first metadata, conversation continuation, missing ZIP fallback and internal tool calls without hosted search.
- Final verification: 781 Vitest checks and 3 index checks passed; 9 opt-in database checks were skipped. Scoped ESLint, TypeScript and the optimized production build passed. The existing Next.js middleware deprecation warning remains unrelated to this change.
- The browser preview also answered a Sapling/Orchard comparison using internal lookups only (three model requests, zero hosted searches, 22,819 reported input tokens and 731 output tokens). This illustrates that technical synthesis still incurs model usage.

## Operational limits

Six-hour on-demand freshness per process, eight-second refresh deadline, at most 12 changed files during chat, no automatic AI retry. Source failure keeps the last complete corpus and marks it stale. Large upstream changes require `npm run knowledge:sync:zips`; source content is data and cannot grant tools or permissions. Explanations use the external model; hosted research remains available when evidence is insufficient. Production promotion remains a separate release step.
