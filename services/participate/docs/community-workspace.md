# Community Workspace

Implemented development slice | Updated 9 October 2026

This guide describes the current community workspace. The [requirements](./requirements-community-dao.md) remain the broader product target. Implemented code, local tests, a sample preview, and production deployment are separate evidence states.

## Implemented Features

- Closed proposals display **Tally pending**. Closing preserves uncollected requests and does not execute membership changes. Verified cutoff/collection finalization remains a separate delivery; see [voting finalization](./voting-finalization.md).
- `/communities` selects an authorized community. Published proposals are readable at `/communities/<communityId>` without an initial login screen; authorized leaders also see member counts and the compact treasury summary. Sign-in is available within the workspace.
- `/communities/<communityId>/treasury` gives authorized leaders a dedicated view of both funds, their exact combined available budget, each balance category, and the latest 20 funding/allocation records. The shared DAO menu contains Proposals, Treasury and Members; Coinholder analytics is no longer linked from it.
- Community Treasury holds recorded funding for community activities. Sustainability Treasury is a reserve funded through manual allocations. There is no automatic percentage or revenue distribution rule.
- Owners can record external funding and allocate available recorded funds between the two treasuries. Managers can read both funds.
- Owners and managers can create proposals with Markdown content, up to three topic tags, voting dates, and an optional funding request. [Submission templates and a filled example](./proposal-templates.md) help prepare the text. Creating a proposal copies the active community member roster into poll access records. Editing remains restricted to drafts.
- Proposal pages include discussion with one reply level. Comments are immutable through the application. Moderation requires a reason, preserves the original body in storage, and returns a visible tombstone with actor and time.
- Funding requests use fixed USD budgets, payable in ZEC at the rate on each payment day. The editor, board, details and templates share this rule. No quote or payment is created at submission; see [USD budgets and ZEC payments](./proposal-funding.md).
- New and edited drafts use `PROPOSAL_CONTENT_V3`, committing the body, title, community, options, treasury, USD cents, settlement rule and normalized topic tags. Existing V1/V2 commitments remain byte-compatible and are verified using their recorded version. The upgrade does not rehash existing proposals or change legacy question/options hashes. Anchoring rejects an inconsistent content commitment.

## Authorization and Visibility

Private community administration requires an active user and an active `OWNER` or `MANAGER` membership, checked against the database. Global `ADMIN`/`CREATOR` roles and poll authorship do not bypass that membership check. Treasury mutations additionally require `OWNER`; this is authority to change recorded accounting, not wallet signing authority.

Published proposal content is readable by guests. Discussion access remains limited to current community managers, explicitly eligible permanent users, and valid poll-scoped invite sessions. Participants cannot access unpublished drafts; invite sessions remain limited to their poll and expiration. Managers may moderate. Archived discussions are read-only. Policy configuration and formal written reviews remain separate work.

Object lookups validate community or poll ownership. Composite foreign keys also prevent foreign-community treasury references and foreign-poll reply parents. Write APIs validate the request origin and strict input schemas. Moderation does not disclose a private ballot choice; it also does not provide a cryptographically signed authorship or moderation receipt.

## Recorded Accounting Boundaries

Treasury entries are positive decimal ZEC strings with at most eight fractional digits, converted to exact `BigInt` zatoshi values. Proposal requests are stored separately as USD cents, not as ZEC reservations. Balances and activity amounts are serialized as decimal strings. Each treasury has a distinct identity and available, reserved, committed, and paid fields.

This delivery changes **available** recorded funds only. Reservation, commitment, grant, and payment transitions are not implemented; their fields remain zero until those workflows exist. Funding requests do not reserve money, and proposal approval does not pay a beneficiary.

Funding records preserve source, reason, actor, time, and request key. Allocations append a matching debit and credit in one serializable transaction. Conditional balance updates prevent overspending; bounded retries handle transaction conflicts. Reusing the same key and intent returns a replay without applying it again. Reusing a key with different intent fails. Retry an interrupted request with its original key.

SQL guards make the financial journal append-only and check completed entry pairs at commit. There is no edit/delete endpoint or correction workflow for financial history. Recorded balances are not reconciled wallet balances, evidence of custody, or a claim that funds can be spent. No treasury endpoint calls a wallet or sends a transaction.

## Account Settings

The header avatar opens Profile, Privacy and Sign out. Signed-in users can save a display name and upload or remove a profile photo. The unique login username remains unchanged and stays attached to comments. Settings apply to the account across communities. Invitation-only voter sessions expose Sign out without editable profile settings.

Custom names and photos are private to the account by default. An explicit profile preference enables them for existing and future discussion comments, limited to the existing authorized discussion audience. Turning it off restores the stored username and initials on subsequent reads; it cannot retract data already viewed or copied. Comment authorship records remain unchanged. This setting does not change ballot privacy.

Uploads accept static PNG, JPEG or WebP up to 2 MB and 16 megapixels. The server checks the actual format, bounds the request body and decode time, resizes to at most 256 pixels, strips metadata and stores a WebP data URL. No third-party avatar service or remote image URL is used. Account endpoints require an active user, enforce write origins, update only the session user and return private, uncached responses.

## Database Upgrade

Back up and restore-test an existing database, review the scripts, and apply them in a maintenance window. This repository has no baselined Prisma migration history.

For a database on the pre-community schema, apply [community isolation](../prisma/upgrades/20261008_community_isolation.sql) first. For a database already on that foundation, apply only [the workspace upgrade](../prisma/upgrades/20261008_community_workspace.sql):

```bash
npx prisma db execute --file prisma/upgrades/20261008_community_workspace.sql --schema prisma/schema.prisma
npx prisma generate
```

The workspace script runs once. It adds treasury/discussion tables, nullable proposal fields, keys, checks, and journal guards. It preserves legacy ownership and hashes and creates no funds, entries, memberships, or assignments. Do not rerun it against an already upgraded schema. Existing unassigned polls and members still require an explicit ownership review before assignment.

Apply the [proposal topic upgrade](../prisma/upgrades/20261009_proposal_tags.sql) after the workspace upgrade, including on databases that already have the workspace:

```bash
npx prisma db execute --file prisma/upgrades/20261009_proposal_tags.sql --schema prisma/schema.prisma
npx prisma generate
```

The topic upgrade adds empty topic lists and validates allowed topics and draft-only editing. Follow it with the [USD budget upgrade](../prisma/upgrades/20261009_proposal_usd_budgets.sql), which also allows V3, before starting the updated application. Neither upgrade rehashes existing proposals; untouched V1/V2 records retain their currency and digest.

```bash
npx prisma db execute --file prisma/upgrades/20261009_proposal_usd_budgets.sql --schema prisma/schema.prisma
npx prisma generate
```

Existing workspace databases also require the additive [account profile upgrade](../prisma/upgrades/20261008_account_profile.sql) before running this version:

```bash
npx prisma db execute --file prisma/upgrades/20261008_account_profile.sql --schema prisma/schema.prisma
npx prisma generate
```

Apply it once. It adds nullable display name/photo fields and a false-by-default discussion sharing preference; credentials, usernames, roles and history stay intact. Fresh databases created from the current Prisma schema already have these fields and must skip this script.

For a **new disposable database**, Prisma can create the schema, but `db:push` does not install the SQL-only checks and triggers. Follow it with [the integrity installer](../prisma/upgrades/20261008_community_workspace_integrity.sql), then the proposal topic and USD budget upgrades:

```bash
npm run db:push
npx prisma db execute --file prisma/upgrades/20261008_community_workspace_integrity.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/upgrades/20261009_proposal_tags.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/upgrades/20261009_proposal_usd_budgets.sql --schema prisma/schema.prisma
```

The integrity installer requires the workspace tables to exist. It adds no schema columns or records, skips named checks/triggers already present, and refreshes the reviewed journal function definitions. It is unnecessary after the full workspace upgrade and can be rerun without duplicating its guards. It does not repair or replace a different existing check definition. Do not use `db:push` on an existing deployment; preserve the earlier legacy partial indexes and custom SQL guards.

Local validation applied the full upgrade to a clone of the prior database. All 15 original table counts and fingerprints of every preexisting column matched; the unassigned legacy poll remained unassigned. New accounting/discussion tables were empty. The original database was unchanged. Installing the integrity guards into the populated preview preserved all 19 table counts and value fingerprints; its existing journals reconciled and the mutation/completeness guards rejected rolled-back diagnostic writes. This is local migration evidence, not a production migration approval.

## Verification

Run the repository checks and focused regressions:

```bash
npm run lint
npx tsc --noEmit
npm test -- tests/domain/treasury.test.ts tests/services/treasuries.test.ts tests/admin/treasury-routes.test.ts
npm test -- tests/domain/proposal-content.test.ts tests/domain/proposal-tags.test.ts tests/services/proposal-discussion.test.ts tests/polls/proposal-routes.test.ts tests/components/community-workspace.test.tsx
```

PostgreSQL integration tests require a separate disposable `community_treasury_tests` database on loopback. Create its current schema and workspace integrity guards using the fresh-database sequence above. The proposal topic upgrade must follow the workspace integrity installer on this database too:

```bash
DATABASE_URL='postgresql://dao_test@127.0.0.1:55438/community_treasury_tests' npx prisma db execute --file prisma/upgrades/20261009_proposal_tags.sql --schema prisma/schema.prisma
DATABASE_URL='postgresql://dao_test@127.0.0.1:55438/community_treasury_tests' npx prisma db execute --file prisma/upgrades/20261009_proposal_usd_budgets.sql --schema prisma/schema.prisma
TREASURY_TEST_DATABASE_URL='postgresql://dao_test@127.0.0.1:55438/community_treasury_tests' npm test -- tests/integration/treasury-postgres.test.ts tests/integration/proposal-tags-postgres.test.ts
```

The integration suites are skipped without that explicit URL and reject other database names/hosts. They verify concurrent accounting writes, permissions, scoped foreign keys and immutable financial history, plus USD budget persistence, topic persistence, draft-only editing and content anchoring. Unit tests pin V1/V2 digest compatibility. Test fixtures use unique communities and retain their history in that disposable database.

## Remaining Work

This slice is not a production-ready DAO. Wallet custody/reconciliation, payment execution and confirmation, funding policy and spending limits/pauses, reservations/commitments, formal reviews, published version history, eligibility manifests, exact finalization/cutoff policy, veto, vote replacement, consistent publication privacy, and operator-resistant ballot privacy remain further deliveries. The current anchor transaction identifier is not independently confirmed chain inclusion evidence. ZcashNames member identity and per-DAO leader-managed or vote-governed membership are confirmed requirements awaiting implementation; see [the integration specification](./zcashnames-membership.md). Cryptographic voting engines remain optional integrations requiring separate compatibility work. Complete the applicable policy decisions, migration review, failure-case checks, and live verification before a binding pilot or production deployment.
