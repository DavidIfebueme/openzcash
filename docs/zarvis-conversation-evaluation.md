# Zarvis conversation evaluation — September 26, 2026

## Reported failure

The user asked for the latest ZIP, accepted Zarvis's offer to look it up with “yes”, and received another clarification instead of the lookup. Inspection confirmed that the browser sent the preceding messages; the model was not acting on them. Separately, the client discarded older context after only twelve messages and discarded interrupted replies completely.

## Changes

- Keep up to forty recent messages within the existing 18,000-character and 32 KiB request budgets; remove oldest complete turns together. Preserve partial answers with an explicit interruption label.
- Use recent assistant replies as well as user messages when selecting background notes for short follow-ups.
- Make accepting an offered lookup or explanation mean continuing the action, without another confirmation. Preserve the topic, assumptions, language and requested format.
- Clarify that the local `proposals` lookup contains ZCG grant applications. ZIP documents and protocol status require official web sources.
- Request a hosted-tool budget of two, retaining the two model rounds, three local lookups, 3,000 output tokens per response and 55-second app deadline.

## Live provider results

All requests went through the local `/api/zarvis` route and its normal quotas, using an isolated local database. No canned responses or direct-provider quota bypass was used. The user approved up to five additional local questions. Four were used: two with GPT-5 mini and two with GPT-6 Astra; one was left for the user's preview. Global quota counters were not reset.

| Case | Model | Observed result | Duration |
| --- | --- | --- | --- |
| Latest ZIP → prior offer to look it up → “yes” | GPT-5 mini | Failed: queried ZCG proposals, then asked permission to search again despite the new continuity instructions. | 13.3 s |
| Summarize that answer in Portuguese | GPT-5 mini | Preserved context and language, but summarized the unhelpful answer. | 3.9 s |
| Same ZIP offer → “yes”, with corrected tool descriptions | GPT-6 Astra | Passed: consulted the official ZIP registry and ZIP 326, gave a dated answer and explicitly declined to claim it was the absolute newest. No repeated question. | 14.1 s |
| “E o que isso muda para quem usa uma carteira? Explique em três pontos simples.” | GPT-6 Astra | Passed: continued discussing ZIP 326, answered in Portuguese with exactly three points, and cited the document. | 8.7 s |

The source check confirmed ZIP 326's title, Draft status and creation date of June 30, 2026 against https://zips.z.cash/zip-0326. Its sections on receiving funds and restoring from seed supported the follow-up explanation. The registry at https://zips.z.cash/ is organized by status/number rather than a chronological revision history. No claim that ZIP 326 is the absolute latest was accepted or hardcoded.

These are two successful flagship smoke tests, not a broad accuracy benchmark. The tool descriptions and requested tool budget changed before the Astra tests, so improvement cannot be attributed exclusively to model choice. No production configuration or deployment was changed.

## Provider-reported usage

The temporary local diagnostics recorded only model identity, token counts and tool types; they were removed after validation. No prompts, answers, reasoning, provider error bodies or credentials were added to application logs.

| Astra case | Input tokens | Cache-write tokens (within input) | Cached input | Output tokens (including reasoning) | Reasoning tokens | Hosted web-search items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accepted ZIP lookup | 17,352 | 7,572 | 0 | 260 | 105 | 3 |
| Wallet follow-up | 14,804 | 7,723 | 0 | 241 | 34 | 1 |

One response contained three hosted web-search items even though the requested budget was two. Do not use that field or visible answer length as a guaranteed spending cap. Actual billed usage is authoritative; pricing and tool fees are documented in `zarvis.md`.

## Automated verification

All 30 focused tests across the Zarvis libraries and API route passed. They exercise complete-turn retention, UTF-8 request size, message limits, interrupted answers, assistant-introduced subjects, ordered conversation delivery, source provenance, cancellation and incomplete provider responses. Type checking and scoped lint also pass. The retained conversation remains bounded: older turns can be omitted at the context limits.

## Price lookup follow-up

The user's subsequent current-price question used the fifth additional local question and exposed a separate integration problem. The `markets` tool called the entire Observatory dashboard, whose collector assembles volumes, venue information, supply and holdings rather than returning a simple ZEC/USD quote. That collection also shares the tool's 12-second deadline with many external feeds.

Added a dedicated `price` topic and `/api/zec-price`, backed by the site's existing five-second CoinGecko quote reader. It returns USD per ZEC, provider time, retrieval time and the original stale flag. A genuine outage with no saved price returns a null quote and HTTP 503, never zero. The market dashboard is no longer required for price requests.

Live local endpoint check on September 26: HTTP 200 in 1.4 seconds, USD 1,532.81 per ZEC, provider quote time 04:34:50 UTC, retrieved at 04:36:39 UTC, `stale: false`. This is a recorded test quote, not a continuing current-price claim. The 46 focused pricing, conversation and route tests passed. The original five-question allowance was exhausted. The user then explicitly authorized one more local question; only that additional network-day reservation was released, and global counters were retained.

The final paid test went through `/api/zarvis` on the Astra preview: “Qual é o preço atual do Zcash em dólares? Informe a fonte e o horário da cotação.” It completed in **6.3 seconds**, used the public-data lookup, and returned **US$ 1.532,81 per ZEC**, **CoinGecko via OpenZcash**, and **September 26, 2026 at 04:34:50 UTC**. These matched the independently checked quote; the answer retained the fresh/stale distinction and cited `/api/zec-price`. The stream completed with sources and no error. The extra authorized question was consumed; no further paid test was made. Type checking, scoped lint and diff checks also passed.

## Unlimited local test mode

The user subsequently asked to remove the quantity limits while testing. Added the explicit `ZARVIS_LOCAL_UNLIMITED` development setting, guarded by both `NODE_ENV=development` and a configured HTTP loopback origin. Enabled it in the ignored local environment and local launcher. No counter reset or production configuration change was needed.

The running preview required a restart to load the new environment setting: before restart the same local request returned HTTP 429; after restart it completed through `/api/zarvis` with HTTP 200, sources, and no error in 8.2 seconds. It used the dedicated price lookup and returned a dated quote. This validates the actual chat path after the existing daily quota was exhausted.

Thirty focused quota, request-boundary and API tests passed, including repeated local reservations without database access and normal quota enforcement for production, missing opt-in and non-local origins. Type checking, scoped lint and diff checks also passed. The per-answer input/output budgets, deadline and cancellation remain independent of the removed local question-count limits.
