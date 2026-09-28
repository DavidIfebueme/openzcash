# Zarvis direct answers

## What is free of model tokens

Auto and Quick use reviewed text or validated public-data formatting for the complete supported question. No provider client is created in this path, and there are zero model input/output tokens and zero hosted AI searches. Public database reads, quote providers and official ZIP refresh requests still run when needed; hosting costs and normal request quotas remain.

| Subject | Example | Source/behavior |
| --- | --- | --- |
| Zcash basics | What is Zcash? | Reviewed EN/PT explanation and source |
| Privacy and keys | What can a Sapling incoming viewing key reveal? | Incoming/full/outgoing distinctions; no spending authority |
| Supply and halvings | What is 5% of 21 million ZEC? | Fixed maximum versus changing circulating supply |
| Site navigation/methodology | Where is the treasury calculator? | Existing public OpenZcash pages |
| USD price | Qual é o preço do ZEC? | Shared quote with its time and stale state |
| Community holdings | What are the ZCG and Lockbox balances? | Dated ZCG report, block-based Lockbox estimate, separate quote |
| Grant payments | How much has ZCG paid in grants? | Full selected ledger aggregate, historical budget values |
| Scoped grant payments | How much did coinholders pay in grants to Zingo in 2025? | Program/year and literal project/recipient/milestone fragment |
| Numbered ZIPs | What is ZIP 317? | Exact document, revision-specific status, Created and official abstract excerpt |
| Latest ZIP | What is the latest ZIP? | Fresh catalog ordered by declared Created date, not publication or highest number |

Nineteen reviewed fact/navigation topics have English and Portuguese text. Numbered ZIP abstracts are quoted in their original language, explicitly labeled as English in Portuguese answers. They are not model translations or technical analyses.

## Context

Supported follow-ups retain the known subject: “e em 2025?” keeps the ledger program and project; “e o Lockbox?” switches the fund; “when was it created?” keeps the exact ZIP number. Greetings, thanks and supported EN/PT, USD and brief-response preferences do not erase that subject. Explicit stored preferences are respected.

An unrecognized earlier user instruction keeps the conversation on model synthesis, because it might set formatting, language or other constraints. A bare “yes/sim” is not turned into a repeated factual answer. Deep analysis always uses the selected model. Comparisons, predictions, technical reasoning, unsupported currencies/languages, detailed-response preferences and additional qualifications retain model synthesis even when the underlying facts exist internally.

## Data limits

- Missing amounts are never silently zero. Unsupported or unavailable price/treasury/ledger data produces a local unavailable answer, preserving what can be verified.
- ZCG cash excludes past grant spending. Lockbox values are accrual estimates, not fresh wallet balances. Later outflows may require reconciliation. Combined valuation rounds each pool like the existing calculator/footer and does not imply a single spendable pool.
- Grant totals cover the whole selected ledger, not search excerpts. Negative returns, missing fields, historical USD budget values, recorded ZEC disbursements, program separation and payment-date filtering keep their existing meanings. Project matches are literal text fragments, not confirmed unique identities.
- Stale or missing requested ZIPs fall back to the existing evidence/research path. Created is not first publication, and document status is not network activation.
- This is bounded deterministic coverage, not a promise to answer every paraphrase or every internal-data question for free. No actual-traffic savings percentage is claimed.

## Verification

The direct orchestration suite runs the real local planner with public-reader fixtures and a provider mock that throws on any unexpected billed request. It verifies zero client creation, zero model/search calls and zero tokens, completion and citations, supported context, malformed/missing data, and intentional model fallback for unsupported or Deep requests.

Run `npx vitest run src/lib/zarvis/direct-intent.test.ts src/lib/zarvis/direct-data.test.ts src/lib/zarvis/direct-orchestration.test.ts src/lib/zarvis/local.test.ts src/lib/zarvis/openai.test.ts`.

Live verification uses synthetic questions against the loopback preview with counts-only development diagnostics. Diagnostics contain no questions, answers, IPs or credentials and remain disabled in production. A fast reply alone is not proof of zero model usage.

### Local live run — September 28, 2026 UTC

Twenty-three synthetic requests, including multi-turn sequences, returned completed answers with `route=local`, `modelCalls=0`, `inputTokens=0`, `outputTokens=0` and `webSearchCalls=0`. Reads used the actual preview's public data and ZIP catalog, not fixtures. HTTP durations were 6–955 ms on the local machine; this is not a production latency guarantee. The browser also rendered an incoming-viewing-key answer and its spending-authority follow-up with sources.

The final automated run passed 895 Vitest tests plus 3 knowledge-build tests; 9 optional database tests were skipped. An earlier rerun hit three 5-second timeouts while the machine was under concurrent load; the full suite then passed with `--maxWorkers=2`, without changing test assertions or timeouts. Changed-file ESLint also passed.
