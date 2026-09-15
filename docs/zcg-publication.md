# ZCG publication timing

Public proposal status changes, the ZCG digest, and the ZCG RSS feed use D-1:
observations made on one calendar day become eligible at midnight of the next
day in `America/Sao_Paulo`. This is a previous-day cutoff, not a rolling 24-hour
timer. The source's decision date is retained; backdating a decision does not
bypass the observation delay.

The raw spreadsheet mirror remains current. `zcg_publications` stores its
pending verdict and the last public verdict independently. Source writes and
publication observations commit in the same transaction. Reimports do not
restart the clock. Corrections during the same day replace the pending value.
Publication eligibility is checked on reads, including after server restarts.
Proposal caches use the publication day in their key.

The same rule covers GitHub decision labels, closures, and deleted-issue
signals. A complete GitHub listing is required to stage removals; failed or
incomplete requests retain persisted applications. New undecided applications
can appear immediately. The spreadsheet keeps priority once its verdict is
eligible for publication. The public list, its status filters and totals, and
the office all consume published status values.

RSS is available at `/api/feeds/zcg.xml`. ZCG items observed today are withheld.
For each proposal/day, the audit feed retains the first status and the final
status, so reverted provisional verdicts do not become notifications. An import
finishing after midnight uses the proposal's original observation time. HTTP
caching and the office's three-minute polling can delay visibility slightly
after eligibility. ZecHub's separate feed and ledger values keep their existing
behavior.

Migration `0004_zcg_d1_publication` is additive. Existing sheet statuses remain
published at rollout; the next import captures their previous values before
staging any changes. No historic verdicts are reset. Deploy startup applies the
migration before serving the new code. Verify both the migration log and live
RSS/office responses after deploying. Rolling back the application does not
require dropping the new table or column, but the older code publishes live
updates again.

The tests in `publication-policy.test.ts` and `published-changelog.test.ts`
cover the cutoff and correction rules. `publications.integration.test.ts` runs
the actual importer, PostgreSQL persistence, proposal queries, office selection,
and RSS route. It requires `ZCG_PUBLICATION_TEST_DB_URL` pointing to a disposable
database on `127.0.0.1` whose name starts with `openzcash_d1_test`; it refuses
other destinations.
