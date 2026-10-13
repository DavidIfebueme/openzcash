# Participate: public proposals and GitHub discussion

13 October 2026

The participant workflow publishes real community proposals, comments and likes on OpenZcash. Zcred remain free demo credits, without payments or monetary value. Creating a community proposal does not file an official ZCG application or enable the committee workspace.

## Current GitHub discussion

`Source & comments` reads every public author on the official issue, including contributors, unaffiliated applicants and bots. Previously the preserved source capture included only OWNER, MEMBER and COLLABORATOR comments; issue #454's three comments have NONE or CONTRIBUTOR associations and were consequently absent.

The public reader is restricted to known official ZCG issues. It validates comment identities, follows bounded pagination, coalesces requests and caches successful reads for five minutes. It loads on demand and refreshes while the source panel is visible. A failure displays an unavailable/stale state, never a fabricated zero. Server logs identify the affected issue without credentials or comment bodies. Unimported official proposals also offer their GitHub discussion.

Current comments are explicitly separate from comments in the selected preserved revision. Historical packages, manifest hashes, source fingerprints and mainnet transactions are unchanged. The existing official-source revision worker and its signing eligibility/limits are unchanged; reading a GitHub comment never schedules a transaction or turns it into a committee vote.

## Production publication with free credits

The private Participate service uses `PARTICIPATE_PUBLICATION_MODE=production` in the already configured public/free-credit scope. This mode is independent of `PARTICIPATE_PUBLIC_DEMO`, whose legacy name still controls free-credit/account protections. Shared demo accounts remain disabled and permanent accounts require verified email. Committee operations remain disabled.

New publications are stored as `PUBLISHED`, use `proposal-<id>` identifiers and contain `COMMUNITY_PUBLICATION` in the downloadable application. They include the exact Markdown, budget, applicant and supporting links. Existing `PUBLISHED_DEMO`/`PILOT_DEMO` records remain legacy tests; they are never rewritten or relabeled as real submissions. Drafts remain private and preserve their original IDs.

Apply backend upgrade `20261013_public_participation.sql` after a backup. It extends the two submission CHECK constraints; immutable-content, ownership, consent, version checks and atomic credit operations remain in force. Current verifiers accept both historical and public native scopes. No existing row, credit balance or archive is rewritten by this upgrade.

The PostgreSQL acceptance flow covers email/passkey enrollment, private drafts, real publication, concurrent retries, single debit, replies, likes, private notifications, recovery and access isolation. Public production checks verify the deployed mode, GitHub comments, existing archive integrity and the normal participant UI. No synthetic proposal, comment or like is posted on the public site for this release.

Paid Zcred, committee signing, official intake through this form and automatic anchoring of community-authored proposals are not enabled. Automatic mainnet anchoring continues to apply only to eligible official GitHub sources.
