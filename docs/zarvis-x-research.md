# Public X research for Zarvis

This optional integration addresses requests for social research without giving the answering model credentials or account control. It works with Claude, OpenAI and Grok through the shared `search_zcash_x` function tool. It is **disabled by default**.

## Coverage and privacy

The tool accepts one of five topics: bounties, grants, releases, events or news. The server builds the query, selects the last 30 days and fixes the account list. It sends no user question, conversation, session, IP address or user-supplied URL to xAI. The answering model already receives the recent conversation under the existing privacy policy. xAI's public search results are returned to that model as untrusted data.

The reviewed set contains 13 accounts: Zakura, Shielded Labs, ZODL (company and wallet), Zcash Labs, Zcash Foundation, Project Tachyon, QEDIT, Zcash, ZCG, ZecHub, Zcash Brazil and Zcash en Español. `x-research-policy.ts` records the exact handles and the official website, organization profile or reviewed community-directory link used to check them on 2026-11-03. The REST API permits up to 20 handles; tests enforce that bound. This beta still does not cover all projects, all of X, Discord or Telegram.

Current official sites are also available to web research and page reads, including Zakura, ZODL, Zcash Labs, Valar Group, Zingolabs and QEDIT. Claude's news research uses the full reviewed domain list; Grok's five-domain news list prioritizes current development teams. Historical ECC material remains available for historical questions. Reviewed identity notes distinguish the ECC-to-ZODL transition, Zakura's collaborating teams and the separate Zcash Labs organization. Naming an organization alone no longer promotes unrelated historical release posts above its identity record.

At most five generated paraphrases with dates are accepted. Each URL must also occur in the provider's retrieval citations and match a reviewed account's HTTPS post permalink. Profiles, direct messages, arbitrary domains and out-of-window posts are rejected. Dates and paraphrases remain provider claims, not independently verified post contents. A post is a discovery lead: current bounty terms, funding and delivery require primary evidence. Empty results are not proof of absence.

Public results are cached in process for 30 minutes under five fixed topic keys. No conversation or credentials are cached. The source drawer retains the retrieval time, and the badge says “X research via xAI” only after usable search evidence, including a valid empty result, was returned. Privacy text and the About page disclose xAI when enabled.

## Enforced boundaries

- Fixed `https://api.x.ai/v1/responses` endpoint, HTTPS, `redirect: error`, no retries, 25-second request deadline, 96 KiB response limit, 2,000 output tokens and two requested provider turns. Retrieval uses Grok 4.3 with reasoning disabled; the primary answer model still performs synthesis. Only `x_search` is offered; no posting, messaging, code execution or arbitrary HTTP tool exists.
- The model can select only a topic. Extra arguments fail validation. The shared engine allows one attempt per answer, including repeated tool calls in the same model response. Requests still pass the existing chat size, deadline, concurrency and network/global quotas.
- Independent, atomic Postgres controls default to four uncached requests per hour and 20 per UTC day, with hard configuration maxima of six and 40. Each topic has a shared 30-minute-window cooldown. An in-flight lease permits one paid research request across replicas. Cache hits need no extra paid reservation.
- The research budget defaults to USD 3 per UTC day (configuration maximum USD 10). Each call reserves USD 0.25 or the configured daily budget if smaller. Settlement uses xAI's reported `usage.cost_in_usd_ticks / 1e10`, including its tokens and fetched items. Actual reported cost also joins the existing answer cost estimate without pricing xAI tokens as Claude tokens.
- Unknown billing after errors/cancellation closes further paid research for the UTC day. Storage failures close the integration. If a process crashes or settlement fails, the lease remains until UTC rollover. Existing launch pauses and unlimited-local-testing flags never bypass these controls.
- Logs contain the outcome, request count, reported cost, elapsed time, numeric HTTP status and a fixed failure category. Raw provider errors, posts, questions and credentials are not logged. No database migration is needed; counters use the `x-research:` namespace in `zarvis_usage`.

These controls limit abuse; they do not promise that abuse cannot occur. The existing network identifier is proxy-derived and advisory, and browser Origin checks are not authentication. Global caps remain effective against rotated network identities. Provider `max_turns` does not cap the number of fetched posts: xAI says thread fetches also bypass handle/date filters. Returned evidence is filtered locally, but an in-flight provider call can exceed its reserved amount or daily remaining budget. **Configure a hard spending limit in the xAI account/project before enabling.** The application prevents subsequent calls; it cannot retroactively stop a provider bill.

## Configuration and rollout

Keep `ZARVIS_X_RESEARCH_ENABLED=false` until validation is complete. Set a dedicated restricted xAI key in `ZARVIS_X_RESEARCH_API_KEY`; only the existing `XAI_API_KEY` is accepted as a fallback. The selected answer provider's key is never borrowed. Do not use `NEXT_PUBLIC_` variables. Also requires `ZARVIS_ENABLED=true`, web search enabled and the database.

```dotenv
ZARVIS_X_RESEARCH_ENABLED=false
ZARVIS_X_RESEARCH_DAILY_LIMIT=20
ZARVIS_X_RESEARCH_HOURLY_LIMIT=4
ZARVIS_X_RESEARCH_DAILY_USD_CAP=3
```

Validate billing access and the provider-side spending limit, then make one controlled preview query. Check source URLs/dates, cost settlement, failures and the privacy/badge presentation before enabling production. Missing/invalid configuration disables research. Turning the flag off immediately disables new requests and cache reads; a request already in flight can still be billed. Rollback is the same flag; no counter reset is required. Do not routinely clear unknown-cost leases to restore access: reconcile provider usage first, or wait for UTC rollover.

Controlled preview calls under the original five-account policy returned valid empty results, including through the complete answer flow with the research badge and coverage caveat. These proved connectivity and accounting behavior, not adequate ecosystem coverage. That gap prompted the expanded account and official-source coverage above. Production configuration has not yet been enabled.

The expanded 13-account preview call using Grok 4.7 failed without usable evidence or metering data. Its precise failure category was not available in that build; do not assert a confirmed timeout. The disposable database conservatively closed further research, and no new call was attempted. The chat correctly omitted the X-research badge and disclosed the failure rather than inventing posts. This prompted the bounded diagnostic categories and the Grok 4.3 extraction configuration, whose model availability and supported reasoning setting were checked against the live API and official documentation. **A successful expanded-coverage live test is still required before activation; do not reset the unknown-cost gate without reconciling provider usage.**

## Validation

Unit tests cover arbitrary queries and privilege changes, redirects, leaked provider errors, bounded bodies, disabled/configuration paths, cancellation, cache reuse, cited versus invented URLs, date coverage and accounting failures. Shared-engine tests cover duplicate/hallucinated calls and cost/provenance under both fixed and dynamic tool lists.

`x-research-budget.integration.test.ts` runs only against a disposable local database named `openzcash_x_research_test`. Set `ZARVIS_X_RESEARCH_TEST_DB_URL` accordingly. It checks 20 simultaneous callers, persistence across module restarts, topic/hour/day caps, budget reservations, failed transactions, launch-override isolation and UTC recovery. CI provisions its own Postgres instance for these cases.

Official API references, checked 2026-11-03: [X Search](https://docs.x.ai/developers/tools/x-search), [cost tracking](https://docs.x.ai/developers/cost-tracking), [structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs), [xAI data policy](https://docs.x.ai/developers/faq/security).
