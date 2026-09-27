# Zarvis preproduction audit — September 27, 2026

## Release decision

The confirmed findings below are fixed in the draft Zarvis branch and verified locally. **Keep the PR in draft and the production feature disabled** until the release gates below are completed. No merge, production deployment, Railway setting change or provider switch was performed during this audit.

This is a code, dependency and local runtime review, not an independent penetration test, a financial audit of source records, or a guarantee of perfect AI answers.

## Confirmed findings and fixes

| Finding | Risk | Fix and evidence |
| --- | --- | --- |
| Vulnerable runtime dependencies | Critical/high upstream advisories | Updated Next.js and its ESLint configuration from 16.2.9 to 16.3.6, plus compatible dependency patches. Baseline npm audit reported seven affected runtime dependency records: one critical, three high and three moderate. The final runtime audit reports zero known vulnerabilities. This identifies dependency exposure; exploitation of this application was not demonstrated. |
| Financial figures inside Markdown escaped validation | Medium | Parse rendered Markdown text before checking amounts, preserving link labels, nested formatting, escapes and decoded entities while excluding hidden URL destinations. Four newly added examples failed before the fix. All seven new Markdown regression cases now pass. This still checks numeric evidence membership, units and rounding, not the full meaning of every claim. |
| Partial model usage could be priced as complete | Medium | Require usage for every completed model round before pricing the answer. Missing usage in either round now leaves the answer unpriced. Both two-round regression cases failed before the correction and pass afterward. Estimates remain distinct from provider invoices. |
| Incomplete request bodies could wait outside the generation deadline | Medium | Use a shared byte-bounded JSON reader with an absolute five-second upload deadline, strict JSON media type, UTF-8 validation and stream cancellation on timeout/disconnect. Both chat and feedback use it. Tests cover slow trickles, aborts, oversized bodies, split UTF-8 and rejection before quota/model use. |
| Grok reasoning continuity depended on model defaults | Compatibility | Explicitly request encrypted reasoning for stateless tool loops with either provider. The Grok 4.3 contract check covers the setting; live Grok behavior still requires its key and a real-provider test. |

The new dependency gate in `.github/workflows/zarvis-quality.yml` runs `npm audit --omit=dev --audit-level=moderate` before the existing quality checks. The framework-generated `AGENTS.md` and `CLAUDE.md` files accompany the Next.js update.

### Dependency follow-up

The full audit including development tools retains **four moderate dependency records tracing to one esbuild development-server advisory** through `drizzle-kit` / `@esbuild-kit`. No high or critical findings remain in that full audit. The affected development server is not the application's production HTTP server. npm proposes a breaking downgrade of `drizzle-kit` to remove that chain; it was not forced. Track an upstream-compatible tooling update, and do not expose that development server.

References: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c), [development-only esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

## Verification after the fixes

| Check | Result |
| --- | --- |
| Full suite, `npm test` | 754 Vitest tests and three Node knowledge-index checks passed; nine pre-existing opt-in database integration tests skipped. The 119 internal evaluation checks are included in the 754. |
| Focused audit/orchestration/quality cases | 159 checks passed before the final full-suite run. These overlap the full suite and are not additional coverage counts. |
| Scoped ESLint | Passed for `src/lib/zarvis`, `src/app/api/zarvis` and `src/components/zarvis`. |
| Clean production build | Next.js 16.3.6 compilation, TypeScript and page generation passed. The first attempt encountered an old generated font cache after the upgrade; a clean build resolved it. Existing middleware-convention deprecation remains. |
| Runtime dependency audit | Zero known runtime vulnerabilities in the final npm audit snapshot. This does not establish absence of undiscovered vulnerabilities. |
| Production-mode loopback HTTP | `/zarvis` returned 200 with CSP and frame denial; public readiness exposed only available/provider/search status; forged admin header returned 403; foreign-origin POST returned 403; disabled chat returned 503. |
| Configured development preview | OpenAI readiness confirmed, privileged chat roles rejected with 400. A browser question displayed the dated USD quote and public source link. The preview remains on the existing Astra configuration. |
| Scoped credential-pattern scan | No API-key or credential-bearing Postgres URL pattern found in 61 tracked Zarvis code/documentation/script files. This was not a full Git-history secret audit. |

The earlier [12 real-provider conversations and browser checks](zarvis-internal-evaluation.md) remain separate evidence from before these audit corrections. The additional browser check used the narrow local quote path, not a paid model conversation. Grok has not been live-tested. The development console reports that CSP blocks React debug-stack reconstruction through `eval`; this development-only warning was not used to relax production CSP.

## Production inspection and remaining release gates

Read-only Railway inspection found service `zbo` serving `openzcash.org`, with the latest recorded production deployment successful. `ZARVIS_ENABLED` and provider/model overrides were unset, so the feature remains disabled by default. The existing OpenAI key was present; no xAI key was configured. No secret values are included in this report.

1. **Remote CI:** obtain a completed successful run for the final commit. The previous run failed before job creation with `startup_failure` / `BuildFailed`, zero jobs and no logs. Local checks do not replace this missing evidence. The draft PR checks show the current remote result; do not infer a pass from this report.
2. **Production database readiness:** verify the additive `0005_zarvis_usage` migration and atomic quota reservation against the production database before enabling chat. This audit could not inspect the schema because the database service has no public endpoint configured. No database changes were attempted. The existing best-effort boot migration and DB-independent health check do not prove this table is ready. Requests fail closed if it is unavailable.
3. **Grok candidate:** after configuring its key securely, run the same representative conversations against the selected model: local quote/ledger routing, Portuguese continuations, treasury assumptions, source citations, current external research, unavailable sources, stop/cancel, usage and latency. Compare response correctness and actual total request cost with the existing baseline before changing production.
4. **Production settings:** explicitly choose enablement, provider, model, allowed origin, request/concurrency limits and provider billing controls. Configure optional estimate rates for the actual selected model. Local unlimited testing cannot enable itself in production; request counts are not a dollar cap.

## Grok cost candidates

Official standard global-endpoint prices checked September 27, 2026, for prompts under 200,000 tokens, USD per million tokens:

| Model | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| grok-build-0.1 | $1.00 | $0.20 | $2.00 |
| grok-4.3 | $1.25 | $0.20 | $2.50 |
| grok-4.7 | $2.00 | $0.50 | $6.00 |

Grok Build is specialized for coding; its lower listed price alone does not establish suitability for Zarvis. Grok 4.3 is the lower-cost general-chat candidate to compare with 4.7. The key grants account access; the configured model determines its rates. Web search adds $5 per 1,000 calls ($0.005 each). Reasoning tokens and repeated model rounds count; a chat message is not a fixed token quantity.

Sources: [xAI pricing](https://docs.x.ai/developers/pricing), [Grok 4.3](https://docs.x.ai/developers/models/grok-4.3), [Grok Build](https://docs.x.ai/developers/models/grok-build-0.1), [Grok 4.7](https://docs.x.ai/developers/models/grok-4.7), [stateless reasoning](https://docs.x.ai/developers/model-capabilities/text/reasoning).

## Reproduce the local gates

```sh
npm ci
npm audit --omit=dev --audit-level=moderate
npm run knowledge:check
npm test
npx eslint src/lib/zarvis src/app/api/zarvis src/components/zarvis
npm run build
```

Use the existing loopback-only opt-in live evaluation script after configuring a funded provider: `python3 scripts/eval-zarvis-live.py --confirm-paid`. That script can incur API charges. Do not commit credentials or use production traffic as synthetic test data.
