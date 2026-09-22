# CEX < ZEC > DEX

Public read-only analysis at `/cex-zec-dex`; JSON at `/api/markets`. Research verified September 22, 2026. The project’s source APIs are queried on the server. No credentials, chain writes, new database schema, or runtime dependencies are introduced.

## Volume benchmark

Rolling 24-hour, reported USD trading activity. The universe is **observed sources**, not every trade globally. The top bars have the same scale, CEX + DEX. DEX includes wrapped ZEC and intent protocols. These are heterogeneous provider measures, not an independently audited consolidated tape.

- [CoinPaprika ZEC markets](https://api.coinpaprika.com/v1/coins/zec-zcash/markets) and [exchange registry](https://api.coinpaprika.com/v1/exchanges): examine every returned row. Include spot with a verified CEX/DEX registry classification. Exclude outliers, derivatives, unknown classifications, quote timestamps older than two hours or over five minutes in the future, and duplicate exchange/base/quote keys. Prefer the newest duplicate. Match the coin ID, including ZEC as quote; do not match ticker text alone.
- [Hyperliquid spot](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot): public `spotMetaAndAssetCtxs` query. Match Unit Zcash by token ID `0x1c994ad3381d31c86c8c2d74ed89a365`, symbol UZEC, and USDC quote. Join contexts by `coin` / market `name`, **not array position**: the live arrays are not aligned. `dayNtlVlm` is USDC notional, treated as USD. Other tokens with ZEC in their names are not Zcash.
- [Universal issuer contracts](https://docs.universal.xyz/docs/developers/contract-addresses): check uZEC on every listed chain (Base, Polygon, World Chain, Katana and Solana) through [DEX Screener's public pool API](https://docs.dexscreener.com/api/reference). Validate the chain and exact base/quote token address; deduplicate by pool address, grouping by exchange and chain. Never infer token identity from its ticker. Solana addresses are case sensitive. Inspect every returned pool; an empty list means no indexed market, not a verified chain-wide zero. Timestamps denote retrieval because this source exposes no quote timestamp. Universal uZEC is distinct from Unit UZEC and from CoinPaprika's ZEC asset; token supply is never added to native chainSupply. A successful September 22 query returned five Aerodrome pools on Base, and no indexed pools on the other four chains. Coverage depends on the provider's index and does not imply proof of reserves.
- [NEAR Intents ZEC explorer](https://explorer.near-intents.org/?toTokenId=nep141%3Azec.omft.near): read the public server-rendered token-volume object as data; never execute upstream code. Validate the exact token filter, timestamp and `isStale` flag. The page's token total repeats when ZEC is selected in both filters; count it once, not once as input and again as output. It is token activity, not whole-protocol volume. Private/unreported routes are outside observable coverage. A changed HTML contract fails closed.
- [Maya Midgard](https://midgard.mayachain.info/v2/doc): explicit `from` and `to` 24 hours apart for `ZEC.ZEC`; require matching returned window and synchronized index. USD volumes are integer cents; divide by **100**, not 1e8. Native, trade and synth activity included. Zero is valid only in a valid source response.
- [THORChain registry](https://gateway.liquify.com/chain/thorchain_midgard/v2/pools): source is the current endpoint linked by [THORChain developer documentation](https://dev.thorchain.org/). A successful full registry with no `ZEC.ZEC` reports “not listed”; it does not create a zero-volume venue. If a ZEC pool appears, load its direct window.
- [Rhea / GeckoTerminal](https://www.geckoterminal.com/near/pools/refv1-6065): separately disclosed, outside the headline, because execution overlap with NEAR routing cannot be reconciled. No user-interface/aggregator totals are layered onto underlying protocol totals. Direct venues replace matching CoinPaprika rows.

For CEX volume C and DEX volume D:

- DEX share = D / (C + D).
- Additional DEX volume for parity at unchanged CEX = max(0, C − D).
- Volume migrating from CEX to DEX for parity at unchanged combined volume = max(0, (C − D) / 2).
- Scale for parity = C / D; undefined if D is zero. **Overtake** requires D > C; equality is not success.

Missing feeds are not zero. Stale volume is excluded from the current comparison; remaining sources are visibly marked partial. Without either side, the comparison is unavailable. No historical trend, timeline, or forecast is fabricated from a one-day snapshot. ETF share turnover and perpetual futures are excluded from the spot benchmark.

## Balances and supply

[CipherScan API](https://cipherscan.app/docs) provides the complete label registry, rich list, individual address balances and `blockchain-info`. All labels are retained, not just the rich-list leaders; addresses absent from the top 500 are requested individually with bounded concurrency. Missing balances stay null. Addresses are deduplicated before aggregation. The rich-list `balanceZat` is zatoshis, but its `balance` is already ZEC; the individual-address `balance` is zatoshis. These contracts differ and are tested.

Coinbase hot/cold/Prime labels are grouped; likewise Binance, Gemini, Kraken and KuCoin. Grayscale's upstream category `exchange` is reclassified as fund, and Hyperunit as bridge, while the original label/category is retained per address. No beneficial owner is inferred from a custodian address. All unmapped CEX venues remain listed as unknown balances. Shielded owners and unlabeled wallets cannot be assigned to exchanges. Totals are visible minimums, not proof of solvency or complete reserves.

Supply denominator is the mainnet node's **on-chain chainSupply**, including lockbox. Validate node synchronization and reconcile the integer-zatoshi sum of every value pool exactly, including Ironwood, against chainSupply. Retain block height/hash. This is internal reconciliation of a node response, not independent auditing. A 21M maximum is never substituted for current issued supply. Source snapshots can differ by a few blocks. If mapped balances exceed the transparent pool, hide their supply percentages rather than display impossible shares.

## Institutional evidence

- [Cypherpunk](https://www.cypherpunk.com/): company dashboard ZEC total; date is the latest disclosed ZEC transaction (August 31, 2026 in the inspected response). No wallet mapping inferred. The dashboard's own supply percentage is not reused.
- [21shares Zcash ETP](https://www.21shares.com/en-uk/product/zcash): [issuer API](https://api.primary.21shares.com/api/product_details/ZCASH), securities outstanding × ZEC entitlement per security, dated by issuer valuation date. September 22: 5,000 × 0.013152544622 = 65.76272311 ZEC. Do not approximate with AUM divided by an unrelated current price.
- [Grayscale / The Zcash ETF](https://www.thezcashetf.com/): total ZEC in fund, retaining report date. The issuer page was indexed with 464,514.8551 ZEC as of September 8, 2026, but direct requests returned a security checkpoint / 429 on September 22. A dated saved disclosure is displayed if live retrieval fails. It is never presented as a live balance. The converted trust and ZCSH are one product, not two holdings. Coinbase Custody is the issuer's stated custodian.

Institutional holdings are **not added to custody-address totals**. The issuer's total and labeled Grayscale wallets are alternative, differently scoped evidence. A filing or leveraged derivative product alone proves no physical ZEC holdings. Research found the named physical products above; the page does not claim a universal list of funds, addresses or beneficial owners.

## Refresh behavior

Market/supply sources: five-minute server cache. Addresses: ten minutes. Issuer disclosures: one hour; their reporting dates remain visible. The page auto-checks every five minutes while visible and provides a refresh button. A server cache hit does not refresh its successful timestamp. Failed requests back off for a minute, retain prior data explicitly as saved, and never replace missing data with zeros. Source availability and exclusions are inspectable on the page and in JSON.
