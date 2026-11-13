# NSM balance

`/nsm` shows the Network Sustainability Mechanism as NU7 deployed it on mainnet (block 3,543,405, 2026-11-06): the ZEC consensus holds out of circulation, what feeds it and when it starts coming back. The same balance is the third pool of the treasury bar at the bottom of every page, beside ZCG operating and Lockbox · Coinholder. It is not a wallet: no address, key or committee controls it.

## Rules

`src/lib/funding/nsm.ts` holds the arithmetic, pure functions of heights and zatoshis:

- **In**, [ZIP 235](https://zips.z.cash/zip-0235): each block removes `floor(6 × fees / 10)` of its transaction fees from circulation; the miner keeps the rest.
- **Held**, [ZIP 237](https://zips.z.cash/zip-0237): the NSM value balance is consensus state, left out of issued supply. It started at 368.58445520 ZEC, the subsidy and fees coinbase transactions left unclaimed before NU6.
- **Out**, ZIP 237 and [ZIP 259](https://zips.z.cash/zip-0259): from block 8,939,664 every block adds `ceiling(1375 × balance / 10^10)` to its scheduled subsidy.
- [ZIP 233](https://zips.z.cash/zip-0233) (voluntary removals) is a draft and was not deployed with NU7; ZIP 234 was replaced by ZIP 237.

`src/lib/funding/nsm.test.ts` checks the fee split against mainnet blocks and the reissuance against ZIP 237's own example.

## Live reading

`src/lib/network/nsm.ts` reads the balance and the recent blocks' fee splits from the [Zcash Info](https://zcashinfo.com/) node API, through the 30-second dashboard cache it shares with `/zcash-network`. `getNsmSnapshot()` returns `null`, never zero, when the feed is down, the node does not report the balance, or the figure is below its seed before reissuance. Each listed block's reported split is compared with the 60% rule and flagged when it differs. `GET /api/network/nsm` serves the same snapshot to the page's live feed (read-only, no input, `503` when unavailable).

Derived figures: fees added since NU7 (balance minus seed, valid until reissuance starts), the average per block and per day over the blocks since NU7, and the reissuance date estimated at 25 seconds a block from the node's latest block.

## The other treasuries after NU7

NU7 also moved to 25-second blocks ([ZIP 218](https://zips.z.cash/zip-0218)). `src/lib/funding/consensus.ts` carries the schedule: a third of the subsidy per block, the 8% and 12% streams unchanged in share (0.04166666 and 0.06249999 ZEC a block, [ZIP 214](https://zips.z.cash/zip-0214) revision 3) and ending at the third halving, block 6,132,390. `src/lib/zcash/lockbox.ts` derives every Lockbox figure from it, so the live total, `/lockbox`, `/coinholders/fund`, `/funding-history`, the treasury calculator and Zarvis change rate at the NU7 block. The page's table is computed from the same functions.

## Checks

`npx vitest run src/lib/funding src/lib/network src/lib/zcash` covers the rules, the feed's failure modes and the treasury bar. Also open `/nsm` in both themes and at a narrow width, and confirm the bar shows three pools without horizontal scroll.
