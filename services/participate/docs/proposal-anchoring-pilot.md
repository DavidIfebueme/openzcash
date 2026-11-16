# Proposal anchoring and recovery pilot

10 October 2026 · Participate · Local demo, real Zcash mainnet transaction

## What is preserved

The pilot preserves **25 immutable records**: five historical ZCG decision summaries and 20 application metadata snapshots from the review queue. Packages contain exact files, provenance, capture time, source links and SHA-256 fingerprints.

These are snapshots, not complete original applications. External attachments and later comments are not included unless listed in the committed inventory. Imported committee feedback is source material, not a new vote or an author's signature.

Mainnet transaction: `1bb7383043cab4d72b7129b5e5bdc7441ac7c073af59679bb91403216b795bf1`.

It commits all 25 records through this Merkle root:

```text
563d2af21845dfc7680ce1d58313c91588cf8b500837f396151104c6c0035bce
```

The execution fee was **30,000 zatoshis (0.0003 ZEC)**. A one-zatoshi output went to a separate public archive account owned by the same operator. The application's mainnet writer remains disabled; a bounded operator process created, reviewed, signed and broadcast this transaction.

Confirmation evidence is in `latest-chain-check.json` and per-record receipts. A transaction ID alone is not a verified timestamp. The [implementation scope](./implementation-status.md) separates this archival run from paid purchases, native author submission and production deployment.

## Relationship to Decred

[dcrtime](https://docs.decred.org/advanced/dcrtime/) batches document digests in a Merkle tree and anchors its root in a transaction. Each record has an inclusion path; document bytes stay outside the blockchain.

This pilot uses that architecture on Zcash with its own formats. It is not dcrtime wire-format compatibility or Politeia's complete signed record system. Zcash shielded memos require a dedicated, intentionally public viewing key so another reader can recover the exact commitment. An explorer transaction page alone cannot demonstrate the memo.

## Commitment format

Each `.zvoice.json` package contains a canonical UTF-8 JSON manifest and base64 files. Legacy format identifiers are retained so immutable revisions keep their original hashes.

1. Verify every file's path, size, MIME type and SHA-256 against the manifest.
2. Hash the canonical manifest bytes to obtain its digest.
3. Sort unique 32-byte manifest digests lexicographically.
4. Compute leaves as SHA-256(`0x00 || digest`).
5. Compute parents as SHA-256(`0x01 || left || right`); promote an unpaired node unchanged.
6. Commit the root and record count in this memo:

```text
PARTICIPATE|ARCHIVE|v1|mainnet|count:25|sha256:563d2af21845dfc7680ce1d58313c91588cf8b500837f396151104c6c0035bce
```

Each `PARTICIPATE_MERKLE_V1` proof contains root, leaf count, leaf index and siblings. Verification derives sibling positions from the index and tree width and rejects missing, extra or inconsistent steps. The memo binds the count and root. Legacy single-record memos remain supported.

Receipts accompany committed content; including a future transaction ID in its own content hash would create a circular dependency. ZIP files are delivery containers. Verification uses the manifest and exact file bytes.

## Recover without the website

On a proposal, expand **Read & verify → Files & verification → Recover & verify independently**. Download the revision, chain receipt, recovery guide and standalone verifier.

With Node.js 22 or later:

```sh
node archive-verify.mjs RECORD-r1.zvoice.json --hash MANIFEST_SHA256 --receipt RECORD-r1-verification.json --extract recovered-record
```

Use the exact filename and digest in the downloaded guide. This offline command verifies all contents and the Merkle path, then restores `manifest.json` and `files/` into a **new** directory. Open `files/proposal.md`. Existing directories are never overwritten. Altered contents fail before extraction.

`MATCHED` and `INCLUSION_PATH_MATCHED` do not check the chain. Add `--txid` using your own Zallet reader and validating node, as described in the guide. The standalone verifier requires no application server or database.

Keep the package. The blockchain preserves a commitment; it cannot recreate lost document bytes.

## Independent Zcash verification

The pilot pins **Zallet 0.1.0-beta.3** and uses a separate reader with no seed or spending keys. Its deliberately public Sapling key is in each recovery guide and `public-reader.json`. Collector keys and RPC credentials remain private on the node.

The observer:

- Imports the pinned public key with `whenkeyisnew`, which rejects an account with known spending authority.
- Binds the imported key's default address to its reader account, then independently derives the published receiver at index **4608934267**.
- Reads the exact transaction and requires the decoded receiving output and padded memo.
- Checks a synchronized, recent mainnet node, block membership, canonical block hashes and a reader tip covering that block.
- Rechecks the chain before saving evidence and requires **10 confirmations** for the verified state.

A positive decoded-output proof does not require unrelated historical balance recovery to finish. It requires the reader to know the transaction and cover its block. It certifies no wallet balance, absence of payments or spending eligibility; those synchronization gates remain separate.

Receipts contain network, transaction, pool/output index, receiver, memo, block hash/height/time, observed tip, confirmation depth, public reader configuration and check time. Unknown/private fields are stripped.

The block time is an inclusion timestamp, not an exact wall-clock notarization, original submission time, committee endorsement, author signature or grant payment.

## Operator workflow

Frozen export: `work/zebra-operations/mainnet-pilot/participate-20261010/`.

Its collection binds all record IDs, revision IDs, filenames and hashes. Preparing records sends no funds. The pilot's export and anchoring commands are not part of this distribution; `lib/services/archive-anchors.ts` implements preparation and checks.

Apply both archive SQL upgrades to a backed-up database and regenerate Prisma first. The Merkle upgrade adds an immutable commitment field. Restart an existing development server after generation.

The private operator journal persists prepare → prove → sign → extract → broadcast. The fee cap is 50,000 zatoshis; exact fee, recipient, memo, change ownership, network and expiry are checked. Unknown signing, extraction or broadcast outcomes require reconciliation of the same transaction, never another automatic payment.

An evidence refresh for the **existing** transaction keeps credentials remote. It validates all packages and proofs, observes the chain once and atomically stores the same bound evidence for the batch. Same-transaction rechecks are idempotent; conflicting transactions or commitments are rejected.

The optional `work/zebra-operations/verify-public-archive.py` wrapper runs the downloaded standalone verifier through a temporary loopback bridge to permitted public-reader and node RPC methods. It uses no application database and exports no RPC credentials.

## Proof states and limits

Preparation, broadcast, confirming and verified observations are distinct. Failed later checks supersede a green state. After 15 minutes the UI requests a fresh check, retaining the dated receipt for independent verification. Orphaned or mismatched transactions cannot produce verified evidence.

This is real mainnet, authorized as a low-cost pilot. Mocked tests are not described as testnet publication. Local browser acceptance and mainnet confirmation do not imply deployment.

Comments, likes and moderation now have a separate [verifiable activity history and batch workflow](./participate-activity.md). The proposal batch above does not commit later discussions. An activity receipt marked prepared is not a confirmed blockchain record. Demo Zcred, paid purchases, author signatures, durable hosted mirrors and production operations retain their own acceptance boundaries.
