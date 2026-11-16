# Committee credits

10 October 2026 · Local implementation

ZCG is a committee, not a DAO. Its public proposals have their own participation economy. **Credits** remains the menu label and **Zcred** the usage unit; the balance belongs to the named committee or DAO.

## Ownership and access

- The internal workspace registry records an immutable kind: `DAO` or `COMMITTEE`. Sharing storage and ledger code does not share balances or permissions.
- `ProposalArchive.communityId` retains the hosting workspace and existing URLs. `committeeId` identifies the committee that controls participation prices and moderation. The server resolves it from the record; clients cannot choose the account to debit.
- A signed-in active account can participate without becoming a committee member. DAO leadership grants no committee administration. Imported committee votes and feedback remain historical evidence, separate from local account permissions.
- DAO lists, management, membership and treasury access exclude committee workspaces.
- The Credits dialog in ZCG shows **ZCG · Committee**, with no DAO selector. DAO Credits lists only DAO accounts. Composer and proposal actions open the same economic scope as the charge.
- Each scope has its own receiver configuration, invoices, payment review, balances, prices and private history. No balance fallback or transfer is supported.

Comments, proposal likes and comment likes keep their existing atomic debit, idempotency, immutable journal and prior-charge protections. A policy change still requires the current displayed version. Reactions do not buy committee votes or voting weight.

## Upgrade and local pilot

Back up the database, apply `prisma/upgrades/20261010_committee_credit_scope.sql` after the archive participation upgrade, regenerate Prisma and restart the application.

The migration only adds metadata and guards. It grants no credits and leaves every existing journal, invoice, reaction, comment and published revision intact. An archive may receive its initial committee assignment; subsequent reassignment and workspace-kind changes are rejected.

The new committee account starts at zero; the usual one-time 25 **demo** Zcred allowance is available on request. No existing DAO credit is moved, copied or retroactively refunded. Previously paid likes retain their prior-charge marker. Older charges remain auditable in the original DAO account.

Operator imports must target an explicitly provisioned committee. The listing currently requires one economic scope per hosted board; mixed scopes fail closed.

Real top-ups remain disabled in the preview. Production requires a separately configured committee receiver and the payment validation described in [Credit purchases](./credit-purchases.md). This change performs no on-chain payment or deployment.

## Verification

PostgreSQL coverage proves committee prices debit only committee credits; a funded DAO cannot cover an empty committee account; DAO leaders cannot change committee policy or moderate its comments; committee administration grants no DAO treasury authority; immutable revision hashes and historical journals remain intact.
