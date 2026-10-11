# Zcash Network data audit

Verified against public mainnet responses on 2026-10-11 (UTC). This is a point-in-time source and calculation audit, not a guarantee about future upstream data.

## Sources and meaning

- [Zcash Info API](https://api.zcashinfo.com/docs) supplies dashboard, recent blocks, mining history, pool shares and mempool readings. ZEC amounts are integer zatoshis divided by 100,000,000; source Unix seconds become UTC timestamps.
- History uses the source's canonical blocks. The captured history was 1,000 blocks behind the live tip, roughly 20 hours. The interface displays this delay and excludes the incomplete final bucket from block-count charts. This confirmation window alone does not establish an indexer outage.
- Solrate is an estimate from mean sample difficulty, source work per difficulty and target spacing. Recent transaction counts include coinbase; fees are per block, not a wallet fee recommendation.
- Shielded balances include Ironwood, Orchard, Sapling and Sprout. The share denominator includes all reported value pools, including transparent and Deferred Lockbox balances. Unknown future pools are not assumed shielded. See [ZIP 209](https://zips.z.cash/zip-0209) and [ZIP 258](https://zips.z.cash/zip-0258).
- Reported on-chain supply is distinct from market circulating supply and scheduled theoretical issuance. The captured supply equals the six pool balances. At height 3,513,574 this was 16,979,592.35304480 ZEC, while scheduled inclusive issuance was 16,979,960.9375 ZEC. Historical underclaims are possible under [ZIP 236](https://zips.z.cash/zip-0236), but the audit does not attribute the precise difference.
- Halving uses the current 75-second target and discrete schedule: next height 4,406,400, current total subsidy 1.5625 ZEC, next total subsidy 0.78125 ZEC. Miner subsidy is currently 1.25 ZEC excluding fees. Dates remain estimates; projections are withheld when the source reports a changed target or NU7 scheduled before that boundary. See [ZIP 208](https://zips.z.cash/zip-0208), [ZIP 214](https://zips.z.cash/zip-0214) and [ZIP 259](https://zips.z.cash/zip-0259).

## Cross-checks and corrections

The captured block 3,513,574 matched [ZecBlock](https://zecblock.com/block/3513574) by hash, timestamp, non-orphan status and transaction count. Its byte-size readings differed by one byte between explorers; the dashboard preserves its selected source's value.

Mining block counts sum exactly across day/week/month responses. Shares sum to 100.00%, 99.98% and 100.01%; these differences reflect source percentage rounding. Zero mempool counts and fees are retained as zero.

Regression tests cover three corrected boundary cases:

1. A dashboard containing only STALE blocks cannot produce a live reading or non-finite sample statistics. A stale-only secondary sample falls back to valid dashboard blocks.
2. Independently refreshed canonical data cannot mark a cached incomplete history bucket complete.
3. Halving era, remaining blocks and subsidy use the same observed block across a one-block boundary mismatch.

Freshness is preserved per section. Failed reads retain the original timestamp and become stale; missing data is unavailable, never replaced with fabricated readings. Requests time out after eight seconds. In-process caches use 30 seconds for core/mempool/canonical, 60 for mining and 120 for history; clients refresh every 30 seconds. Cached upstream requests are deduplicated and failures have a ten-second retry cooldown.

## Validation and release boundary

The release passed 3,284 application tests and 56 auxiliary tests, targeted ESLint, TypeScript and the production build. Twelve existing PostgreSQL integration tests were skipped because no disposable test database was configured; this feature does not use the database or add migrations. All 16 provider tests passed, including the boundary regressions.

Local browser checks cover the sidebar position immediately below ZCG, navigation into the standalone dashboard, themes, responsive layout, period/metric controls and visible logo assets. Production acceptance additionally requires the deployed commit and public page/API to be verified.

Rollback baseline: main commit `6d9633698837ac1c37afb07d0b6bd6ffa5bae06e`, Railway production deployment `eb271550-978e-4460-8101-c3c5711d37f1`. Revert the scoped feature commit if release verification fails. No database rollback is required.

Future source-contract changes require review: pool amounts currently validate safe nonnegative integers rather than a 21M aggregate bound, and any new `*_zatoshis` field must still represent an actual value pool rather than aggregate metadata.


## ZecBlock activity source revision (2026-10-11)

This subsection supersedes the earlier mining-history source and cadence description for the activity cards. The preceding audit remains a record of the previous implementation; its test and release results do not validate this source revision.

The accepted activity source is [ZecBlock's public v1 API](https://zecblock.com/docs). Read-only mainnet responses were verified without an API key on 2026-10-11. The relevant endpoints are [current network stats](https://api.zecblock.com/v1/network/stats), [rolling 24-hour history](https://api.zecblock.com/v1/mining/hashrate-history?period=7d&window=24h), and [block time](https://api.zecblock.com/v1/network/block-time?period=7d). The [OpenAPI contract](https://zecblock.com/openapi-v1.json) documents parameters, but several payload schemas are broad; the source implementation and captured responses establish the field semantics below.

- **Solrate and Blocks:** `target-work-v1` sums each canonical block target's expected work, `floor(2^256 / (target + 1))`, and divides by the full 86,400-second window. Historical samples are completed trailing 24-hour windows ending at UTC midnight, not partial-day buckets. Both curves append their current values from the same `hashrateEstimate.windows["24h"]` reading, with the same `asOf`, tip and window boundaries. These are daily historical samples plus a current observation, not an hourly history. See the [method specification](https://github.com/Kenbak/zecblock/blob/main/docs/operations/hashrate.md#L3-L42) and [shared snapshot implementation](https://github.com/Kenbak/zecblock/blob/main/server/api/lib/hashrate.js#L44-L67).
- **Block Time:** the series averages 120 consecutive block intervals using block-header timestamps and preserves each point's height and timestamp. Insufficient or discontinuous history produces an unavailable average. The endpoint supports `6h`, `24h` and `7d`; the accepted interface offers 24 hours and 7 days. The 30-day control belongs to the Solrate/Blocks histories and must not label a 7-day Block Time response as 30 days. Downsampling and `truncated` must remain visible in the data contract. See the [cadence calculation](https://github.com/Kenbak/zecblock/blob/main/server/api/lib/block-cadence.js#L3-L20) and [endpoint contract](https://zecblock.com/openapi-v1.json).

Freshness has distinct clocks: local `fetchedAt` records retrieval; `hashrateEstimate.asOf` records the estimation anchor; `tipTimestamp` and `tipHeight` identify chain coverage; historical `sampledAt` is the last completed UTC-midnight sample. Block Time supplies its own `observedAt` and indexed/node heights. Envelope `meta.generatedAt` is response generation time and must not replace these observation clocks; nullable `meta.source.observedAt` or unknown cache metadata provide no extra freshness guarantee. At 03:36:50 UTC, stats had `asOf=03:35:07` and tip 3,513,637, while Block Time covered height 3,513,641. Independently cached readings therefore need not share the latest height.

Upstream stats retain a 120-second cache; historical calculations use a separate 10-minute cache, as verified in the [source cache description](https://github.com/Kenbak/zecblock/blob/main/docs/operations/hashrate.md#L26-L42) and [history cache implementation](https://github.com/Kenbak/zecblock/blob/main/server/api/lib/hashrate.js#L90-L122). These are upstream cache intervals, not local fetch times or guarantees of new observations on every client refresh. Daily historical cadence must not be assessed as though each midnight sample should be only minutes old.

[ShieldedScan](https://shieldedscan.xyz/api-docs) was considered: current mining readings were fresh, but its daily network series refreshes hourly, uses a ten-minute memo and can serve an older copy for thirty minutes. Its historical `asOf` is response time. It was not selected for the requested current activity curves; see its [series implementation](https://github.com/BitFalco21/shieldedscan/blob/main/server/v1/analytics-series.ts#L22-L48). The previous Zcash Info history was canonical-only and observed 1,000 blocks behind the live tip, approximately twenty hours; that observation alone does not prove an outage or a documented confirmation policy.

This appendix records source verification and the accepted display contract only. It makes no new test, deployment or production acceptance claim.
