# Zarvis internal evaluation — September 27, 2026

This evaluates the internal layer before switching to Grok. It is not a claim of perfect accuracy or universal Zcash knowledge. Production and Railway settings were not changed.

## Implemented scope

- 54 allowlisted site source files / 109 excerpts; 11 curated reference notes.
- 14 public reference documents / 203 additional excerpts: 10 official ZIPs and four OpenZcash Monthly/Operations PDFs, with source dates and hashes.
- Four snippets / 5,000 serialized characters maximum per retrieval; bilingual concepts and relevance ranking; explicit no-match behavior.
- Shared treasury engines, typed session assumptions and reproducible calculator links; numerical/unit checks before financial answer display.
- Anonymous aggregate operations metrics, bounded concurrency and feedback with no conversation text.

## Offline gates

`npm run eval:zarvis`: **119 passing checks**, including 65 English/Portuguese retrieval questions, unrelated-topic abstention, numeric/unit checks, economic invariants, session retention after trimming and operational controls. These are deterministic checks; a relevant excerpt is not evidence that a model answered correctly.

`npm test`: **738 Vitest tests passed, nine pre-existing opt-in DB integration tests skipped, plus three Node index checks passed**. The 119 evaluation checks are included in the 738, not extra. Types and scoped lint were also run. The production build passed. The existing Next middleware-convention deprecation warning is unrelated to this change.

## Real configured-provider conversations

Normal `/api/zarvis` requests at the loopback preview, using the existing Astra configuration. No Grok key was added. The first three cases use deterministic local replies; other cases exercise real model routing and tool use. Each latency is one observed request, not a production percentile or broad model benchmark.

| Case | Observed latency | Automated check |
|---|---:|---|
| price | 0.35 s | Pass |
| ledger2024 | 0.05 s | Pass |
| ledger-followup | 0.03 s | Pass |
| company-20x | 4.21 s | Pass |
| scenario-followup | 4.97 s | Pass |
| community-fixed-budget | 4.13 s | Pass |
| viewing-key | 4.10 s | Pass |
| pdf-period | 5.18 s | Pass |
| ledger-comparison | 6.40 s | Pass |
| source-injection | 5.59 s | Pass |
| offer-context | 2.58 s | Pass |
| continue | 2.57 s | Pass |

All twelve checks passed. Semantic review also confirmed: conditional ownership wording; one future purchase rather than annual spending; reported company balance date; fixed community budget and separate restrictions; source-update warning; IVK does not grant spending or identify the shielded sender; the PDF is a partial period; comparable ledger scope and historical-USD interpretation; injected fake spreadsheet instructions were rejected; the continuation gave an example without repeating an offer.

Same-scope ledger comparison returned $3,396,155.67 (2024), $3,858,126.64 (2025), a $461,970.97 increase (+13.60%). Those are public ledger historical budget values of entries marked paid, not bank settlement or present-day ZEC valuation. Source import: September 25, 2026. Treasury output numbers vary with source snapshots and assumptions; use each saved scenario link to reproduce its inputs.

Synthetic inputs and outputs: [recorded results](zarvis-internal-live-results.json). Refreshing the suite can incur model cost and is explicitly opt-in.

## Limits that remain explicit

- The numeric guard checks evidence membership, units and rounding; it is not a general semantic proof or an independent financial audit.
- Retrieval coverage is finite. Official external snapshots are refreshed through `knowledge:sync`, not continuously crawled. PDF charts/images are not OCR. News headlines are not full articles.
- Curated/cached documents do not prove today's activation, release, price or balances. Source dates remain attached; missing evidence is disclosed or researched externally when configured.
- Memory preserves typed preferences/scenario assumptions, not an unlimited transcript. Shared links expose the numerical assumptions in their URL, never the chat text.
- Metrics/feedback/concurrency are per server process; request quotas remain durable across replicas. Cost estimates require configured rates and do not replace provider billing.
- Real-provider checks cover twelve representative turns. They do not establish 100-person model concurrency, production reliability, or comparative Grok quality.

## Source methodology

Economic calculations retain the website's existing [ZIP 208 halving/spacing model](https://zips.z.cash/zip-0208) and dated [ZIP 214 funding assumptions](https://zips.z.cash/zip-0214). A proposal's status is not treated as proof of activation. Viewing-key checks use [ZIP 310](https://zips.z.cash/zip-0310) and [ZIP 316](https://zips.z.cash/zip-0316). The evaluation separates task-specific cases, deterministic checks and human review as described in [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).


## Browser and concurrent-request checks

- The rendered English chat response opened a local prefilled calculator with the same 30-year horizon, $32,139.80/ZEC scenario price, 20% continued funding, 239,874.77 ZEC deficit and $7,709,527,039 one-off purchase. The calculator visibly reproduced the result exactly; its saved-scenario notice distinguishes link assumptions from new market readings.
- Answer feedback visibly returned “Thanks for your feedback”. API checks returned 204 for a valid vote, 409 for a repeated ticket, and 403 for a forged `x-admin` header at the metrics endpoint.
- A first quote load check exposed a stale-feed path that unnecessarily invoked model synthesis (16/20 direct replies; observed p95 27.462s). This was fixed: narrow quote/annual-ledger queries now return a deterministic, dated cached-data or unavailable response during an outage. They do not invent a current value or send the simple failure to a model.
- Final repeat: **20/20 completed**, four concurrent callers, **20/20 deterministic local replies**; sample median 0.033s, sample p95 0.212s, maximum 0.235s. This is a small local-development quote-route sample, not production/model capacity evidence.
- After that fix, 158 focused checks passed (local handling, orchestration and the 119-case internal evaluation).

## Remote CI status

The workflow definition parses as valid YAML locally. GitHub Actions is enabled, but the first run for commit `8089d11` failed before job creation: empty workflow name, synthetic `BuildFailed` path, `startup_failure`, zero jobs and no logs. GitHub also rejected the one retry request as non-retryable. The API exposed no further cause, so remote CI is **not verified**; the local gates above are the available execution evidence. No repository security or billing settings were changed.

Recorded run: [GitHub Actions 36346465902](https://github.com/Michae2xl/openzcash/actions/runs/36346465902).
