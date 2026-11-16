# Q3 2026 revealed-share history

The Coinholder history contains **revealed-share counts**, recorded when the voting chain accepts encrypted contributions for an option. It covers all 37 proposals and four options on 13 UTC dates, September 17–29, 2026. These are protocol records, not unique wallets, people, cast messages, ZEC amounts, or a running approval percentage. The share values remain encrypted; only the final option weights are available in plaintext.

The series is calculated from differences between archived `VoteSummary` counters at consecutive UTC day boundaries. Each cutoff is bracketed by consecutive block headers: the selected state is at the last block strictly before midnight. No interpolation or redistribution of the final ZEC weights is used. The first date is partial: coverage starts at round creation, **September 17 at 16:02:10.970368514 UTC**, although the daily bucket is labelled September 17. The final cutoff is **September 30 at 00:00 UTC**; the preceding state was already finalized.

## Verified totals

| Option | Revealed shares |
| --- | ---: |
| Accept | 76,874 |
| Reject | 47,116 |
| Reject with lower amount | 7,448 |
| Abstain | 14,182 |
| **Total across 37 proposals** | **145,620** |

The highest daily total is **24,075** on September 29. Every one of the 148 final option counters matches the pinned official summary. Summing the daily differences reproduces every final counter exactly. The source reconstruction also checked the final decrypted weights against the official summary before removing weight fields from this history artifact.

`ballot_count` is incremented once for each accepted share reveal. Shares can carry different weights, including zero. A cast commits 16 share slots, but the historical client supports a mode that submits one share containing the full weight and omits 15 zero-valued shares. Fewer than 16 reveals per cast therefore does not establish failed delivery, and neither share totals nor cast totals establish wallet participation. The timestamps here describe inclusion of reveals in chain state, not the earlier cast or a wallet interaction.

## Files and provenance

- `data/coinholder/q3-2026-reveals.json`: the daily archive, including boundary headers and state references.
- `data/coinholder/q3-2026-summary.json`: the canonical finalized summary.
- `data/coinholder/activity-q3-2026-transactions.json`: cast timestamps used only to narrow header searches during regeneration.
- `scripts/coinholder-reveals.py` (portal repository root): standard-library-only reconstruction and offline consistency checks; requires Python 3.9 or later.

Round: `2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01` on `zvote-1`.

The original daily archive captured at **2026-10-09T05:06:55Z** has SHA-256:

```text
7adf00dd1e382eba36ff8df593e5360d281f1d301464cc651564ffa371c48335
```

The exact official summary bytes have SHA-256:

```text
9b858326b8149de92ea6788314a714b521fb2f57215e3742ec9b35b67c6639b5
```

The baseline is block **7,201,411**, with zero counters. The final daily boundary is bracketed by blocks **7,973,481** (`2026-09-29T23:59:59.518735937Z`) and **7,973,482** (`2026-09-30T00:00:00.888180913Z`). The independent final-state comparison is pinned to height **8,550,050**. Regeneration keeps those historical heights and counts, but changes `fetchedAt` and `networkRequestsThisRun`, so a newly generated file will normally have a different byte hash. Replacing the pinned application artifact also requires reviewing and updating any application integrity pin.

## Reproduce and verify

From the portal repository root, verify the committed artifact against the pinned summary without network requests or writes:

```sh
python3 scripts/coinholder-reveals.py --verify-only
```

To regenerate from the fixed public archive provider:

```sh
python3 scripts/coinholder-reveals.py --workers 2
python3 scripts/coinholder-reveals.py --verify-only
```

Default input/output paths resolve relative to the repository, regardless of the caller's working directory. The response cache defaults to a sibling directory, `../coinholder-reveal-cache`, outside the repository. Override paths explicitly when needed:

```sh
python3 scripts/coinholder-reveals.py --cache ../coinholder-reveal-cache --output ../q3-2026-reveals-regenerated.json --workers 2
python3 scripts/coinholder-reveals.py --verify-only --output ../q3-2026-reveals-regenerated.json
```

`--summary` and `--activity` select alternative local copies of the pinned inputs. `--cast-cache` optionally adds a directory of compact block records to improve the header-search brackets. Cast hints never determine the daily counts: the script checks adjacent archive headers and historical state for each resulting cutoff. There are at most four workers, a 260-request budget, response-size limits, bounded retries, and atomic file writes. No transactions are submitted and complete reveal proofs are not downloaded.

Offline verification checks the round, chain, units, all proposal/option records, nonnegative integer counts, ordered UTC dates, adjacent boundary heights/timestamps, daily differences, cumulative totals, and exact final counters. It does not re-fetch or independently authenticate the archived provider responses. Regeneration decodes the archived protobuf responses and compares all final counts and weights before writing an artifact.

## Evidence and limits

The [official deployment workflow](https://github.com/valargroup/vote-sdk/blob/4dbe05aad847513300e632ab1be48ae08662b240/.github/workflows/sdk-chain-deploy.yml) identifies the public [archive RPC](https://prod.explorer-rpc.valargroup.org/status). Historical state is queried using `/svote.v1.Query/VoteSummary` at fixed heights; the [final official summary](https://zvote.zfnd.org/shielded-vote/v1/vote-summary/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01) supplies the reconciliation target. The [pre-Q3 tally implementation](https://github.com/valargroup/vote-sdk/blob/1ac136c7e177b94cc7a6e436cbea37d4e3a391aa/x/vote/keeper/keeper_tally.go#L135) defines the counters; the [historical client](https://github.com/valargroup/zcash_voting/blob/b3c52d3cef0996115dbd68b7a6861d6ef5062557/zcash_voting/src/vote_commitment.rs#L38) documents single-share submission.

This is reconciliation against public provider responses. Consensus signatures, zero-knowledge proofs, threshold-decryption proofs, and cryptographic historical state proofs have not been independently verified. The archive uses `prove=false`. The exact historical client build used by each participant is unknown. This artifact supports **daily per-option counts and cumulative counts**; it does not provide intraday reveal timestamps, weighted approval history, or a mapping from a reveal to a particular cast or wallet.
