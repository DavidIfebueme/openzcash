# Zarvis: live Grok integration evaluation

Date: September 28, 2026 UTC (September 27 in São Paulo). Branch: `michae2xl/zarvis-assistant`. Follow-up to the [preproduction audit](zarvis-preproduction-audit.md).

## State

- The user-created xAI key was verified with Chat access to **Grok 4.6 and 4.7**, then stored as `XAI_API_KEY` in Railway service `zbo` using `--skip-deploys`. No key value was printed or committed. Direct Responses API checks returned the expected response on both models.
- The loopback preview is running **Grok 4.7**, low reasoning, with a local database. The key is read into process memory from Railway; no API credential is written to `.env.local` or committed files.
- Production enablement, provider and model overrides remain unset. No deployment or merge was performed. Keep PR #35 in draft.
- The extended live run passed **13 of 14 checks**. The broad newest-ZIP research case still times out; a targeted official ZIP lookup passed separately. This is **not full production approval or a 10/10 claim**.

## Confirmed corrections

1. **Ledger fallback retained only totals.** On 4.6, the numeric guard replaced a model answer with verified ledger totals but omitted the requested difference. The fallback now also formats the existing same-scope computed comparison. Rechecks displayed **+$461,970.97 (+13.60%)** for the imported 2024/2025 grant rows, preserving the historical-budget caveat. No guard was disabled.
2. **Isolated ZIP 310 excerpts lost their authority context.** One 4.6 example incorrectly attributed nullifier derivation to an IVK alone. Every retrieved ZIP 310 chunk now carries the document-wide FVK assumption. The next 4.6 response, 4.7 continuation and browser response correctly distinguished IVK from FVK. This fixes a demonstrated retrieval ambiguity, not every possible factual hallucination. [Official ZIP 310](https://zips.z.cash/zip-0310).
3. **xAI source inventories were inserted as prose.** Real research returned many annotations with zero-length offsets. These are retained as consulted sources, not inserted at the beginning of the answer. Missing annotation metadata is tolerated and the observed internal citation marker is stripped. Regression fixtures use the observed shape. [xAI citation behavior](https://docs.x.ai/developers/tools/citations).
4. **ZIP research is scoped to the official catalog.** Questions mentioning ZIPs now restrict hosted search to `zips.z.cash` and the prompt distinguishes creation, publication, revision and activation. This improves source relevance; it did **not** resolve the broad 4.7 timeout.

## Real-provider observations

| Check | Grok 4.6 | Grok 4.7 |
| --- | --- | --- |
| Direct connection with the saved key | Passed, 2.00 s | Passed, 1.17 s |
| Twelve core conversations | Initially 11/12; missing comparison passed after correction | 12/12 passed |
| Price and annual ledger follow-up | Three answers used local data, zero model calls | Three answers used local data, zero model calls |
| Treasury 20× / 30 → 40 years / community budget | Passed; typed assumptions retained | Passed; typed assumptions retained |
| Bare `yes` after an offer | Continued; initial semantic IVK error corrected on recheck | Passed with correct IVK/FVK distinction |
| Broad newest-ZIP research | Initial generic failure at 37.85 s; later completed in 14.13 s | Timed out near 55 s on three controlled variants |
| Specific ZIP 310 current title/status | Direct provider search succeeded | Full Zarvis route succeeded in 7.10 s, correct Draft status and official link |
| Browser stop and recovery | Not repeated for this model | Keyboard activation of Stop, New chat and subsequent real answer succeeded |

Core completed model answers took 4.11–12.75 s on 4.6 and 2.42–17.11 s on 4.7. These are small, sequential development samples with differing cache states and revisions, not a controlled speed ranking. Structural predicates are not semantic proof: the first bare-yes predicate also missed the phrase “Think of”; the factual error was found by reading the answer, not by that predicate.

### Outstanding research issue

The exact failing request asks for the newest published ZIP, title, status, source and verification date while warning against equating highest number with latest publication. It failed at the application's 55-second deadline on 4.7 with the original domains, the official-only domain, and an experimental one-turn research limit. The last experiment was reverted; the existing two-turn limit remains. Narrowing sources alone is not a latency fix. The simple official-page lookup succeeds, so key authorization and basic hosted search work; the cause of the broad-query delay is not established.

The current deadline continues to stop work and show an explicit failure, rather than inventing a current result. Provider retries remain disabled. This publication-order research case remains a release concern; do not silently count a shorter query as its passing replacement.

## Usage and cost evidence

Completed-route diagnostics contain counts only: no prompts, responses, IPs, visitor IDs or credentials. The following totals include the synthetic runs, targeted rechecks and one completed browser answer. They exclude failed/aborted attempts and standalone direct API probes:

| Model | Completed | Local | Input tokens | Cached input (subset) | Output tokens | Search calls | Completed-use estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| grok-4.6 | 17 | 3 | 135,028 | 72,192 | 5,450 | 5 | $0.2195 |
| grok-4.7 | 15 | 3 | 83,303 | 28,672 | 4,518 | 1 | $0.1557 |

**These are partial usage estimates, not the total bill.** Four failed broad-search attempts and one browser cancellation can have additional unreported charges. Standalone connection probes reported $0.001094 (4.6) and $0.001016 (4.7); the separate 4.6 search probe reported $0.016338. They are outside the table.

Both selected models list standard global rates below 200k tokens of $2/M input, $0.50/M cached input and $6/M output; web search is $0.005 per call. Reasoning tokens are included in output usage. Search turns can invoke multiple tools, so `max_turns` is not a per-tool count or dollar cap. Sources: [pricing](https://docs.x.ai/developers/pricing), [tool accounting](https://docs.x.ai/developers/tools/tool-usage-details), [reported cost ticks](https://docs.x.ai/developers/cost-tracking). Request quotas are not billing caps.

## Final local gates

- `npm test`: **761 Vitest tests and three Node checks passed**; nine pre-existing opt-in database integration tests skipped.
- `npx eslint src/lib/zarvis`: passed.
- `npm run build`: Next.js 16.3.6 compilation, TypeScript and page generation passed. Existing middleware convention warning remains.
- Live-evaluation script syntax and `git diff --check`: passed.
- Browser: xAI provider disclosure, real sourced answer, stop/new-chat recovery observed. No production CSP relaxation. Existing development-only React debug `eval` warning remains.
- The prior remote CI startup failure and production quota-migration verification remain separate unresolved release gates. This local run cannot establish their success.

## Reproduction

With a funded restricted xAI key configured only on the server and the loopback preview running:

```sh
python3 scripts/eval-zarvis-live.py --confirm-paid --extended
```

This executes fourteen synthetic checks and can incur charges. The newest-ZIP case is expected to remain a concern until separately resolved. Read responses as well as pass flags. Raw synthetic results, including initial failures and follow-up variants, are retained in [the evaluation artifact](zarvis-grok-live-results.json). Do not replace them with a success-only report.
