# Zcash payments for participation credits

9 October 2026

## Ownership and flow

Each DAO receives ZEC in its own configured Zcash wallet account; committee records use a separate committee receiving configuration. A participant creates a payment request, reviews its fixed price and quantity of **Zcred**, and pays from a personal wallet. The application observes the selected receiving account and issues the quoted credits once the incoming payment satisfies its confirmation policy. **Credits** remains the menu label; **Zcred** is the unit displayed in balances, packages and participation costs. Payment amounts are displayed separately in **ZEC**.

Confirmed product decision on 10 October 2026: **US$ 0.25 per Zcred; 20 Zcred / US$ 5 per initial proposal submission**. The implementation documented below still uses fixed-ZEC package prices. Migrating new offers to USD pricing requires an expiring exchange-rate quote and must preserve existing invoices. No real price or receiver is activated by the decision. See [Proposal publication and Zcash evidence](./proposal-publication-product.md).

The application never creates a personal wallet, requests a member's seed, signs their payment or submits a transaction on their behalf. Opening a wallet, displaying a transaction ID and detecting an unconfirmed payment do not complete a purchase. Credits are internal usage units, scoped to the member and DAO; they are not a transferable token or a claim to withdraw ZEC.

The sustainability reserve remains funded by manual allocations. Receiving a payment does not automatically insert treasury budget entries or allocate a percentage to either treasury.

## Payment request

A server-created request snapshots the DAO, permanent user, receiver identity, chain, exact zatoshi amount, credit quantity, required confirmations and expiry. Its random memo identifies the order without including a username, proposal, comment or ZcashName. The server controls the package; the browser cannot choose the amount or credit quantity.

Requests are idempotent and preserve their original quote across retries and later price changes. The receiving address and memo are included in a ZIP-321 wallet link. The member must retain the memo when using the manual payment details. Each order expects one incoming shielded output of the exact quoted amount. Partial, overpaid, duplicate and ambiguous payments require review; there is no automatic refund or consolidation of partial outputs.

The UI shows the network before payment, the payment amount, credits, deadline and current status. A locally generated QR and wallet link encode the same validated invoice; no invoice details are sent to a QR provider. The UI stops presenting these payment actions after a payment is detected or a check becomes uncertain, to reduce accidental duplicate payments. Only a `CREDITED` response states that credits were added.

| Status | Meaning |
| --- | --- |
| Pending | No qualifying payment has been verified yet. |
| Confirming | A matching payment is observed but has not met the confirmation policy. |
| Credited | Verified receipt, journal entry and credit balance were committed together. |
| Expired | The payment window has closed. A payment already sent may still be checked and credited when it qualifies. |
| Review | A mismatch, ambiguity, late payment or later chain change needs review. |

A payment included before the invoice deadline can finish confirming after that deadline. If another invoice has already been opened, an older expired invoice retains that status and its newly observed payment evidence until confirmation completes. This preserves one open invoice per account without losing the older payment. An expired invoice must not be paid again. Checking its status remains useful if a payment was already sent. A provider failure is an unavailable check, not evidence that funds were absent.

## Verification and persistence

The credit observer is separate from the voting collector. It uses read-only Zallet wallet methods and a separately configured chain RPC endpoint. It verifies the wallet account and its configured receiving address, the network, wallet scanning progress and the canonical chain. It checks that the transaction is actually included in the claimed block, rather than relying only on a confirmation number supplied by a client. The [observer contract and source references](credit-payment-observer.md) pin the supported Zallet version and document its read-only methods and limits.

Receipt identity includes network, transaction ID, shielded pool and output/action index. Its global unique constraint prevents one received output from funding multiple orders. A successful purchase records the receipt, an append-only `PURCHASE` operation and the balance increment in one serializable database transaction. Immutable quotes and deferred SQL constraints bind the recorded evidence and credits to that same order.

The reconciler also revisits credited purchases. If their payment no longer has the required canonical-chain evidence, the order moves to review and new credit spending is paused for the account. Existing comments and journal entries remain intact. There is no automatic second credit issuance, negative balance or silent clawback. Review resolution and any reimbursement require a separate operational decision; this release has no refund or unfreeze endpoint.

Confirmation depth reduces reorganization risk; it does not establish irreversible finality. Mainnet configuration requires at least six confirmations. The receiving DAO may configure a higher threshold.

## Receiver configuration

Real purchases are off by default. `CREDIT_PAYMENTS_ENABLED=true` enables the configured integration; `WORKSPACE_PREVIEW=true` always keeps real purchases disabled. Accounts with a demo grant cannot receive a real purchase, and real purchase accounts cannot receive demo grants. Do not promote the sample database into a funded environment.

`CREDIT_RECEIVERS_JSON` is a server-side array with one entry per DAO. It contains the following fields:

| Field | Configuration |
| --- | --- |
| `id` | Stable receiver identity; change it when moving to a different receiving account/address. Price changes alone retain this ID. |
| `communityId` | Exact application community ID. |
| `network` | `mainnet`, `testnet` or `regtest`. |
| `address` | A shielded-only Unified Address already present in the DAO's configured Zallet account. Transparent receivers are rejected so payments can carry the invoice memo. |
| `accountId` | That wallet account's UUID. |
| `walletRpc.url` | Zallet endpoint; HTTPS or an HTTP loopback endpoint. |
| `walletRpc.userEnv`, `walletRpc.passwordEnv` | Optional names of environment variables holding RPC credentials. |
| `chainRpc` | Separate chain RPC connection with the same URL/credential-reference shape. |
| `credits` | Whole-number package quantity, 1–1,000,000. |
| `amountZat` | Exact positive package price as a zatoshi string. There is no USD conversion or inferred exchange rate. |
| `requiredConfirmations` | 1–1,000; at least 6 on mainnet. |
| `expiresInMinutes` | Payment window, 10–1,440 minutes. |

The package price must be chosen by the DAO operator before activation. No receiving address, price or wallet credentials have been configured by this implementation. Keep RPC secrets out of Git, browser responses and logs. Use a restricted read-only RPC connection or gateway with only the observer's required methods; never reuse a broadly exposed spending-capable endpoint as a browser API.

The exact same configured wallet account cannot be assigned to two communities at the same RPC endpoint. The application does not establish who controls a wallet merely from an address label: deployment operators must provision each DAO's account and reading access appropriately.

Receiver rotation is not yet supported safely. Configuration accepts one receiver per community and reconciliation uses that current receiver. Existing orders retain their original receiver snapshot; an identity change sends them to REVIEW, which can freeze an already credited account. Multiple historical receiver versions and an audited review-resolution workflow must be implemented before rotation is an operational option. Do not reset invoices, journals or REVIEW records to work around this restriction.

Before enabling purchases, install the database upgrade, provision the receiver and chain connections, verify an actual testnet payment through confirmed receipt and credited balance, and arrange regular reconciliation. That live wallet validation has not been performed here.

## Application endpoints

- `GET /api/account/credits/purchases?communityId=…`: private package availability and the current user's order history.
- `POST /api/account/credits/purchases`: creates an idempotent order using the community ID and request key.
- `POST /api/account/credits/purchases/:purchaseId/check`: checks the owner's order using server-side receiving-wallet evidence. It does not accept a caller-supplied receipt or confirmation count.
- `POST /api/internal/credits/reconcile`: server-only batch reconciliation, authenticated with the `x-credit-reconcile-secret` header and an explicitly configured `CREDIT_RECONCILE_SECRET` of at least 32 characters. The body must be `{}`; it accepts no caller-supplied payment evidence.

The credit balance and invoice details remain private to the authenticated permanent account. Current purchase authorization accepts an active OWNER/MANAGER membership or permanent-user eligibility on a published poll in that community. This is not yet a unified current-member check: the account-linked DAO roster and the effect of removal on new purchases remain part of the membership delivery. Buying credits never grants community access or ballot weight. Paid participation can be enabled by the owner policy only when this DAO has funding configured. Operators should establish successful purchase/reconciliation checks before enabling that policy.

Call the internal reconciliation route on a schedule in the receiving environment, initially every minute for a small DAO. Each default batch considers up to 20 orders, including credited and expired ones, prioritizing those checked least recently. Monitor completion, errors and queue age; scale cadence or batch processing before growing the order backlog. The UI has a manual payment check and does not replace background reconciliation. This implementation does not install a scheduler.

## Database and release boundary

After the participation-credit upgrades, apply `prisma/upgrades/20261008_credit_purchases.sql` once with a verified backup, then regenerate the Prisma client. The enum addition is committed before the remaining transactional upgrade because PostgreSQL requires that boundary. SQL-only guards are mandatory; `prisma db push` is insufficient.

This release supplies configuration, purchase requests, observation, reconciliation and UI code. Configuration alone is not proof of a functioning receiving wallet. No production wallet has been connected, no real ZEC payment has been submitted or confirmed, and no production deployment has been performed.

## Implementation verification — 9 October 2026

- 668 tests across 89 files passed, including 16 purchase tests against the isolated PostgreSQL database and 15 existing discussion-credit/treasury integration tests. Database suites run sequentially when a test database is configured; concurrent-request cases still run concurrent transactions within each suite.
- Coverage includes quote replay, account/DAO isolation, once-only issuance, receipt/journal rollback, SQL proof invariants, expired invoices with a newer open order, post-credit chain reorganizations, real/demo separation, adapter failures and wallet-link/QR validation.
- Production compilation and TypeScript checks passed. ESLint reported no errors and two existing image-element warnings; the build retains an existing middleware-convention deprecation notice.
- The additive migration was applied to the local preview and isolated test databases after backing up the preview. No real receiving wallet was configured.
- Browser visual verification remains pending: the in-app browser tool refused to reload its existing internal error page. No alternate automation was used to bypass that restriction. Reopen the HTTP preview manually to continue visual review. Component tests are not a substitute for that review or for a real testnet receipt and credited balance.
