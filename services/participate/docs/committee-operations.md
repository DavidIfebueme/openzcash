# Committee operations

Service reference · November 2026 source distribution

Committee operations are disabled by default. A shared demo account cannot appoint members or sign decisions. The authorized administrator preview is read-only; enabling a real committee requires the steps below.

The authenticated account menu now opens **Committee workspace** at `/participate/committee`, inside the OpenZcash integration. Public browsing and the source-based ZCG Committee directory remain unchanged. The pilot does not appoint official ZCG representatives or replace published ZCG decisions.

## Roles and operating flow

| Role | Team access | Open reviews | Sign a decision | Moderate discussion |
| --- | --- | --- | --- | --- |
| Owner | Invite, revoke, change non-owner roles/access | Yes | Yes | Yes |
| Coordinator | No | Yes | Yes | Yes |
| Reviewer | No | No | Yes | No |
| Moderator | No | No | No | Yes |

Coordinator is stored as `MANAGER`. Reviewer and moderator memberships are restricted to `COMMITTEE` workspaces, including by a database trigger. Existing DAO management and membership rules stay separate. Owners cannot remove or demote themselves or another owner in this interface. Real ownership recovery/transfer requires an independently authorized operator procedure.

1. An owner creates a seven-day invitation for a specific email and role, then copies and shares its link. **Creating an invitation does not send email.** An opaque invitation ID never grants access by itself.
2. The recipient signs in with the invited email through the existing email-code flow, accepts the invitation, and chooses a public reviewer name. Consent explicitly covers publishing the name alongside signed choices and feedback.
3. Each voting member enrolls a personal passkey. Members shows email verification and passkey readiness. Moderators do not count toward quorum or block opening because they have no passkey.
4. Reviews lists native pilot submissions and captured review applications, with separate filters for pending personal decisions, completed pilot reviews and imported historical records. Source data remains a dated snapshot.
5. The owner/coordinator reads the proposal and opens a review on its exact revision. The roster, allowed keys and rules are frozen. New committee reviews have no deadline.
6. Each reviewer signs **Approve**, **Reject** or **Abstain** plus a public reason of 10–4,000 characters. The reason is part of the WebAuthn challenge. It cannot be silently substituted, removed or edited after signing. Decision feedback uses no Zcred; ordinary discussion retains its separate participation policy.
7. The result stays Open until all five members respond, even after three approvals or three rejections. After the fifth response, the same queue shows Approved with three or more approvals, otherwise Rejected. Abstentions count as responses, not approvals. Downloading the public receipt and verifier checks the exact proposal, every included decision and its reason, and the declared rules. Historical timed rounds preserve their original behavior.

Each review expands directly beneath its queue row, with **Decision**, **Discussion**, **Proposal** and **Labels** views. Discussion and proposal files stay inside the workspace. A moderator can hide a discussion comment only with a public reason; the existing activity journal retains the event. Hiding a discussion comment does not remove a signed decision or its rationale. Reviewer avatars are current opted-in profile images, not a proof of identity or part of the signed receipt.

### Source decisions

**Reviews → Source decisions** shows the five historical ZCG examples: four approved and one rejected, newest meeting first. Each row displays the published outcome and meeting date. **View decision** expands the five members' votes, local public profile images and concise summaries of their published comments, with links to the meeting minutes and original proposal. Paul Brigner's Ironwood abstention explicitly notes the absence of a published rationale. Comments were checked against the linked minutes again on October 10, 2026.

The service reads these details from `record.json` in the selected immutable archive revision after checking its pinned manifest and file hashes. The record identity, decision date, five unique member positions and source URLs must match that revision. Unavailable or invalid details produce an explicit unavailable state; the interface does not substitute sample feedback. The original packages and capture dates are unchanged.

Historical feedback is read-only source material. **Community** opens ordinary discussion separately, and **Proposal** keeps the preserved files and verification tools accessible inline. This view creates no accounts for the original committee, no new signatures, no credit charges and no new on-chain record. New pilot reviews continue under **To review**, **For me** and **Decided**, with their own roster and receipts.

## Defaults, history and privacy

Rules is an informational view. New committee rounds require exactly five voting members, all five signed responses, and three approvals from the full roster (60%). There is no duration setting or deadline. Abstentions count as responses but never lower the three-approval requirement. The complete-response requirement was selected by the user for the pilot; the current [ZCG process](https://zcashcommunitygrants.org/selection/) documents the approval majority of three of five. Existing rounds never change when defaults or committee membership change. Removing someone ends private workspace access and future eligibility; their eligibility in an already-open round remains frozen, as disclosed before changing access. Disabling the underlying account or revoking its frozen key blocks new signatures without erasing old signatures.

Committee history records invitations, acceptance, membership changes with reasons, defaults, round opening and signed choices. Events are append-only and hash-linked in PostgreSQL, with paginated read access. This is a private application audit, not an independently witnessed or blockchain-anchored log. Discussion moderation retains its proposal-scoped public activity journal.

Only the owner and the account itself see a member’s email. Only the owner sees all invitations; a recipient sees their own eligible invitation. Global `ADMIN`, DAO leadership and a manipulated client scope do not grant committee powers. The API resolves the governing committee from the configured archive host. Shared demo profiles cannot change access, open/sign reviews or view private invitation emails/history.

Mutation routes enforce permanent authentication, the exact application origin, bounded JSON, strict input schemas, active scoped permissions and verified non-demo accounts. Team mutations are serialized against review opening. Invites are email-bound, expiring, revocable and single-use. Concurrent acceptance produces one membership. Owner revocation invalidates their unaccepted invitations. Optimistic versions prevent stale member/default updates; limits cap invitation and mutation volume.

## Local upgrade and first personal owner

Apply `prisma/upgrades/20261010_committee_operations.sql`, regenerate Prisma and restart the service. The upgrade adds two role values, membership public name/version, invitations, defaults and audit tables. It preserves existing proposal packages, signatures, balances and transactions. Fresh installations must use [the SQL baseline](database.md), which includes those SQL-only protections.

Configure the verified email sender and the final service origin, then have the intended first owner sign in personally. First-owner setup is `bootstrapCommitteeOwner` in `lib/services/committee-bootstrap.ts`; this distribution ships no command for it. It is a dry run unless `apply` is true; run it against the intended environment's database only after checking that environment and account. It creates no account, bypasses no email verification and replaces no existing personal owner. It initializes the first owner and retires shared demo seats so they cannot enter a real review roster. It records the transition in the audit log. It is not an HTTP endpoint and is not invoked during demo sign-in.

## Receipt compatibility and release boundaries

New committee rounds use `PARTICIPATE_DECISION_ROUND_V4`, binding `ZCG_MAJORITY`, `FULL_ROSTER`, five members, all five responses, the 3/5 approval rule and no deadline into the manifest hash. They require `PARTICIPATE_DECISION_SIGNATURE_V2` with a signed `rationale`. New DAO reviews keep V2. Existing V1–V3 rounds, denominators, deadlines, signatures and receipt hashes remain unchanged and verifiable; the portable verifier supports all four round versions. Name/key association still depends on the authorized application roster; a passkey does not establish a person’s official committee mandate. Exported decision receipts still report `NOT_ANCHORED`; the existing proposal/activity Zcash anchors do not cover decisions created later.
