# Participate committee review

The committee opens a proposal in four distinct tabs: **Proposal**, **Discussion**, **Vote**, and **Finish**. The tabs preserve an unsigned vote draft when switching views. Queue totals distinguish awaiting review, review started, and decided; imported source decisions remain separate.

## Public records and signed reviews

- Official source decisions keep their source attribution. Turnout measures recorded participation, not approval. Unknown participation is not displayed as zero; rejected results are red, complete participation green, and partial participation amber.
- Public discussion is the same proposal discussion in the public and committee views. Source comments retain separate provenance. A comment is not a vote.
- A V4 pilot review publishes all five positions and reasons together after the fifth signature. The completed receipt has a stable timestamp and is linked to a `REVIEW_DECIDED` activity event in the same transaction. Partial positions are not exposed through the receipt, public card, or committee history.
- Finish shows the exact round and proposal revision. Publication, queued activity, transmission, and confirmed anchoring are separate states. A signature alone is not a blockchain anchor, and a pilot review does not change an official ZCG outcome or payment.

## Notifications

The service records a private arrival notification for each active committee member on the first eligible publication. Imports of terminal decisions, later revisions, drafts, demo publications, and retries do not create new-proposal alerts. Read and acknowledgement access are checked against the current member and operation gates. The client opts into arrival items with `include=proposals`; existing comment-only clients remain compatible.

Deploy the service's additive `20261015_proposal_arrival_notifications.sql` upgrade before its regenerated Prisma client and before this portal. The source importer also needs the corresponding notification helper. Back up the current database first; do not run the enum upgrade with `--single-transaction`. Existing accounts, membership, worker configuration, signer policy, and committee flags remain unchanged.

## Google Sheets handoff

Finish prepares **only columns A:G of Proposals**. An authorized member can inspect a preview, copy TSV, or download CSV, then paste it into the existing workflow. No Google credentials or write API are used. The original Sheet header and unique canonical proposal URL are checked; duplicate matches block preparation. Export values are protected against spreadsheet formula injection.

The operator confirms the official outcome and dates; an independent pilot review is not automatically converted into an official Sheet decision. Installments, Grants Disbursed, and payment status are outside this handoff.

## Activation boundary

Shipping these improvements does not activate committee voting. Production retains its existing access and public-pilot flags. A real committee still requires explicitly authorized operation, five configured seats, verified accounts, and registered passkeys. Local fixtures and synthetic signatures must never be deployed or presented as real committee activity.
