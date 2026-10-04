# Ecosystem and development catalog

`/ecosystem` is a source-linked directory of Zcash projects and components.
`/development` exposes the underlying public repositories with GitHub owner,
purpose, funding-history, archive and fork filters, plus 7/30/90-day activity.
Both apps are available from the existing app launcher. `/api/ecosystem` serves
the same public dataset.

## Data boundaries

- `src/data/ecosystem/registry.json`: reviewed project identities, organizations,
  public accounts, purpose tags, dated funding evidence and proposal review.
- `src/data/ecosystem/snapshot.json`: public GitHub metadata and measured
  activity, with collection timestamps, source URLs and the registry SHA-256.
- `scripts/sync-ecosystem.mjs`: read-only, repeatable GitHub collection using the
  existing `gh` authentication. No discovered repository is cloned or executed.

The app renders a dated snapshot, not an automatically refreshing live feed.
Page requests do not run collectors, read GitHub credentials, or write to the
grant accounting database. A registry/snapshot hash mismatch fails validation
instead of publishing a mixture of different inventories.

## Coverage

The registry distinguishes complete public-account inventories (`scope: all`)
from selected, source-associated repositories belonging to individuals and
multi-chain organizations. Full inventories include archived repositories and
forks, and paginate until the API returns a short page, including the empty
trailing page for exact multiples of 100. GitHub User accounts and Organization
accounts use their respective endpoints. All results must be explicitly public.

Repository transfers are resolved through GitHub and deduplicated by stable
node ID, retaining old names as aliases. Complete account coverage does not mean
every repository in an account is an actively supported Zcash application.
Private, deleted and undiscovered repositories are not included. Code hosted
outside GitHub is linked as a public project source without invented GitHub
activity or repository counts.

Projects and components are separate from repository identities. A family and
its component may both have directory entries; renewals are funding events, not
new applications. Repository purpose has three evidence levels:

- `reviewed`: an individual `repositoryClassifications` record, matched by
  stable GitHub node ID, with category, scoped tags, rationale, date and source.
- `project-associated` (shown as Project-linked): all linked projects agree on
  a category, but the repository has not been individually reviewed.
- `inferred`: no individual review or unanimous project category is available;
  metadata keywords provide a limited organizational aid.

Project array order never chooses a category. Family tags stay on the project;
repository search uses individual review tags, GitHub metadata and associated
project names. It does not inherit every platform, feature or fork claim from
a family. GitHub lifecycle flags remain separate from curated support notices.
Project notices reach repositories only through explicitly scoped stable IDs.
Raw `stage` values mix artifact type, maturity and uncertainty and are not shown
as verified product-support claims. These classifications are not code audits
or endorsements.

The 8 September 2026 correction adds 31 individual repository-purpose reviews,
covering 29 confirmed audit cases plus two identified DNS seeders. Reusable
client/translator crates are SDKs, deployed services are infrastructure, an
interactive wallet CLI remains a wallet, and a format survey is research.
These primary-purpose choices do not exclude secondary use cases. The
remaining project-linked/inferred repositories are not silently certified.
GitHub owner options cover every namespace present in the snapshot; Ecosystem
instead filters the separately recorded project/team association.

## Funding provenance

Organization financing, repository namespace, project maintainership and
project-specific grants are separate relationships. The grant filter requires
an explicit positive decision on a source-associated project or contribution.
It must not infer that every repository owned by a grantee was grant-funded.
For shared upstream projects, grants cover the cited contribution scope, not
the entire library or every maintainer.

The reviewed proposal universe contains 179 approved rows: 84 software, 6
research, 42 education, 23 service and 24 non-app proposals. This is a dated
review of the official proposal ledger, not a claim that 179 applications were
built. Renewals are consolidated, and unresolved repository associations,
conflicting decisions and unverified closeout states remain visible.

An approval is not proof of payment, milestone acceptance, delivery, deployment
or continuing support. Events retain their specific proposal and repository
evidence. When a ledger date precedes the original proposal discussion, the
decision date remains unknown; the original recorded value and discrepancy are
preserved rather than silently assigning a false chronology.

Both project and repository details retain the funding program (ZCG or
Coinholder Grants) and the project's specific scope note. Other funded projects
sharing a repository are linked separately, not counted as awards to the
component. Zexcavator references only the initial ZeWIF approval (A309), scoped
to phase 4 / deliverable 4.1. It is not a new grant; the later error-handling
renewal (A383) is not inherited. Approval counts measure project associations,
not distinct awards; deduplicate decisions by source URL when counting awards.

Examples of organization-level distinctions:

- Zcash Foundation and Bootstrap/ECC received direct Development Fund
  allocations under [ZIP 1014](https://zips.z.cash/zip-1014). Their direct
  allocations ended with the November 2024
  [ZIP 1015 transition](https://zips.z.cash/zip-1015). This does not establish
  that all other financing or operations ceased.
- ZF's [May 2026 stewardship announcement](https://zfnd.org/zcash-foundation-assumes-stewardship-of-core-zcash-community-assets/)
  distinguishes administration of the `zcash` namespace from collaborative
  maintenance across teams.
- [ZODL's seed financing](https://zodl.com/zodl-raises-25m-in-seed-funding/),
  [Zakura's donation-funded teams](https://zakura.com/announcements/introducing-zakura/)
  and [Shielded Labs' independent funding disclosure](https://shieldedlabs.net/)
  are not recorded as ZCG project awards.

## Activity definitions

Commit totals come from GitHub's current default-branch history, bounded by a
common collection cutoff and 7/30/90-day start times. They measure reachable
commit records, not contributor effort, code quality or delivered features.
Commits shared between separate original repositories are not deduplicated.
Shared and multichain repositories may include non-Zcash work; their counts are
repository-wide, not isolated measurements of Zcash-specific development.

Forks remain visible, with individual counts, but are excluded from headline
activity totals to avoid duplicating upstream history. A missing measurement
is `null` and displays as a dash, not zero; coverage is reported separately.

Release collection follows every page and filters by publication time rather
than stopping at an old creation date. Published records include prereleases
and can contain repository notices. A release marker is not proof of a stable
package or production deployment. Push time and release publication time are
different measurements.

Sources: [GitHub repository REST API](https://docs.github.com/en/rest/repos/repos)
and [GitHub GraphQL commit history](https://docs.github.com/en/graphql/reference/commits#commit).

## Refresh and verify

With GitHub CLI already authenticated for public read access:

```sh
npm run sync-ecosystem
npm run test:ecosystem-sync
npm run audit:ecosystem
npm test
npm run typecheck
npm run lint
npm run build
```

The normal sync refreshes every inventory and activity measurement. The optional
`npm run sync-ecosystem -- --cached` resumes a local research collection using
its existing cutoff and cached source reads; it is not a freshness check.
Cached resumes are accepted only within 24 hours and explicitly retain the original cutoff. The cache is ignored by Git and must never contain tokens or private metadata.

A classification-only review can retain the existing GitHub snapshot. In that
case, review the registry changes, reconcile only its SHA-256 in the snapshot,
and verify that all repository metadata, inventory records, activity and
collection timestamps are unchanged. The registry review date is not a new
GitHub collection date. Changes to the collected identity/inventory scope
require a collector run, not a hash-only reconciliation.

A failed or incomplete full-account scan cannot replace the prior snapshot.
Selected-repository or activity failures also prevent publication. The collector checks stable repository IDs to prevent a reused path from silently changing project identity.
Review warnings, registry changes, identity transfers, proposal decisions and
funding evidence before publishing. The GitHub sync does not automatically
reclassify new grant proposals or validate new funding associations.

Tests cover pagination boundaries, release ordering, fail-closed snapshots,
alias matching, filters, historical grants, missing activity, fork exclusion,
source URL safety and registry/snapshot consistency.

X/Social Radar ingestion and its API are outside this implementation.

### Source freshness and history audit

`npm run audit:ecosystem` checks the catalog-to-snapshot hash, all mapped repository names, complete source reads and a seven-day repository freshness budget. It exits nonzero on stale/incomplete data. Run it before publishing ecosystem/history changes. It does not schedule a refresh or validate milestone delivery. History screens also disclose when repository data is more than seven days old.

To produce an inspectable per-identity map with an explicitly supplied public ledger export:

```sh
npm run audit:ecosystem -- --finance /path/to/public-finance-records.json --baseline /path/to/prior-snapshot.json --output /path/to/audit.json
```

The output includes every catalog identity, canonical repository, collection time, platform-specific reviewed additions, grant-association basis and unresolved evidence gaps. An omitted finance export leaves finance unassessed; the command never imports or writes the ledger.

`activity.releases` remains the 90-day activity measurement. `activity.releaseHistory` preserves the complete currently listed published release history fetched through the common cutoff. Tags without published releases and drafts are excluded. Previously observed records absent from a successful new listing are retained in `unlistedReleases`, with their original observation time and missing-as-of date; they remain traceable but do not become current release claims. A new measurement cutoff is not a rereview of all manually curated descriptions or financial associations.

Raw GitHub prerelease flags are preserved. Presentation also recognizes explicit alpha/beta/RC/preview markers in version tags, because maintainers can leave GitHub's flag unset. A non-preview marker alone is not proof of a stable package, mainnet activation or production deployment. App Store versions remain separately scoped by platform and storefront.
