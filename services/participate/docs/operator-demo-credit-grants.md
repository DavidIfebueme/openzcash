# Operator demo credit top-ups

A verified participant can receive extra **free demo Zcred** when an operator has an explicit user request. This is not a purchase, does not have cash value, and never touches a Zcash wallet or a treasury.

The grant is `grantOperatorDemoCredits` in `lib/services/demo-credit-grants.ts`; this distribution ships no command for it, and it has no public HTTP endpoint. It requires the existing user ID and exact username, the configured public pilot committee, an amount from 1 to 1,000, a unique `demo-topup:` request key and a short audit reason. The account must already have received its one-time demo allowance, have no purchases and not be under payment review. DAO balances and other communities are refused.

## Rollout order

1. Back up the database and apply `prisma/upgrades/20261012_admin_demo_credit_grants.sql` as a script outside an enclosing transaction. Adding the enum value must commit before the shape constraint uses it. This migration does not change any balances.
2. Generate the Prisma client and deploy the backend using the updated schema. Deploy the frontend history label too. Do not insert the new enum value while an old backend is serving credit histories; an old generated Prisma client may reject it.
3. Call it as a dry run (`apply` false) to check identity, eligibility and the projected balance. Set `apply` only for the authorized grant.
4. Verify the operation, account balance and sum of all journal deltas; reuse the same arguments and request key for any uncertain retry.

Read private connection configuration from the operator environment. Never put database credentials in arguments, logs or chat. The result includes the user ID, username, community, amount, request key, operation ID and balance; the immutable ledger retains the reason in `targetId` and the complete request hash in `payloadHash`.

Grants append `ADMIN_DEMO_GRANT` to the existing journal in a serializable transaction alongside the balance increment. The original 25-credit allowance and every prior debit remain unchanged. Repeating the same request returns the current balance without granting again; changing the amount or reason with the same key fails.

The existing append-only journal and deferred balance reconciliation triggers remain enabled. Database constraints also require an existing committee demo allowance, limit each grant, and forbid mixing demo credits with real purchases. If the transaction fails, no partial balance change is retained.

## Rollback

Before the first grant, the application can roll back while leaving the unused additive enum/schema support in place. After a grant, keep Prisma clients capable of reading `ADMIN_DEMO_GRANT`; do not delete or edit ledger history. This feature does not enable purchases, automatic replenishment or grants through the public website.
