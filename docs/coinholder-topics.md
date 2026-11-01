# Coinholder proposal topics

The proposal directory and detail header can show up to three semantic topics. The analyzer reads the complete public GitHub application body, title and original category. It does not open links or classify comments. Original categories and requested amounts are never rewritten.

Topics come from the fixed taxonomy in `src/lib/coinholder/proposal-topics.ts`. A structured model response must use known IDs, contain no duplicates, and supply an exact supporting quote from the application for each topic. Only confidence scores of at least 0.8 are displayed. These scores are model judgments, not calibrated probabilities. Topics describe the work; they do not establish an award, payment, eligibility or independent verification of applicant claims.

The Anthropic Messages API uses `claude-opus-5-5` by default, the existing server-only `ANTHROPIC_API_KEY`, structured output, no tools and a 45-second deadline. The destination is fixed to `api.anthropic.com`; there is no automatic fallback to another provider. At most two analyses run per process. The application is treated as untrusted data. The 100,000-character input limit rejects oversized input rather than silently classifying only an excerpt. Normal GitHub issue bodies fit this limit.

Migration `0011_coinholder_topic_cache` stores results by a SHA-256 hash of the full input, provider, model and taxonomy/prompt version. Changing any of these creates new work. Database leases prevent simultaneous replicas from analyzing the same revision; failures back off from five minutes to one day. Completed results survive process restarts. Increase `TOPIC_ANALYSIS_VERSION` whenever the prompt, taxonomy or validation semantics change.

The always-on production process checks eligible submissions every five minutes and once 20 seconds after startup. Page/API reads can also discover new work. Analysis runs in the background, so it does not delay source rendering. The open list refreshes every 30 seconds while its analyses are pending, then returns to the normal five-minute interval. The existing category/title fallback is used until validated tags are available; a missing key, model failure or unavailable cache does not hide proposals. Source outages never schedule analysis against a newly incomplete listing.

Configuration:

- `COINHOLDER_TAGS_ENABLED=false` stops new paid analyses and the topic schedule. Cached results remain readable.
- `COINHOLDER_TAGS_MODEL` selects a compatible Anthropic model; default `claude-opus-5-5`.
- `DISABLE_AUTO_REFRESH=true` stops the timer, while page reads may still discover new work. Use the feature switch above to stop all new analysis.

Validation uses unit tests for full-input handling, grounded output, cache invalidation, concurrency and failure isolation. Set `COINHOLDER_TOPICS_TEST_DB_URL` to a disposable local database named `openzcash_topics_test` to run the migration, lease and persistence tests. Do not point tests at the application database.
