# Public ZCG proposals

Updated October 10, 2026. The public **Proposals** module preserves 20 captured applications alongside five historical ZCG decisions. The latest GitHub label check places 19 applications under review and RobotBase (#439) under Abandoned, following its official withdrawal label. Filters are **All → Under review → Approved → Rejected → Abandoned**. The five historical decisions remain four approved and one rejected.

The local Orchard preview hosts immutable revision packages for these records. Public readers can open **Comments** or **Read & verify** beneath each card without leaving the list. Active permanent accounts can like and comment using the separate ZCG committee credit scope. These interactions do not add committee votes, DAO memberships or treasury entries. See [Proposals and DAO](./proposals-module.md) and [Committee credits](./committee-credits.md).

File verification and blockchain inclusion remain distinct. The newly imported review snapshots are downloadable and locally verifiable, with **Not anchored** status. The [anchoring pilot](./proposal-anchoring-pilot.md) defines the separate chain workflow.

## Under review

The snapshot was checked on **October 10, 2026 at 03:19:20 UTC**, directly against the [official ZCG issue tracker](https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues) and its [open-issue API](https://api.github.com/repos/ZcashCommunityGrants/zcashcommunitygrants/issues?state=open&per_page=100).

Inclusion requires an open issue with both **Grant Application** and **Ready For ZCG Review** labels. Decision, withdrawn, cancelled, vetoed, filtered, completed, milestone or payment labels override a leftover review label and exclude the application. Pull requests, unlabeled submissions and applications to a different program are excluded.

- The checked set contains issues **478, 477, 474, 468, 467, 462, 460, 458, 457, 456, 455, 454, 453, 450, 448, 444, 442, 439, 435 and 386**.
- Dates are GitHub issue creation dates in UTC. Requested USD amounts come from the explicit total-budget field. They are neither disbursements nor ZEC quotes.
- The public GitHub author handle identifies the submitter. Display titles remove form boilerplate. GitHub labels and sector classification have distinct origins, described below. Original applications remain linked.
- Pending applications display **Awaiting committee decision**. They have no support percentage, individual votes or invented committee feedback.
- The source is a dated snapshot, not an automatic feed. GitHub can change after capture; the card links to the current source.

`data/zcg-review-queue.json` holds the checked metadata. `lib/domain/zcg-review.ts` validates source identity and review eligibility. Review packages preserve `proposal.md` and `record.json`, not the full application or its attachments. They use the `REVIEW_SNAPSHOT` manifest kind, a null decision date and an explicit submission timestamp. The existing historical package format and fingerprints remain valid.

Refreshing captured content requires a new immutable revision and an updated source check. Do not overwrite a published revision or rerun changed content under the same revision number.

## GitHub labels and sectors

`data/zcg-source-metadata.json` stores a separate, dated observation of each proposal's exact GitHub issue, original label names, colors and descriptions, and the applicant's Category field. All 25 mappings were checked directly against the official tracker on October 10, 2026. Historical mappings use GraphSense #424, Ironwood #438, SeedSigner #411, Mumbai #405 and Arabia #400. The later $30,000 SeedSigner resubmission (#429) and declined Arabia revision (#380) are not substituted for the captured decisions.

- **GitHub** displays every label on the mapped issue, with its original color and a contrast-checked foreground. This includes leftover review labels on completed/declined records. The source link and checked date make that context inspectable.
- **Sectors** prioritizes the applicant's declared category, then existing curated topics and conservative title-based suggestions, deduplicated and limited to three. The tooltip identifies a declared category versus OpenZcash classification. Unknown categories do not manufacture an official sector.
- **Committee** displays local annotations that are not already present in the GitHub set. Local edits do not write to GitHub or override its labels.

For example, #478 declares **Education** and receives the additional **Events** classification. Terminal source labels override a leftover Ready For ZCG Review label in public-list filters; #439 is therefore shown as withdrawn. Source status alone creates no votes, signatures, abandonment events or payment receipts. Preserved files continue to describe their capture-time state, and the five dated committee decisions retain their original votes and outcomes.

This snapshot changes only through a reviewed manual update. Refreshing metadata does not import additional proposals, modify a stored archive package or refresh the independent pilot review roster. There is no automatic polling or real-time sync.

## Historical decisions

| Example | Meeting | Approve / reject / abstain | Support | Primary source |
| --- | --- | --- | --- | --- |
| GraphSense | September 28, 2026 | 4 / 1 / 0 | 80% | [Minutes, part 1](https://forum.zcashcommunity.com/t/zcash-community-grants-zcg-meeting-minutes-9-28-2026/57928/1) |
| Ironwood verification | September 28, 2026 | 4 / 0 / 1 | 80% | [Minutes, part 2](https://forum.zcashcommunity.com/t/zcash-community-grants-zcg-meeting-minutes-9-28-2026/57928/2) |
| SeedSigner | September 14, 2026 | 0 / 5 / 0 | 0% | [Minutes](https://forum.zcashcommunity.com/t/zcash-community-grants-meeting-minutes-9-14-2026/57615/1) |
| Mumbai | September 14, 2026 | 5 / 0 / 0 | 100% | [Minutes](https://forum.zcashcommunity.com/t/zcash-community-grants-meeting-minutes-9-14-2026/57615/1) |
| Arabia | August 31, 2026 | 3 / 2 / 0 | 60% | [Minutes, part 2](https://forum.zcashcommunity.com/t/zcash-community-grants-meeting-minutes-8-31-2026/57394/2) |

The September 28 attendance note explicitly identifies exceptions to unanimous votes. The September 14 minutes record split votes where applicable; all five positions for the selected proposals are supported by their discussion and decision. Arabia's decision explicitly names the five positions. These are dated decisions, not assertions about the latest grant revision or delivery status.

## Presentation and provenance

- The percentage is approvals divided by all five recorded positions, including abstentions. It does not calculate whether the decision passed; the outcome comes from the minutes. No ZEC weighting is involved.
- Each equal-width segment belongs to the named member below it. Green means approve, red reject and neutral gray abstain. Symbols and accessible labels accompany the colors.
- Hover, keyboard focus or a tap opens feedback. Clicking pins it; Escape, Close, focus leaving the group or clicking outside dismisses it. The source remains reachable inside the popover.
- Feedback is a short editorial paraphrase, labeled as a summary. Paul Brigner's abstention has no published rationale; no explanation is invented. Criticism is attributed to the commenting member.
- Dollar amounts are requests recorded at the meeting, not payments. Dates are meeting dates. Source labels and classified sectors remain separate from these historical outcomes. Proposal titles link to the original forum applications.
- Public profile images are reused from the neighboring OpenZcash project's `public/committee` assets and its [committee directory](https://openzcash.org/zcg/committee). Images are served locally, without third-party avatar requests. They do not create committee member accounts in this application.
- The static source is `lib/data/zcg-proposal-examples.ts`. Updating a record requires checking the linked primary record; there is no automatic import or real-time synchronization.

The committee demo also exposes these five examples under **Reviews → Source decisions**. Its expanded decision panel reads the published outcome, positions and comment summaries from the selected, hash-verified `record.json` archive. It does not reconstruct them from the current pilot roster or reissue the original committee's votes. The linked minutes were rechecked on October 10, 2026; this presentation change leaves all original package hashes and capture dates intact.

## Verification

Coverage checks review eligibility despite stale labels, source identity, requested amounts, pending decision semantics, package tampering, the five historical vote breakdowns, filter order and inline reading. PostgreSQL integration coverage verifies idempotent review publication, guest restrictions and committee comment/like charges without affecting the DAO balance or creating ballots or anchors.

The review increment passed 103 targeted unit/component tests, 12 PostgreSQL integration tests, type checking, scoped lint and a production build. Browser checks covered inline reading and comments, filter separation, both themes and a 390 px mobile viewport without page overflow. A downloaded review package matched its displayed fingerprint using the standalone verifier; chain inclusion was not checked or claimed.

This is a local preview change; it does not deploy the application or enable real payments.
