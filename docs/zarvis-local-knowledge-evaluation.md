# Zarvis local knowledge evaluation — September 27, 2026

## Scope and environment

Local Next.js preview at `http://127.0.0.1:3100/zarvis`, existing local PostgreSQL mirror (1,016 public disbursement rows), OpenAI `gpt-6-astra`, low reasoning, 3,000 output tokens per model call. The explicitly authorized development-only unlimited-question mode was active. No production variables, data or deployment were changed.

The local index contains 109 chunks from 54 explicitly allowed public source files, plus reviewed reference notes and public navigation. Queries select up to four documents / 5,000 characters. This is static documentation retrieval plus public data readers, not exhaustive external knowledge or full PDF ingestion.

## Real endpoint checks

All cases used the normal local `/api/zarvis` request validation and streaming endpoint. Token/call figures came from opt-in server diagnostics containing only counts and model identity. Latency is one observed request, not a percentile or service guarantee. Input totals include repeated input across model rounds; cached tokens are a subset of input. Output includes provider-reported output usage. Figures are not invoice calculations.

| Case | Seconds | Model calls | Input tokens | Cached input | Output tokens | Hosted search items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current ZEC/USD quote | 0.17 | 0 | 0 | 0 | 0 | 0 |
| ZCG paid grant budget values in 2024 | 0.05 | 0 | 0 | 0 | 0 | 0 |
| Follow-up “e em 2025?” | 0.01 | 0 | 0 | 0 | 0 | 0 |
| Incoming viewing key: visibility, sender and spending | 5.17 | 1 | 2,452 | 0 | 155 | 0 |
| Zingo 2025 grant aggregate, after narrowing automatic retrieval | 8.15 | 2 | 5,000 | 2,357 | 213 | 0 |
| Latest ZIP / numbering versus activation | 16.50 | 1 | 26,005 | 0 | 512 | 3 |
| ZIP 259 official document, research enabled on demand | 10.67 | 2 | 13,358 | 0 | 278 | 1 |
| “sim” accepting an explanation offer | 4.80 | 1 | 2,667 | 0 | 189 | 0 |

The quote and annual summaries were computed locally, not model outputs. Their zero model-token counts do not mean hosting or upstream data infrastructure is free. A further quote was submitted in the browser and rendered successfully with the source drawer, animated mascot and existing dark theme. The revised provider/privacy text was verified in the expanded disclosure.

The project aggregate initially prefetched ecosystem and general grant excerpts: 7,992 input tokens, two calls, 7.32 s. After removing those irrelevant excerpts for payment-total questions, the same question used 5,000 input tokens (about 37% fewer), still two calls, 8.15 s. This demonstrates reduced input for that case, not lower latency or a universal saving. Search-heavy questions can still be expensive; the latest-ZIP answer returned three hosted search items despite the requested limit of two.

## Answer correctness checks

- Price included USD units, the provider quote time and a clickable local feed. The recorded test price was $1,609.41 per ZEC at 19:10 UTC; this is a historical test observation, not a current quote promise.
- A separate read of all 1,016 local rows, filtered and summed independently from the new SQL aggregate, matched all three tested totals:
  - 2024 ZCG grants: 108 paid entries; historical budget value $3,396,155.67.
  - 2025 ZCG grants: 156 paid entries; historical budget value $3,858,126.64.
  - Zingo in 2025: 13 paid entries; historical budget value $348,217.21 and recorded 9,235.26 ZEC.
- These totals exclude coinholder grants and operational worksheets, use payment dates, and exclude test/undated entries for calendar-year filters. They are not USD bank settlements, present values, unique-project counts or independently verified on-chain transfers. Import time was September 25, 2026, 01:22 UTC.
- The viewing-key answer correctly separated incoming/full viewing keys, no spending authority, and lack of authenticated sender identity from a memo.
- The latest-ZIP answer distinguished new publication, creation date, highest number and activated upgrade, and disclosed that it could not establish definitive newest publication/revision chronology. Source links and status dates were retained.
- The ZIP 259 question started with local references, requested missing official evidence, then used web search. The accepted-offer regression used an explicitly constructed public conversation ending in “sim”; the real model advanced the explanation in Portuguese rather than repeating a clarification.

## Automated and build checks

The automated suite covers: request validation and quotas, complete-turn context, narrow direct-answer grammars, prior-instruction preservation, language/year continuations, stale/outage handling, exact currency conversion/refunds, public-only index generation, bounded excerpts, aggregate search validation, cache expiry/import versions, cancellation, tool/round budgets, usage accounting, provider isolation and citation rendering.

- `npm test`: 612 Vitest tests passed, 9 existing opt-in tests skipped; both public-index generator tests passed (614 passing checks in total).
- `npm run typecheck` and scoped ESLint for all touched Zarvis modules and index scripts.
- `npm run build`: passed, including knowledge regeneration and type checking. Existing Next.js middleware-convention deprecation remains unrelated.

## Remaining provider validation

Grok adapter tests use simulated Responses events and configuration checks, not a live xAI account. The adapter is prepared for `ZARVIS_PROVIDER=xai`, `ZARVIS_MODEL=grok-4.7`, and a server-only `XAI_API_KEY`. Live streaming, hosted research, token usage and answer quality with Grok require that key. OpenAI remains active in this preview until deliberately switched.
