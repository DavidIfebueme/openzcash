# Verifiable discussion activity

Updated 13 October 2026 · Production discussion history

Activity batches are an optional worker feature. Read [Automation](participate-automation.md) for configuration and [Deployment](deployment.md) for the isolated wallet boundary.

Comments, proposal likes, comment likes, withdrawals of likes and moderation now create an append-only public event history. Each event can be downloaded and independently checked. Events are collected into separate Zcash anchor batches; the earlier proposal transaction does not cover later discussion.

## Reading and recovery

Expand **Read & verify**, then **Activity & verification**. The compact Comments view keeps verification out of the composer. The same panel appears below the discussion on a standalone proposal page. It is closed by default and does not navigate away from the proposal.

Each event has a receipt, a fingerprint and a verification state. Expand **Verify** for the observed transaction, block time and confirmation count when available. The browser can compare a saved receipt and its included comment text with the displayed fingerprint, entirely on the device. That file comparison does not claim to have checked the blockchain.

Download the standalone verifier and a receipt. With Node.js 22+:

```sh
node activity-verify.mjs activity-EVENT_ID.json --hash EVENT_SHA256
node activity-verify.mjs activity-EVENT_ID.json --hash EVENT_SHA256 --extract-comment recovered-comment.txt
```

The verifier validates exact event bytes, included comment bytes, schema, scope and Merkle inclusion. Extraction uses a new file and refuses overwrites. The expected fingerprint should come from a copy or source you trust. A matching file alone does not prove authorship or chain inclusion.

Once a receipt includes chain evidence, add `--chain` and configure `ARCHIVE_READER_RPC_URL` and `ARCHIVE_CHAIN_RPC_URL` for your own Zallet reader and validating node. Optional RPC user/password environment variables remain private. The receipt supplies the intentionally public viewing key, receiver, receiver index, birthday and pinned wallet version. The independent observer checks the decoded memo, canonical block and confirmation policy. An offline command reports `NOT_CHECKED` for current blockchain state.

Keep the receipts and comment files: the blockchain cannot recover bytes that no one retains.

## Public event format

`PARTICIPATE_EVENT_V1` binds the record and community, the current proposal manifest fingerprint, a random per-proposal actor ID, event ID, sequence number, previous event hash, occurrence time, recording time and action. JSON uses the archive canonical encoding: sorted object keys, UTF-8 and a final newline.

| Action | Committed fields |
| --- | --- |
| `COMMENT_POSTED` | Comment ID, parent ID and SHA-256 of exact comment text |
| `COMMENT_EDITED` | Comment ID, version, SHA-256 of exact text and previous version hash |
| `COMMENT_WITHDRAWN` | Comment ID, version and text hash; text stays in historical versions |
| `COMMENT_HIDDEN` | Comment ID and public moderation reason |
| `PROPOSAL_LIKE_SET` | Desired like state |
| `COMMENT_LIKE_SET` | Comment ID, exact version and desired like state; legacy events imply version 1 |
| `DISCUSSION_CLOSED` | Official source, observed verdict, revision and immutable discussion snapshot hash |
| `PROPOSAL_LABELS_SET` | Committee authority, catalog fingerprint, labels version, previous IDs and selected label names/colors/IDs |

Actor mappings to account IDs are private and scoped to one proposal. Public receipts omit email, account IDs, request keys, credit balances, purchase information and authentication material. Actor IDs identify an application participant; they are not an author's cryptographic signature.

Edits append a new version; they never overwrite the original comment or its previous proofs. Likes remain with the version they endorsed, so a new version starts with no inherited likes. Editing and withdrawing do not debit credits. A first like on a new version uses the normal demo-credit cost; idempotent retries and re-likes of that version do not charge again. Author withdrawal replaces the current comment with a tombstone while retaining its text, replies, hashes and earlier versions in public history and receipt downloads. Moderation suppresses text from every public version and receipt instead. Copies downloaded earlier cannot be recalled.

An official source verdict closes a snapshot when it is observed. The snapshot records that observation time separately from the source's update time, the current comment versions, version hashes, like counts and activity-chain head. Later discussion remains possible and produces later events; it cannot change the closed snapshot. This is a source observation, not a committee vote or an assertion that today's comments existed at the source's earlier decision time.

An action, its Zcred debit and its event commit in the same serializable transaction. Failure rolls all three back. Existing request IDs remain idempotent. A new accepted state-setting request may record the same like state again; event counts are not distinct-user, vote or net-like counts. Current like counters retain their existing meaning.

Existing actions are explicitly marked `IMPORTED`, with their original application occurrence time and their new recording time. Import never asserts that they were anchored at their original date. SQL guards reject updates/deletes of events, actor mappings, inclusions and saved checks, enforce hash/sequence/previous-event integrity and bind the proposal revision. A database operator still controls unanchored data; external retained receipts and confirmed commitments supply the independent tamper evidence.

## Batches and proof states

The Merkle algorithm is the existing archive algorithm: unique sorted digests, domain-separated leaves and parents, promoted odd nodes and count-bound proofs. Activity has a separate memo namespace:

```text
PARTICIPATE|ACTIVITY|v1|mainnet|count:N|sha256:ROOT
```

The operator freezes up to 1,000 pending events by default (maximum 10,000). Retrying preparation returns the same unfinished batch. Later events wait for another batch. A frozen batch's inventory, receiver, network and root cannot be changed. Transaction identity can be attached once, after positive observation, and cannot be replaced.

| UI state | Meaning |
| --- | --- |
| Recorded · Not anchored | The application saved the event; no batch inclusion yet. |
| Ready to anchor | The inventory and inclusion proof are prepared; no observed transaction yet. |
| Confirming | The exact commitment is mined but has fewer than the required confirmations. |
| Verified at last check | The observer checked the commitment and canonical block; mainnet requires at least 10 confirmations. |
| Check required | The latest check failed, is inconsistent or is older than 15 minutes. A valid dated receipt may still be downloaded. |

Checks are append-only and only the newest controls the displayed state. A failed later check never resurrects an older green state. The block time is evidence of inclusion by that block, not an exact user-action time or committee endorsement.

## Moderation

Moderation adds a new event and preserves the original comment fingerprint. Hidden text is excluded from current receipt downloads and batch exports; those receipts retain `body: null`. Previously downloaded copies may still contain the text and cannot be recalled. Restoring a hidden comment is not an implemented workflow. Neither likes nor moderation change the historical ZCG decision.

## Production automation

The Participate worker includes `lib/services/activity-automation.ts` when `activityEnabled` is enabled. It collects eligible real-user activity across production records, waits five minutes to coalesce new events, and freezes up to 1,000 events with an individual inclusion path for each. Synthetic seed/preview activity is excluded. The restricted signer independently recomputes the activity root and requires Ironwood. One batch creates one transaction, using the unchanged one-zatoshi archive output, fee cap and shared daily allowance. This sender is separate from the manual historical procedure below.

The durable job preserves its inventory and signer request identity across retries. Once a transaction ID is received it is persisted before observation; unknown outcomes reconcile through the signer journal. Confirmation checks require at least ten canonical confirmations. Errors and retry state are logged, and the operational monitor includes activity queue age and failed/review-required jobs. Exhausting the daily allowance delays the same job without raising the limit or falling back to another pool.

The 13 October release requires `prisma/upgrades/20261013_comment_versions_activity.sql` on top of the existing activity schema. Its append-only guards and version-1 backfill preserve earlier event bytes and receipts. Apply the compatible schema, reader/verifier and signer before enabling the activity worker. Backups must retain versions, closures, events, inclusions and checks as well as the original proposal files.

## Historical manual operator procedure

Back up the database, apply `prisma/upgrades/20261010_archive_activity.sql`, run `prisma generate` and restart existing application processes. The activity migration is additive and assumes the existing archive and discussion migrations.

The manual backfill, prepare, export and check command used for the historical batches is not part of this distribution. `lib/services/archive-activity.ts` and `lib/services/activity-anchors.ts` implement those steps; the worker prepares and checks new activity batches.

Rebuild the distributable verifier after changing its implementation:

```sh
./node_modules/.bin/esbuild scripts/verify-activity.ts --bundle --platform=node --format=esm --target=node22 --outfile=public/verify/activity-verify.mjs
```

The automatic worker described above replaces manual publication for eligible new production activity. Replicated hosted file retention and author-signed events remain future work. No public endpoint can directly trigger signing or spend funds.

## Validation

Targeted suites cover event schema and tampering, domain-separated proofs, public API scope, expandable UI, offline recovery and file overwrite protection. PostgreSQL tests cover transaction rollback, credit debits, concurrent duplicate requests, imported timestamps, immutable SQL guards, frozen batches, exact memo observation, changed transaction rejection, stale/failed proof states and moderated downloads. Browser acceptance covers the real preview receipt download and local fingerprint comparison.

### Author withdrawal

Native pilot publications can append `PROPOSAL_ABANDONED` using an authenticated author account. The public reason and the original manifest fingerprint are part of the canonical event; the event uses a proposal-scoped actor alias and `AUTHOR_ACCOUNT` authority. This records server-checked authorship, not a user-held cryptographic signature. The immutable projection and event commit together. Original files and earlier signatures stay intact; no new review or signature is accepted after abandonment. Imported ZCG source records cannot be withdrawn by demo users.

The event uses the same batch preparation, export, observation and independent verifier as comments/likes. Download the proposal revision and the abandonment receipt separately. No new transaction is sent by the author action; a chain timestamp is claimed only after the batch is submitted and independently confirmed.
