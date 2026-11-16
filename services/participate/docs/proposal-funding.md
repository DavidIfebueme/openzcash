# USD budgets and ZEC payments

User decision, 9 October 2026: proposals request a fixed USD amount, paid in ZEC using the exchange rate on the payment day.

## Current implementation

- New proposals and edited drafts accept `requestedAmountUsd` as a positive decimal string with at most two fractional digits. Storage uses exact `BigInt` cents in `requestedAmountUsdCents`; JSON uses strings. Floating-point amounts and fractional cents are rejected.
- The proposal board, detail page, editor and Markdown models display USD. They state that payment is in ZEC at the payment-day rate. No ZEC amount is locked at submission or approval.
- `PROPOSAL_CONTENT_V3` commits to the amount, USD denomination, ZEC payment currency and `ZEC_AT_PAYMENT_DAY_RATE` rule, alongside the existing proposal content and tags. Anchoring verifies this content and compares the exact budget again when claiming the draft.
- Treasury balances and funding/allocation records remain in zatoshis. Creating a USD request does not convert balances, reserve funds or make a payment.
- V1/V2 commitments and existing ZEC requests retain their original values and hashes. An old published request is shown as a legacy ZEC budget. Editing an old draft requires entering an explicit USD budget; stale ZEC write payloads are rejected, not relabeled as dollars.

## Indicative price estimates

Owners and managers can open **Payment estimate** on a saved USD-funded proposal. `Estimate in ZEC` obtains a Zcash/USD market reference from [CoinGecko Simple Price](https://docs.coingecko.com/demo/reference/simple-price), including the source update timestamp. The provider receives only the fixed public `zcash`/`usd` query, never proposal, account or budget data. An optional server-only `COINGECKO_DEMO_API_KEY` supports the Demo plan; keyless availability is provider-dependent.

Each successful request saves an immutable `ProposalFundingQuote`: proposal commitment, requested USD cents, requester, idempotency key, exact USD/ZEC rate, estimated zatoshis, source/retrieval/recording times, expiry, rounding and fee treatment. Rates retain eight decimal places as integers. Division rounds up by at most one zatoshi; network fees are excluded. This is an **indicative estimate**, not an executable exchange offer or a finalized settlement quote.

- Validity ends five minutes after the provider timestamp or at the next UTC midnight, whichever comes first. Fetching, caching or replaying never extends that time. Missing, future, stale, invalid and unavailable source prices fail without a fabricated fallback.
- Only active owners/managers can read or create quote history. A global admin role or a ballot invitation is insufficient. Origin checks protect writes; the server supplies the amount, price and source. A persistent per-account limit allows five new attempts per minute, including provider failures. Concurrent price requests share a short public-price cache.
- Creation rechecks authorization and the proposal under a transaction after the network request. A changed budget, commitment, treasury or archived status blocks creation. Idempotent retries return the same record, even if it has since expired.
- Recent records remain available after refresh. The UI marks expiry automatically and separates older proposal revisions. Archived proposals retain read-only history. Guests continue to see the USD request without an administrative quote panel.
- Creating an estimate changes neither the proposal commitment/status nor any treasury balance, reservation, commitment or paid total. It does not require an approved proposal because it performs no authorization or payment.

The indicative source, five-minute window, rounding and fee display are implemented for estimates only. The DAO's binding settlement policy still needs to be selected before enabling payment execution.

## Payment integration boundary

The market-rate estimate is connected; the approved grant/payment workflow is not. At payment time, the implementation must obtain a fresh USD-per-ZEC quote under the approved settlement policy and calculate:

`ZEC payment = approved USD amount due / USD price per ZEC`

For every installment, persist the USD amount due, source, quote timestamp/timezone, quoted USD-per-ZEC rate, rounding rule, final zatoshi amount and confirmed transaction/output evidence. The saved settlement quote must not change when a later market quote arrives. Reject missing, stale or invalid quotes; do not fall back to an invented or cached approval-day rate. Obtain a new quote and confirmation if the payment is delayed beyond quote validity. Define the approved source, validity window and network-fee treatment before enabling this workflow. The approved USD amount stays fixed; the ZEC amount may vary for each payment.

Approval, quotation, payment submission and confirmed payment remain distinct states. Neither the current funding label nor proposal approval is a payment receipt.

## Database upgrade

Apply after the workspace and proposal-topic upgrades:

```bash
npx prisma db execute --file prisma/upgrades/20261009_proposal_usd_budgets.sql --schema prisma/schema.prisma
npx prisma generate
```

This transactional, rerunnable upgrade adds the nullable cents field, supports V3 commitments, enforces one budget currency per request, and blocks funding changes after the draft stage. It does not convert or rehash existing records. Run it after the topic upgrade on fresh databases too; do not rerun an older constraint installer afterward.

Then apply the additive quote-history upgrade and regenerate the client:

```bash
npx prisma db execute --file prisma/upgrades/20261009_funding_quotes.sql --schema prisma/schema.prisma
npx prisma generate
```

This creates estimate history and its request throttle, installs exact-calculation/time checks and blocks history updates/deletes. Apply it to fresh databases too for the SQL-only guards. It is rerunnable and changes no existing proposal or treasury rows. The rollback path is to hide the estimate component/disable its API while retaining the new tables and historical records; do not drop recorded history to roll back the UI. Back up and restore-test a real database before applying an upgrade.

Local validation covers exact rounding, freshness/day boundaries, provider failure, authorization, idempotency, concurrent creation/throttling, proposal changes during lookup and database immutability. Database suites run only against the dedicated disposable `community_treasury_tests` database. This evidence does not certify grant execution or a production deployment.

Validation on 9 October 2026: the general suite passed 993 tests (database suites run separately); the final quote database suite passed 10 tests, with the six proposal-funding and four treasury integration tests also passing. The final component/public-page rerun passed 15 tests. TypeScript, scoped ESLint and whitespace checks passed. The local browser obtained a live CoinGecko price, reloaded the saved snapshot and recorded a second quote while preserving the first. The quote panel was checked at desktop and 390 px in light/dark themes; temporary viewport changes were reset. Only local preview/test databases were upgraded; no deployment or payment was made.
