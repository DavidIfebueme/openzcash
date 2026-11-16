# Ironwood-only automatic anchors

The worker requires `pool: "ironwood"` before discovery or dispatch. Every signer request names that pool, and a broadcast acknowledgment must name it too. The isolated signer validates the transaction structure independently; a receiver name or wallet label alone does not establish which pool was used. The reader and standalone proof verifier check the exact Ironwood memo/action and canonical inclusion.

An omitted pool remains **legacy Sapling for reading**, never permission to spend. Old proposal packages, hashes, receipts, anchor IDs and transaction IDs remain unchanged. Native demo submissions remain excluded from official-source automation.

## Controlled cutover

1. Stop the worker timer, wait for the active worker to finish, and disable the isolated signer. Keep its journal and the database queue intact.
2. Retain the old public reader JSON. Provision the new Ironwood receiving account/address and its separately imported view-only reader. Check the published viewing key, receiver index and derived Orchard receiver used by Ironwood. The reader must have no spending keys.
3. Update the private automation configuration so `publicReaderPath` points at the new explicit Ironwood public configuration. Add `legacyPublicReaderPath` pointing at the unchanged Sapling public configuration if old automated jobs exist. The isolated reader must hold both view-only keys. Keep the original `startedAt` exactly unchanged.
4. Migrate the stored policy with `migrateParticipateAutomationToIronwood` in `lib/services/participate-automation-policy.ts`; this distribution ships no command for it. Run it first as a dry run (`apply` false): it returns the current and proposed policy hashes and the count of legacy jobs, and never connects to the signer. Confirm the selected database, keep recovery copies separate, then apply it with the reviewed previous policy hash.

   The migration uses the same PostgreSQL advisory lock as the worker. It compares the current hash, scope and original start time. The legacy reader must reproduce the previous policy hash, including its exact public viewing key, derivation index and confirmation requirement; matching only its receiver is insufficient. Only `policyHash` changes; the discovery cursor, polling checkpoint and all proposal records are preserved. The policy update and append-only migration log commit together. Repeating the same successful request is idempotent. Missing/mismatched configuration, concurrent work or unresolved signing intent blocks the migration with a controlled error code.
5. Validate the deployed signer, independent reader and retained historical receipts before enabling the signer and timer. Record the first actual Ironwood transaction, canonical block, required confirmations and independently recovered files before claiming live completion. No synthetic proposal or replacement transaction is authorized by the migration.

## Existing automated transactions

Jobs in `CAPTURED`, `PREPARED` or `DISPATCHED`, or jobs without a persisted transaction and matching anchor, block the cutover. Reconcile their existing signer journal first; never clear it or generate a new transaction to make migration pass.

`CONFIRMING` and `VERIFIED` jobs may cross the cutover only if their exact persisted anchor matches the explicit legacy reader. A quarantined job with `TRANSACTION_EXPIRED` may also be retained unchanged. After cutover, a job with a transaction ID goes straight to read-only verification through the reader matching its stored receiver. It never prepares an anchor or contacts the signing transport again.

The wallet's `expired` status is not authoritative evidence that a transaction failed to mine. During reader backfill, that status can be stale. For a non-mined wallet status, the observer asks Zebra for `getrawtransaction(txid, 1)` and accepts only positive mined inclusion that passes the same canonical block membership, reader-tip, exact memo and final reorganization checks. If node inclusion cannot be established, the result is retryable `READER_SYNCING`; the wallet status alone never triggers quarantine or replacement.

The signer's expiry guard is separate. Before signing or broadcasting an unrecognized transaction, it compares the journal's actual expiry height with the synchronized chain tip and requires more than three blocks of margin. Its `TRANSACTION_EXPIRED` refusal preserves the original journal/intent as `NEEDS_REVIEW`, including transactions already inside that safety margin. A lost broadcast response is first reconciled against the saved txid on the node, so an already-known transaction is not rejected merely because its expiry height has since passed. Already quarantined jobs require explicit operator reconciliation; they are not automatically reset or replaced.

Manual historical archives are not automation jobs and are not rewritten by this migration. They retain their original pool-specific receipts and verification path.

## Logs and refusal behavior

- `AUTOMATION_IRONWOOD_REQUIRED`: configuration is legacy Sapling or does not explicitly select Ironwood; no discovery or signing occurs.
- `AUTOMATION_POLICY_CHANGED`: edited receiver, reader, wallet version, birthday or confirmation policy does not match the pinned policy; an operator must inspect the change.
- `automation_policy_migrated`: previous/new policy hashes, retained legacy-job count and unchanged discovery dates. No credentials or viewing-key values are logged.
- `automation_policy_migration_blocked`: a controlled reason identifies a checkpoint/hash mismatch, busy worker, unresolved signing intent or mismatched legacy reader.
- `SIGNER_RESPONSE_MISMATCH`: the signer did not explicitly acknowledge an Ironwood broadcast; the job is quarantined, never automatically resent.
- `AUTOMATION_LEGACY_POLICY_MISMATCH`: the retained public reader does not reproduce the original pinned policy; migration does not alter the checkpoint or queue.
- `READER_SYNCING`: the independent reader or positive node-inclusion evidence is not ready; verification retries without a new transaction.
- `TRANSACTION_EXPIRED`: the signer's journal expiry guard refused a signing/broadcast step. The intent is retained for operator review; this code is not inferred from stale wallet transaction status.

Rollback means stopping signing and diagnosing the recorded policy and journals. It does not mean reverting the queue, resetting the cursor or silently restoring Sapling spending.
