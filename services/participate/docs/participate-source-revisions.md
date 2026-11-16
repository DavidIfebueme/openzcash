# Official GitHub decisions and status revisions

This document describes the source-revision implementation introduced on 12 October 2026. The deployment, first production cycle and subsequent historical catch-up are recorded below. The catch-up validated a new official approval through a confirmed Ironwood receipt.

## What creates a revision

The worker reads only the official `ZcashCommunityGrants/zcashcommunitygrants` repository. A new application must be open and have no terminal workflow labels. Since the 13 October intake correction, a populated official application form with a grant-application title/application label can enter before the committee adds its ready-for-review label; already triaged applications retain their established path. See [initial intake and bounded recovery](participate-automation.md#automatic-flow). Once an application is an identified official archive, it remains tracked when its labels or state change, including approval, rejection, withdrawal, closing and reopening.

For each source, the latest durable captured or imported revision is the predecessor. A meaningful changed observation creates one new immutable job and one new archive revision. The new manifest includes the predecessor's exact hash. Old files, manifests, evidence checks and transactions are never rewritten. The uniqueness key is `(hostId, issueNumber, revision)`; it is not a unique content fingerprint across the whole history.

The V2 observation fingerprint covers:

- The official issue identity, open/closed state and state reason.
- Exact label names, colors and descriptions in deterministic order.
- Preserved `labeled`, `unlabeled`, `closed` and `reopened` events with event IDs, dates and attributed actors.
- Source comments whose GitHub association is `OWNER`, `MEMBER` or `COLLABORATOR`, including their exact body, comment ID, author identity, URL and creation/edit dates.

Capture time, `issue.updated_at` alone, title/body-only edits, unrelated events and ordinary public replies do not change the fingerprint. Their presence cannot by itself enqueue an automatic spend. When another meaningful source change does create a revision, that revision preserves the complete current application Markdown, including any intervening edits.

Comparison is always with the latest observation. An A → B → A reversion is a new revision, even if the final labels match an older snapshot. Event history also preserves rapid transitions that occur between polls. Several events can appear in one observation and one revision; this is not a webhook or a promise of a separate transaction for each GitHub click.

## What the evidence means

The preserved outcome comes from explicit official workflow labels. `✅ Grant Approved` or `✔️ Grant Complete` establishes an approved source observation. `❌ Grant Declined` or `❌ Grant Rejected` establishes a rejected source observation. Withdrawal/cancellation labels establish abandonment. **Closing an issue alone does not establish rejection.** Contradictory approval and rejection labels do not produce an asserted verdict; the displayed outcome is closed and the original evidence remains available.

Repository association establishes how GitHub attributed a comment at capture time. It is not proof that its author is one of the five committee members, a cryptographic signature, or an individual vote. The importer does not infer a vote from prose and does not create a `SignedDecisionRound`. These observations remain separate from the protected Participate committee workflow and the five earlier editorial decision summaries.

The capture contains exact source URLs and timestamps, but does not cryptographically authenticate GitHub itself. The blockchain commitment establishes that these particular captured files match a dated anchor. It does not prove that every statement in those files is correct. Linked attachments and external forum discussions are not copied into this package.

## Scope and historical compatibility

Canonical official records use `zcg-github-N`. The five original editorial record IDs retain their identity through explicit bindings in `lib/archive/source-identity.ts`:

| Preserved record | Official GitHub issue |
| --- | --- |
| `zcg-graphsense-2026-09-28` | `424` |
| `zcg-ironwood-2026-09-28` | `438` |
| `zcg-seedsigner-2026-09-14` | `411` |
| `zcg-mumbai-2026-09-14` | `405` |
| `zcg-arabia-2026-08-31` | `400` |

For the original historical revision, the binding also requires the preserved forum URL to match. All five URLs were checked against the local immutable r1 packages; their issue numbers also match the existing source metadata. Runtime identity does not come from editable labels, a user-submitted link, a title match or demo data. Ambiguous archive identities fail closed and produce a controlled error.

`PARTICIPATE_SOURCE_CAPTURE_V1`, `REVIEW_SNAPSHOT` and `HISTORICAL_SUMMARY` remain verifiable. V2 keeps the existing `SOURCE_PROPOSAL` manifest kind and adds source evidence and its observation fingerprint inside `source.json`. A legacy record becomes a V2 revision only when its observed status/labels change or relevant evidence is newer than its captured date. Existing editorial summaries compare their recorded outcome and evidence dates. Format migration alone does not create a new anchor.

Native public-demo proposals, comments, likes and committee annotations never establish official-source identity. A demo proposal linking an official issue neither suppresses its official import nor becomes eligible for automatic mainnet spending. Coinholder and other repositories remain outside this worker's source scope.

## Discovery, reconciliation and capture consistency

Normal discovery runs at most once every five minutes. It requests `state=all`, sorts by update time, uses a ten-minute overlap and advances its durable cursor only after the window succeeds. Unknown issues still require the normal new-application eligibility rules. The configured activation date is unchanged.

Known archives also enter a bounded reconciliation queue. With a read-only GitHub token, at most two due sources are reconciled per discovery cycle. Without one, at most one is attempted per fifteen minutes. An archive is due if never checked by this scanner or its last check is older than an hour. A full scan can therefore take longer than an hour, especially without a token. This path detects changes missed by the former one-shot intake and associated comment edits/deletions that do not bump `issue.updated_at`.

The evidence reader uses fixed repository endpoints, serial pagination, response size limits, timeouts and `redirect: error`. It never follows upstream pagination URLs. Relevant event/comment IDs and URLs must match their prescribed origin, and evidence dates must fall between issue creation and capture. The worker fetches evidence, rereads the issue and refuses a capture if the issue changed during that operation. A truncated, oversized, malformed or failed evidence response cannot produce a partial anchor.

## Reconcile selected existing sources

`reconcileOfficialSourceRevisions` and `captureSelectedOfficialProposals` in `lib/services/participate-source-revisions.ts` reconcile **one to ten unique positive GitHub issue numbers** without waiting for the periodic scan; this distribution ships no command for them. Reconciliation accepts only targets already recognized through an immutable official archive or captured official job in the configured pilot scope; the intake variant fetches selected issues from the fixed official repository with the same eligibility checks as automatic discovery. Both only capture and enqueue eligible revisions. The normal worker imports, signs and verifies them with its existing Ironwood requirement, fee ceiling, daily budget and signer journal.

Inspect `source_revision_captured` for the new revision number, manifest hash and predecessor hash, then `source_target_reconciliation_completed` for the attempt summary. `source_target_reconciliation_failed` records the selected issue and a controlled error code. Independent valid captures can remain queued if another selected source fails; rerun the same selection after resolving the failure rather than deleting captured jobs. These administrative events are separate from `source_reconciliation_completed`, so they do not consume or reset the periodic scanner's reconciliation timestamp.

After queueing, follow the normal `anchor_broadcast`, `anchor_confirming` and `anchor_verified` lifecycle. Investigate `anchor_needs_review` before further operator action; do not reset its state, change its frozen package or retry an ambiguous spend manually. Complete acceptance requires the real Ironwood receipt, canonical block and ten confirmations, package recovery and an unchanged original revision. An enqueued job or a broadcast transaction alone does not complete that check.

The targeted reconciliation addition passed **52/52 disposable PostgreSQL integration tests** on 12 October 2026: 30 source-update tests and 22 automation tests. Coverage includes selected approval revision two, unchanged-repeat deduplication, whole-selection rejection when one target is unknown, native demo exclusion, ID and ten-target validation, exactly three selected changes without scanning a fourth archive, safe failure logs, and preservation of the normal cursor and periodic reconciliation budget. TypeScript, scoped lint and diff checks passed. These tests use a simulated signer and make no claim of a real confirmed Ironwood transaction.

```sh
# Requires the dedicated disposable TREASURY_TEST_DATABASE_URL; never use production.
npx vitest run tests/integration/participate-source-updates-postgres.test.ts tests/integration/participate-automation-postgres.test.ts
```

## Durable queue and failure behavior

The job freezes the package, manifest hash, source fingerprint, issue identity and revision. The checkpoint and capture log are committed with the job. A newly observed change can queue behind a captured predecessor that has not yet been imported. Import waits for the previous revision and checks its hash before appending the next one.

The existing PostgreSQL worker lock, append-only history guards and isolated signer journal remain in use. Preparing and dispatching an anchor uses the exact frozen revision and Merkle root. A timeout or restart retries/reconciles the same signing intent; it does not replace the capture with the latest GitHub content. An existing txid is verification-only, including historical Sapling jobs.

New automatic signing requires Ironwood in both configuration and the signer acknowledgment. The independent reader verifies the memo and canonical chain inclusion. Ten confirmations are required for a verified receipt. The node still limits each new transaction to 50,000 zatoshis in fees plus one zatoshi to the pinned archive receiver, and reserves at most ten transactions per UTC day. This release does not change the wallet, destination, policy hash, fee cap or daily budget.

Malformed unknown candidates are quarantined with `SOURCE_CANDIDATE_INVALID`; valid candidates can continue. Other capture failures are logged against the issue and keep the discovery cursor for retry. Independent valid captures can still commit before the failed window is retried; latest-revision comparison prevents duplicate jobs. Rate limits and an unavailable source stop further requests and use backoff. No error log contains tokens, wallet credentials, raw RPC errors or comment contents.

| Event | Meaning |
| --- | --- |
| `proposal_captured` | First official source revision queued. |
| `source_revision_captured` | Changed official observation queued with revision and predecessor hash. |
| `source_candidate_quarantined` | Malformed new source skipped with a controlled code. |
| `source_capture_failed` | Changed source capture failed; window needs retry. |
| `source_reconciliation_completed` | Bounded known-source scan attempted; inspect its attempted/reconciled counts. |
| `source_reconciliation_failed` | Known-source reconciliation failed. |
| `source_target_reconciliation_completed` | Administrative selected-source scan ended; inspect queued/reconciled counts. |
| `source_target_reconciliation_failed` | A selected official source failed to reconcile; inspect the controlled code. |
| `anchor_waiting_for_predecessor` | Earlier revision must be imported first. |
| `anchor_broadcast` / `anchor_confirming` / `anchor_verified` | Separate transaction lifecycle observations. |
| `anchor_retry_scheduled` / `anchor_needs_review` | Retryable delay or an ambiguous/integrity condition needing operator review. |

`source_reconciliation_completed` reports the end of an attempted scan; it is not an assertion that every attempt succeeded or that any transaction was sent. The existing operational monitor observes discovery failures and queue state.
