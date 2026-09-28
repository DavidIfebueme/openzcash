# Zarvis source and response audit — September 28, 2026

## Traffic, not visitor tracking

The audited window is 08:30–10:24:16 America/Sao_Paulo (11:30–13:24:16 UTC). Railway HTTP logs from both deployments contain **1,248 POST attempts** to `/api/zarvis`: 161 HTTP 200 admissions, 1,082 HTTP 429 rejections, four HTTP 400 rejections and one HTTP 403 rejection. No upstream error was recorded in these HTTP rows. HTTP 200 begins a stream; it does not prove the generated answer finished or was factually correct. These are requests, not unique people, and can include synthetic checks.

The records were deduplicated by request ID in memory. Only aggregates were retained; no IPs, user agents, visitor questions, visitor answers, credentials or session identifiers are included in this report. Both deployment extracts were below the 2,000-row query cap. Zarvis does not retain visitors' transcripts, so their answer quality cannot be graded retrospectively from these counters.

A separate process-metrics snapshot at 10:28:35 BRT, covering only the process started at 10:13, showed 108 completed streams, zero failed streams, 16 local answers, 92 model answers and one busy rejection. This is a different time window, not an extra 108 requests to add to the HTTP count. Zero failed streams is not proof of semantic accuracy. Pricing was not configured: unpriced model usage must not be reported as free.

## Reproduced defects and changes

- A short Zooko biography query retrieved ZIP bylines and acknowledgments. It now prioritizes named People records, Road history, the primary Zcash origins account and a dated Shielded Labs affiliation snapshot. Explicit ZIP-number questions still prioritize their specification.
- The public compiler flattened records and omitted important fields. It now preserves a person's role, pseudonym, disclosure date, chapter era and source title, including repeated titles across chunks. Mixed files retain their otherwise unmatched public text. The same 54-file allowlist remains; code is parsed, never executed, and private routes/secrets are not indexed.
- A bounded chronology covers different periods before filling the remaining space from one long chapter. The full retrieval budget remains four documents / 5,000 serialized characters.
- Real generations exposed two date/context errors: the 2024 chapter was mistaken for the ECC CEO transition, and an isolated pronoun made Satoshi's 2010 key-blinding discussion sound like Zooko's 2009 action. The public Road text now states December 2023 and identifies Satoshi/2010 explicitly. Disclosure dates are labeled separately from event dates.
- ZcashInfo and ZecStats are now permitted research/citation sources, with reviewed methodology notes. Hosted research chooses domains by subject instead of always using the same five sites.
- The documented ZcashInfo mining-overview API was verified directly. A fixed, server-side reader validates 20 consecutive recent blocks, node sync state, positive difficulty, source times and sample freshness. It applies the publisher's post-Blossom formula to the average difficulty. Responses preserve GSol/s, block range, UTC observation timestamps, retrieval time and the 20-block window. The reader has an eight-second timeout, a two-MiB response cap, no redirects, and a 60-second cache. It forwards no conversation, visitor headers or credentials.
- Plain current-network-hashrate questions and five mining methodology/definition FAQs can complete without a model. Unknown qualifications, prior unsupported constraints and explicit Deep retain synthesis. ZecStats contributes methodology and a research destination; this release does not claim a direct ZecStats numerical feed or a pool-share API integration.
- Existing retrieval checks caught Blossom and Portuguese monthly-report regressions after indexing changed; those source selections were corrected without weakening test expectations.

## Real synthetic evaluations

No visitor conversations were used. Baseline questions ran against production; candidate questions ran the actual local planner/orchestrator with the production-configured Grok 4.7 and public data readers.

| Question | Baseline | Verified candidate |
| --- | --- | --- |
| Current network hashrate with date/window | Timed out around 56 s | 1.0–1.2 s; validated 20-block reading, zero model calls/tokens |
| Why ZcashInfo and ZecStats differ | Timed out around 56 s | 4 ms; reviewed comparison, zero model calls/tokens |
| Does 30% mining pool share mean 30% ZEC ownership? | Correct distinction | Correct distinction with pool-attribution source |
| Removing 20% allocation: 20% or 25% relative increase? | Correct 25% arithmetic | Correct 25% arithmetic |
| Who is Zooko? | User screenshot: ZIP author mentions, biography omitted | Road, People, origins and dated CPO role; corrected December 2023 transition |
| Follow-up about Satoshi | Not in baseline | Context continued with the 2009 blog and 2010 public exchanges |
| Detailed biography | Not in baseline | Final 18.2 s generation covered DigiCash, cypherpunks, Tahoe-LAFS, Bitcoin, ECC, Denver ceremony and dated role; Satoshi is correctly identified in the 2010 passage |

The limited set demonstrates these concrete corrections, not an overall chatbot accuracy percentage. General hosted research remains subject to source access and provider deadlines. Dynamic data outages/stale samples are labeled rather than converted to zero or invented current figures.

## Verification

- 969 Vitest tests passed; nine optional database tests skipped.
- Six public-knowledge compiler tests passed.
- TypeScript, changed-file ESLint, knowledge consistency and whitespace checks passed.
- Production build passed with dependencies installed from the lockfile. An initial local attempt failed because Turbopack rejects dependencies symlinked outside its project root; replacing our temporary symlink with a local `npm ci` resolved that environment issue.
- The temporary launch quota suspension and its midnight BRT expiry were not changed.

## Primary and publisher references reviewed

- [Zcash origins](https://z.cash/learn/who-created-zcash/)
- [ECC leadership announcement, December 18, 2023](https://electriccoin.co/blog/stewarding-a-new-season-at-ecc/)
- [Shielded Labs team, checked September 28, 2026](https://shieldedlabs.net/team/)
- [Satoshi's BitcoinTalk discussion](https://bitcointalk.org/index.php?topic=770.msg9074#msg9074)
- [OpenZcash Road](https://openzcash.org/ceremony/road) and [People](https://openzcash.org/ceremony/people)
- [ZcashInfo API documentation](https://api.zcashinfo.com/docs#tag/mining), [solrate](https://zcashinfo.com/learn/solrate/) and [pool attribution](https://zcashinfo.com/learn/pool-attribution/)
- [ZecStats methodology](https://zecstats.com/tools) and [hashrate chart](https://zecstats.com/chart/hashrate)
