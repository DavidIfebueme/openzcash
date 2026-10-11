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
