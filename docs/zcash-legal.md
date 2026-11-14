# Privacy & Policy

`/legal` is one Updates desk, placed directly after ZEC Observatory in desktop, mobile and command-palette navigation. PGPZ appears first in an editorial feature. `/legal/pgp` redirects to the same desk with `source=pgp`, preserving search, topic and region filters. There is no second PGP page or tab.

## PGP and email access

Pretty Good Policy for Zcash is an independent source of education, analysis and advocacy. The feature uses its official logo unchanged, links its public website, and highlights the newest dated public item. **Join PGP by email** opens the official community signup at `https://community.pgpz.org/signin?callbackUrl=%2F&reason=signup`.

Verified on 15 October 2026: PGPZ now advertises public memos and special reports at `https://pgpz.org/updates`, and invites visitors to join its community to receive policy memos by email. The signup is on PGPZ; OpenZcash does not collect email addresses or submit subscription forms.

## Coverage

- PGPZ public archive: dated weekly memos and special reports. The retired community-homepage featured schema is no longer used. No authenticated pages or X scraping.
- Argentina AAIP and Uruguay URCDP: public authority news listings covering data protection, privacy, access to information and policy. Original Spanish metadata is retained.
- Banco Central do Brasil's public press-note Atom feed, filtered for crypto, virtual assets and self-custody.
- Reviewed primary-source records from Brazil, Argentina, the EU, the US and FATF. LATAM is a regional filter, not complete coverage of every country.
- PGPZ analysis, official proposals, enacted instruments and application dates remain distinct. No country legal/illegal rating is inferred.

## Daily collection and persistence

The production Node server starts `startLegalSchedule()` from `src/instrumentation.ts`: first check 30 seconds after boot, then every 15 minutes. Each source is collected once per calendar day in **America/Sao_Paulo**. Successful-day checkpoints survive restarts. Source failures retry at most hourly; 15-minute checks do not mean 15-minute scraping.

Migration `0008_legal_public_archive.sql` creates a dedicated public-only archive table. Each source has a transaction-protected short lease, canonical-URL entries, normalized content hashes, observation dates, previous revisions and health. External requests run outside database transactions. Concurrent collectors cannot overwrite a newer lease. Only this table is written; accounting tables are not involved.

A rolling feed dropping an item, an empty valid snapshot, or a source outage never deletes previously collected entries. Source failures are tracked independently. Collection preserves publisher publication/update timestamps separately from discovery, review and application dates. Reviewed records take precedence and a later observed source revision is flagged for review; collection never renews legal status or `reviewedAt` automatically.

Fixed public endpoints only, no redirected fetches or forwarded credentials, 7-second timeout and 512 KiB limit. Pages read the durable archive instead of triggering scraping. If storage is unavailable, previously read public records (within the process) and reviewed seeds remain visible with an explicit unavailable archive state. This is not a complete historical archive before collection began.

- Read-only health: `GET /api/legal/status`, public safe timestamps/counts only.
- Manual recovery: `POST /api/cron/legal` with the existing `CRON_SECRET` Bearer token. There is no URL/day/force override and no public write endpoint.
- Pause: `DISABLE_AUTO_REFRESH=true` disables timer and authenticated manual collection, including local financial preview environments.
- An automated health check probes production daily at 09:15 São Paulo. It waits quietly while this feature is unpublished and never merges or deploys. The server is the collector; the health check is bounded recovery only.

The daily server schedule becomes active **after the feature and migration are deployed**. A local preview alone does not activate production collection.

## Editorial contract

1. Use a verified canonical source and its actual publication date. Never substitute crawl time or a URL date. Where PGPZ supplies only a memo week, store `dateBasis: "reporting-period"` and show **Week of**, not a publication claim. Labeled dates on special reports use `source-date`. Reports without an exact day (such as H1) stay accessible on the publisher archive and are not assigned an invented timeline date.
2. If only `updated` exists, set `dateBasis: "updated"`. Keep `sourceUpdatedAt` when publication and update both exist.
3. `effectiveAt` means **Applies from**, not adoption. Explain transitional or actor-specific scope.
4. Collected items remain Analysis or Official update. Legal-effect labels require primary-source review.
5. Keep summaries short, link originals and identify who/what is covered. General crypto/privacy context is not necessarily Zcash-specific.
6. Reviewed records win URL duplicates. Amendments and cancellations need review; an old article does not establish current country-wide legality.
7. Keep source failures, empty filter states and coverage limits visible.

Filters (region, source, topic and search) are shareable. Source links open externally with that behavior indicated. The HTML sources use the inert `parse5` parser, with no script execution, resource loading, or browser automation. Layout/schema changes fail the affected source instead of advancing its success timestamp. The old PGPZ community URLs reconcile to the public archive without deleting earlier revisions.

## Source review and artwork

Current source check: `docs/audits/2026-10-15-legal-collection.json`. ANPD and EDPB were not enabled: their tested public endpoints returned maintenance/blocked responses rather than stable collector data. They are not counted as automatic coverage.

Initial audit: `docs/audits/2026-10-05-zcash-legal-sources.json`. Signup/brand audit: `docs/audits/2026-10-05-pgp-signup.json`.

Official logo: `https://pgpz.org/assets/brand/pgpz-primary-on-dark-2048w.png`, saved unchanged at `public/logos/pgpz.png`. Decorative circles and the editorial panel are site styling, not a recreated PGP logo.

## Verification

The legal tests cover parsing, source bounds, source-only filtering, region/topic intersections, failure isolation, archive retention, revisions, date boundaries, locks/retry, cron authentication and read-only degradation. Postgres integration tests require a disposable local database named `openzcash_legal_test` via `LEGAL_ARCHIVE_TEST_DB_URL`; never use a production database for tests. Visual checks cover desktop/mobile and light/dark themes.
