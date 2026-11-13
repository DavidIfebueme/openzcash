# Money since block zero

Working route `/funding-history`; data at `/api/funding/history` (JSON; `?daily=1` adds the daily series, `?format=csv` returns it as CSV). Every ZEC the protocol has allocated outside mining since the genesis block on 2016-10-28, computed from the consensus rules and valued at the ZEC/USD close of the day it was paid. Verified September 24, 2026.

## What is computed, and from what

Amounts are never imported. They derive from block heights through `src/lib/funding/consensus.ts`:

- **Block subsidy**, protocol specification §7.8: the slow-start ramp (62,500 zat × height below 10,000, × (height + 1) up to 20,000), 12.5 ZEC per block until Blossom (653,600), 6.25 ZEC per 75-second block after it, halving at 1,046,400 and 2,726,400. From NU7 (3,543,405, ZIP 218) blocks are 25 seconds apart and the subsidy is the 75-second amount divided by three and rounded down, 0.52083333 ZEC; the third halving moves from 4,406,400 to 6,132,390 and later ones are 5,040,000 blocks apart. This is the scheduled subsidy: from block 8,939,664 consensus adds NSM reissuance (ZIP 237), which depends on the NSM balance and is not modelled here.
- **Founders' Reward**: 20% of the subsidy for heights 1 to 1,046,399. 2,100,000 ZEC in total, 10% of the maximum supply.
- **Dev Fund 2020** (ZIP 214, governed by ZIP 1014): from 1,046,400 to 2,726,399, `floor(subsidy × n / 100)` with n = 7 (ECC), 5 (Zcash Foundation) and 8 (Major Grants), per ZIP 207. 367,500, 262,500 and 420,000 ZEC.
- **NU6 and after** (ZIP 1015, ZIP 2001): from 2,726,400, 8% to Zcash Community Grants and 12% into the in-protocol lockbox, which has no address and no coinbase output. The NU6.1 activation block (3,146,400) pays everything the lockbox accrued since NU6, 78,750 ZEC, in ten outputs of 7,875 ZEC to `t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo`; the lockbox then accrues again from zero. From NU7 each stream is the same share of the smaller subsidy, rounded down per block: 0.04166666 ZEC to ZCG and 0.06249999 ZEC into the lockbox (ZIP 214 revision 3). Every stream in the ZIPs in force ends at the third halving, block 6,132,390.
- **Miners** receive the remainder, plus fees, which are outside this page.

Only two inputs are observed, one row per complete UTC day in `src/data/funding/days.json`:

- **Heights by day:** the first block stamped each UTC day, from the [Blockchair daily aggregate](<https://api.blockchair.com/zcash/blocks?a=date,min(id),max(id),count()&s=date(asc)&limit=10000>). A day runs from its first block to the block before the next day's first block, so every height belongs to exactly one day. Block timestamps are not strictly increasing, so Blockchair's per-day ranges overlap on 73 days; this rule removes the overlap and differs from Blockchair's per-day count by at most six blocks on any day.
- **Price:** the [Bitfinex tZECUSD daily close](https://api-pub.bitfinex.com/v2/candles/trade:1D:tZECUSD/hist?limit=10000&sort=1) (UTC), continuous from 2016-10-29. Genesis day has no candle; its 24.766875 ZEC of Founders' Reward carry no dollar value. CoinGecko's full history is paywalled; spot checks against CipherScan's daily price agree after 2016 (2020-11-18: 63.27 vs 63.33; 2024-11-23: 48.79 vs 48.78). The first days of trading in October and November 2016 were thin and extreme; their closes are kept as recorded.

`npx tsx scripts/gen-funding-history.ts` regenerates the file; it refuses gaps, a non-increasing first height or a missing close. The page adds, live, the blocks mined after the last complete day, at the current rules.

## How it is checked

`src/lib/funding/consensus.test.ts` pins the rules to mainnet:

- mandatory coinbase outputs at heights 1, 2, 9,999, 10,000, 19,999, 20,000, 653,599, 653,600, 1,046,399, 1,046,400, 2,726,399, 2,726,400, 3,146,399, 3,146,400, 3,364,600, 3,428,143 and 3,490,000 ([CipherScan block API](https://api.mainnet.cipherscan.app/api/block/1046400)). Founders' Reward and funding-stream outputs are required by consensus to pay exactly the stream value, so they fix the rules; the miner output is not compared, because miners may claim less than allowed and old fee fields are unreliable;
- the era totals above, and the NU6.1 disbursement equal to the lockbox accrued since NU6;
- the node's lockbox value pool: 6,537,637,500,000 zat at height 3,495,073, exactly the rules' result. The page repeats this comparison live.

`history.test.ts` checks that the days cover every height once, that the daily sums equal one consensus range, and that the years add back to the stream totals.

## Limits

- **USD at receipt** is the market value of the day each ZEC was paid, not what any recipient sold it for. "Same ZEC at today's price" revalues the same amounts at the live price; it is not a holding.
- **Destinations** link to where each slice can be followed next (the ZCG ledger, coinholder grants, the Foundation's reports). The Founders' Reward and ECC allocations are consensus outputs to their addresses; how they were split among beneficiaries is shown only where a primary source states it.
- At height 3,495,073 the node's chain supply is 368.58 ZEC below the theoretical issuance of these rules. Founders' Reward and funding-stream outputs are exact by consensus and the lockbox balance matches to the zatoshi, so the gap does not touch any allocation on this page.
