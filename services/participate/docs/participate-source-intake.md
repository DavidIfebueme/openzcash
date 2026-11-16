# Complete ZCG source intake

Updated 13 October 2026. This document covers the older manual capture and recovery flow; its commands are not part of this distribution. Production uses the [automatic discovery and Ironwood queue](participate-automation.md) on the operator host, with durable records in Railway. The automatic importer accepts complete grant forms with custom titles before labels are assigned; manual V1 capture below retains its stricter legacy review-label validation.

## Public behavior

1. Choose a real new application in the official ZCG tracker. Capture its exact Markdown, author handle, dates and original label names/colors. Intake accepts only an open Grant Application explicitly Ready For ZCG Review, without a terminal decision, milestone or payment label.
2. Review the two recovered files (`proposal.md`, `source.json`), source URL, capture date and manifest hash. The body is preserved byte for byte, including Markdown formatting. Arbitrary numbers in prose are never guessed into a budget. Linked images, PDFs and forum pages remain links; archive them as a separately reviewed extension if full attachment preservation is required.
3. Import into the configured host/committee. The card appears in Under review, with the source capture date. It is a dated observation of the official process, not a decision by the pilot. A repeated import returns the same immutable revision; changed bytes require a new revision linked to the previous hash. An old editorial record with the same source URL cannot be duplicated under a new ID.
4. Export only the chosen record and prepare an anchor. At this stage the file is available, but no transaction has been sent. Under review and Anchored are independent states.
5. The operator checks the exact root/memo, receiver, network, fee and frozen export, then publishes through the separate Zallet signing process. No public HTTP endpoint can trigger that spend. Preserve the transaction ID and reconcile an uncertain submission before any retry.
6. An independent read-only wallet and Zebra verify the exact memo/recipient, canonical block and at least ten mainnet confirmations. Only then does the dated receipt provide confirmed-chain evidence. Download the package/receipt and recover it using the standalone verifier outside the website. Keep two independent copies of the files: a hash in Zcash does not contain their content.

Native proposals submitted by public testers remain **Published in demo**. Their later anchor proves the same files existed by the block timestamp; it does not promote them to an official ZCG application, or claim they were submitted at that timestamp.

## Acceptance evidence and remaining live step

Unit and disposable-PostgreSQL tests cover byte-exact recovery, modified-file rejection, wrong source identity, absent/terminal review labels, pull-request rejection, future timestamps, immutable replay, linked revisions, dated board metadata, zero credit changes and no fabricated chain anchor. A native test and a captured official application are kept distinct.

The next mainnet acceptance step uses the next selected **real** application and its frozen package. It is intentionally not replaced with a fictitious QA proposal or a transaction sent merely to make the test green. Existing 25-record mainnet evidence remains intact.
