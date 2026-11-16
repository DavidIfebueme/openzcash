# Coinholder voting activity

The Coinholder page combines two different public records: finalized coin-weighted results and a history of accepted encrypted vote commitments. The time chart measures protocol activity. It does not measure unique holders, wallet balances, funds transferred, or a running approval percentage.

## Reference and differences

The supplied [Decred Pulse proposal](https://dcrdata.decred.org/proposal/748c2601feb6c639) shows approval, cumulative participation, hourly votes, quorum, eligible tickets, voting block bounds, and proposal metadata. Its public [history response](https://dcrdata.decred.org/api/proposal/748c2601feb6c639) contains 11,913 dated ticket choices: 9,496 yes and 2,417 no. Those public ticket choices are a different voting protocol from Zcash coinholder commitments.

The inspected [dcrdata controller](https://github.com/decred/dcrdata/blob/9c02e7116ede87b57ee6189c5dc3c22d48937a3a/cmd/dcrdata/public/js/controllers/proposal_controller.js) fetches proposal history on initial connection. Its [backend synchronization](https://github.com/decred/dcrdata/blob/9c02e7116ede87b57ee6189c5dc3c22d48937a3a/cmd/dcrdata/internal/explorer/explorer.go#L604) refreshes proposals every five blocks. The design reference alone is not evidence of instant updates. We adapt the clear separation of totals, activity, rules, and evidence; its hardcoded chart thresholds are not carried over.

## Q3 2026 sources

- Round ID: `2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01`.
- Vote-chain ID: `zvote-1`. These activity block heights belong to the vote chain, not Zcash mainnet.
- [Round metadata](https://zvote.zfnd.org/shielded-vote/v1/round/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01).
- [Final weighted summary](https://zvote.zfnd.org/shielded-vote/v1/vote-summary/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01).
- [Paginated commitment index](https://zvote.zfnd.org/shielded-vote/v1/commitment-tree/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01/leaves).
- [Final commitment tree](https://zvote.zfnd.org/shielded-vote/v1/commitment-tree/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01/latest).
- [Official production provider configuration](https://github.com/valargroup/token-holder-voting-config/blob/40bdea2fddc0dc7c23c73cd440655dec78bf290e/prod/dynamic-voting-config.json) includes the Zcash Foundation endpoint used here.

The complete public index has 36,236 leaves in 3,416 activity blocks, from block 7,204,640 to 7,963,017. Leaves include vote-authority commitments as well as vote commitments, so a leaf count alone is not a cast-vote count. The final index root is `6FuPi3fCU2WvM4ekmJRnW8vVHXMhl9cQGKa0UzNSGjI=`.

## Completed archive

The archive was validated on **9 October 2026 at 04:20:31 UTC**, with pagination pinned to vote-chain height **8,547,551**. Every indexed block and leaf was reconciled; the export is marked `complete: true`, with no retrieval or validation errors.

| Measure | Verified result |
| --- | --- |
| Accepted inner casts | 32,598 |
| Successful cast-bearing transaction envelopes | 3,548 |
| Indexed and verified activity blocks | 3,416 |
| Indexed and reconciled commitment leaves | 36,236 |
| First accepted cast | 17 September 2026, 17:16:02.274 UTC |
| Last accepted cast | 29 September 2026, 19:59:36.603 UTC |
| Highest minute | 378 casts, 29 September at 03:31 UTC |
| Highest hour | 2,738 casts, 21 September at 23:00 UTC |
| Nonempty time buckets | 1,469 minutes and 210 hours |

The envelope types are 2,736 single casts, 811 combined delegation-and-cast batches, and one cast batch. The counts and peaks describe accepted protocol activity, without inferring people, choices, or ZEC weight. Nine offline decoder tests pass, covering batch accounting, failed execution, malformed messages, wrong rounds/chains, and UTC boundaries. The activity summary is approximately 1.85 MB; the compact transaction archive is 1.36 MB.

## How the activity archive is rebuilt

The portal's root `scripts/coinholder-activity.py` uses Python's standard library. It reads only the fixed public Zcash Foundation provider and never accesses a wallet or submits transactions.

1. Confirm the finalized round ID and chain ID. Pin pagination to one observed chain height.
2. Retrieve every commitment-index page. Check increasing block heights, contiguous leaf positions, and the final tree's height, leaf count, and root.
3. Fetch raw blocks only at indexed activity heights. Read each block header's UTC timestamp and verify its height and chain ID.
4. Decode the public custom wire format with the pinned [Valar transaction schema](https://github.com/valargroup/vote-sdk/blob/4dbe05aad847513300e632ab1be48ae08662b240/proto/svote/v1/tx.proto). Recognize single casts, cast batches, combined delegation-and-cast batches, and delegations.
5. Compute each transaction's SHA-256 identifier and query `/shielded-vote/v1/tx/{hash}`. Require the expected height and successful execution code before counting it.
6. Reconcile every successfully appended output against the indexed leaves. Following the [batch handlers](https://github.com/valargroup/vote-sdk/blob/4dbe05aad847513300e632ab1be48ae08662b240/x/vote/keeper/msg_server.go#L218), a batch adds its final successor authority commitment and every inner cast commitment. The combined batch omits the initial ephemeral delegation authority commitment.
7. Count transaction envelopes and inner casts separately. Exclude standalone delegation and reveal-share submissions from cast totals. Group accepted casts into UTC minute/hour buckets, overall and by proposal.
8. Save compact results and transaction references. Keep raw proof bytes out of the archive. Mark incomplete block retrieval or reconciliation as partial, with the affected heights recorded; never represent unverified gaps as zero activity.

An example envelope at [block 7,204,640](https://zvote.zfnd.org/cosmos/base/tendermint/v1beta1/blocks/7204640) contains 36 inner casts and produces 37 leaves. Its [successful execution record](https://zvote.zfnd.org/shielded-vote/v1/tx/9011F88057F3585FDF48458AD285E36AC3FC1E8E619702EFB7A3589D812E9E9C) is linked directly. This demonstrates why transactions, commitments, revealed shares, and holders must have distinct labels.

## Public inputs and timestamps

The activity archive and full authenticated dashboard API retain compact transaction references for all 3,548 envelopes, plus decoded details for the latest 50: message type, proposal IDs, vote commitment, commitment-tree anchor height, proof byte length, block height, transaction hash, and official source URL. These records support verification and chart reconstruction; the main dashboard does not render a transaction table or input inspector. A synthetic anchor height of zero is valid inside an atomic batch. Proof size is metadata, not a proof verification result.

The chart timestamp means inclusion in a vote-chain block. It does not establish when a person clicked a wallet control or when a helper first received a request. Public inputs here are voting-protocol fields, not Zcash payment inputs or disclosed wallet addresses. No attempt is made to join commitment records to individual people or reconstruct private weights.

The Valar lifecycle publishes decrypted weighted totals during tally finalization. Public cast activity cannot reconstruct an hourly ZEC-weighted approval series. The final summary's `ballot_count` counts reveal shares; it is not the number of unique voters or the number of cast envelopes. The UI must not substitute those figures for each other.

## Source refresh and delivery

The authenticated `/api/communities/{communityId}/coinholder` endpoint returns the full dashboard by default. Periodic browser checks use `?history=omit`; the response deliberately leaves out the immutable activity archive and sets `activityOmitted: true`. The client retains its existing history only for the same round with that explicit flag. This keeps a source check from repeatedly transferring the roughly 3.21 MB activity payload (about 423 KB compressed). The complete records remain available in the full API response and checked-in archives, with decoded input details retained only for the latest 50 transactions.

The server validates the static history once and checks the fixed finalized-summary endpoints at most once every 60 seconds per process. Concurrent requests share that check, both official mirrors share a six-second deadline, and streamed responses have a 256 KB limit. The response must match the pinned Q3 summary hash, round, finalized status and all 37 published option totals. A failed check retains a dated snapshot and reports it as such; `checkedAt` and `snapshotFetchedAt` are separate. This adapter does not discover future elections or infer live weighted choices from encrypted commitments.

## Reproduce and test

From the portal repository root, choose a cache outside the checkout:

```sh
python3 scripts/coinholder-activity.py --cache /tmp/zdao-coinholder-activity --workers 6
python3 -m unittest discover -s scripts -p 'test_coinholder_activity.py'
```

Output files are `data/coinholder/activity-q3-2026.json` and `data/coinholder/activity-q3-2026-transactions.json`. The cache supports retries without repeatedly downloading already checked proof payloads. The worker count is bounded from one to eight. The export records retrieval time, source URLs, coverage, evidence, and whether the index was fully reconstructed.

These checks reconcile data served by a public provider. They do not independently verify vote-chain validator signatures, consensus, every cryptographic voting proof, or the fairness of the protocol. A matching server response is not a payment receipt.
