# Coinholder dashboard

The **Voting activity** page at `/coinholders/activity` includes public, read-only historical voting analytics. It uses OpenZcash’s navigation and theme, with no DAO account or community context. It does not cast votes or execute grants.

## Explore the Q3 2026 round

The first adapter is explicitly pinned to the finalized Q3 2026 retroactive grants round. It displays the 37 OpenZcash proposals, the corrected program outcomes (17 approved and 20 rejected), and exact weights from the official vote-chain summary.

- **Seven stacked charts:** cast volume, revealed shares, Shares vs ZEC, Decision margin, Reveal heatmap, Matching tallies and Recurring amounts remain visible together. One proposal selector filters the first five and highlights the selected proposal in the last two. The three comparison panels use compact scrollable views and retain all 37 proposals. The page has no separate summary card or decision-rule sidebar.
- **Cast volume:** daily is the default; hourly and minute-level inspection within a selected UTC hour remain available. Hover, tap, or use arrow keys for the interval, cast count, and cumulative cast count. The expandable table retains cumulative totals when zooming into a later hour, including zero-activity periods.
- **Revealed shares:** a separate daily archive provides Accept, Reject, Reject with lower amount, and Abstain counts. The default cumulative view uses step lines at UTC day boundaries; Daily shows stacked counts for each day. Hover, tap, or use arrow keys to inspect the exact four counts and total. This chart remains daily when the cast interval changes. It measures revealed ballot portions, not holders, complete casts, approval, or ZEC weight. See [Revealed-share history](./coinholder-analytics-reveals.md) for reconstruction, reconciliation, and coverage.
- **Shares vs ZEC:** paired markers compare each option's fraction of revealed shares with its fraction of final ZEC weight. Both denominators include all four options within the same proposal. The option selector covers every proposal; selecting one proposal shows all four options with exact counts, ZEC amounts, and percentage-point gaps. Gaps are calculated before rounding either percentage. This comparison does not identify holders or wallet concentration.
- **Decision margin:** final acceptance minus 50 percentage points, ranked from highest to lowest. The approval denominator excludes abstentions; the separate quorum indicator includes them and requires 420,000 ZEC. Strict-majority decisions use raw integer weights, including at a displayed 0.00-point margin. An empty approval denominator is unavailable, not zero percent. Exact eligible and total weights remain accessible for every proposal.
- **Reveal heatmap:** proposals by UTC day, with an option selector. Each cell compares the selected option's share count with the all-option share count for that same proposal and day. Hover, focus, or tap to inspect exact counts and percentages. No-share days are distinct from valid zero-percent cells. This shows the composition of arriving shares, not opinion changes or a weighted approval timeline.
- **Matching tallies:** a 37 × 37 matrix compares every pair of final tallies. A pair's distance is half the sum of its four option differences, shown against the smaller of the two votes; with totals this close, it is about the least ZEC that would have to change option to turn one tally into the other. Every proposal drew 2,179,029.875–2,181,452.875 ZEC from 877–888 casts, so a small distance means most of that ZEC chose the same option on both. Proposals linked by pairs within 2% of the vote form lettered groups; 26 of the 37 have such a near-copy. Comparisons use exact integer weights. The panel describes public totals; it does not identify holders.
- **Recurring amounts:** each proposal's final Abstain and lower-amount ZEC on one shared scale. Sorted totals less than 25,000 ZEC apart count as one amount and near-zero totals are left out; for example, 13 proposals drew 104,432.375–113,478.375 ZEC of Abstain. The panel also names the smallest leading option of any proposal, Abstain on Connaugh Zcash Videos at 1,038,923.25 ZEC (47.67% of its vote), which caps any block of ZEC that voted the same way on every proposal below half of the ZEC voted, and lists the proposals whose Abstain alone could have reversed the outcome. Recurring amounts are consistent with blocks of ZEC voting alike, but they can also come from many holders deciding alike and do not identify anyone.
- **Proposal details:** a compact disclosure in the selected proposal's Shares vs ZEC panel retains its OpenZcash verification link, grant application, and any published outcome correction.
- **Reading guidance:** every chart has a keyboard-accessible **How to read** disclosure explaining its units, visual marks and interactions. Explanations stay collapsed by default. Count axes use rounded integer ticks, date labels align to their bars or snapshot boundaries, and the UTC range is centered below each time chart. Axis text keeps a readable screen size on phones.
- **Source details:** the collapsed footer includes the closing time, snapshot block, counting-rule reference, source-check and archive timestamps, the reveal archive hash and pinned state link, round ID, and final-summary SHA-256.

The first graph measures encrypted cast messages. A batch can contain many casts. The second graph measures revealed shares from separate archived state counters. Neither message counts nor transaction counts establish the number of holders or their ZEC weight. Block timestamps establish inclusion times, not the time someone clicked a wallet button. The archive and its reconciliation checks are documented in [Coinholder voting activity](./coinholder-analytics-activity.md).

The main dashboard focuses on the five charts and their shared proposal selector. Transaction references, inclusion timestamps, proposal IDs, and decoded public fields for the latest 50 records remain in the checked-in activity archives and the server-validated source archive. The dashboard does not render a separate proposal list, transaction table, or input inspector.

## Outcome rules and precision

Quorum requires at least 420,000 ZEC of total weight across Accept, Reject, Reject with lower amount, and Abstain. Approval requires Accept to be strictly greater than the two rejection options combined. Abstain is excluded from this approval denominator, but included in quorum. The Connaugh outcome uses the published correction.

All threshold and outcome calculations use integer arithmetic. The raw summary unit is one eighth of a ZEC, so exact amounts retain up to three decimal places. Display percentages are rounded; the result never depends on a rounded percentage. Proposal weights are not summed across ballots, because that would count overlapping voting weight repeatedly. Approval denotes a governance decision, not proof that a grant has been paid.

## Refresh and failure behavior

The page requests a source check every 60 seconds while visible, with an explicit refresh control. The server coalesces requests, caches for 60 seconds, and accepts only the pinned summary hash from fixed official endpoints. Source fetches have a six-second timeout, bounded response bodies, and no redirects. The public `/api/coinholders/activity` route reads the same server adapter as the page. It does not depend on a community or account. Metadata is derived directly from OpenZcash’s local `verifyRound` and `verifyJson` functions; the adapter never requests its own public verification API.

An unavailable or changed source falls back to the last matched result or the dated bundled snapshot, with a visible notice. Incomplete activity or reveal history is never drawn as zero activity. Each chart can remain available independently; a missing reveal archive does not hide final ZEC results. These data matches do not independently verify consensus signatures or recompute the cryptographic tally.

## Future active rounds

This adapter does not discover new elections. A new round needs an explicit source and rule configuration, validated lifecycle states, and an incremental block index. The visible refresh control does not turn the historical archive into a live feed.

During an active shielded vote, a dashboard can show accepted casts and their inclusion times. When the protocol publishes per-option revealed-share counters, it can also show those counts without estimating their ZEC weight. The Q3 reveal adapter is a fixed daily archive, not a live counter feed. A real-time ZEC approval curve requires a protocol-supported public tally; it cannot be inferred from encrypted commitments. Final option weights must follow the published tally lifecycle. This preserves the distinction between pending data, observed activity, final results, and treasury execution.

## Primary sources

- [OpenZcash results](https://openzcash.org/coinholders/results) and [verification data](https://openzcash.org/api/coinholders/verify?round=q3-2026&format=json).
- [Published Q3 counting clarification](https://forum.zcashcommunity.com/t/q3-coinholder-directed-retroactive-grants-program-results/57909/19).
- [Official raw summary](https://zvote.zfnd.org/shielded-vote/v1/vote-summary/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01).
- [Valar protocol types at the inspected revision](https://github.com/valargroup/vote-sdk/blob/4dbe05aad847513300e632ab1be48ae08662b240/proto/svote/v1/types.proto).
