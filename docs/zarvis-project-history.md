# Project history: the OpenZcash evidence record

The product decision is to help a reader reconstruct what a project proposed,
what was decided, which payments were recorded and what work can be evidenced.
The same source-linked record serves the web profile and Zarvis. This is a
project record, not a performance rating or an allegation engine.

## First release

- `/ecosystem/history` searches every identity in the existing project and
  community catalogs. Evidence views, category, search and order persist in the
  URL. Cards show linked records, not portfolio funding totals or ratings.
- `/ecosystem/history/{id}` opens with a computed four-part overview: funding,
  public work, milestone acceptance, and integration/use. Latest dated work,
  payment and decision link to their sources. A research checklist names
  coverage gaps without inferring lateness or failure. Funding, Timeline and
  Evidence tabs use shareable URLs; browser back preserves the previous view.
- Grant-list rows and grant-detail pages link into reviewed project identities.
  Shared awards list every mapped component. No fuzzy financial join is used.
- `GET /api/project-history?q=...` resolves identities. Search may return several
  candidates; no candidate is silently chosen or merged.
- `GET /api/project-history/{id}` returns the complete assembled public record.
  `?month=YYYY-MM` filters **timeline event dates in UTC only**. Grant amounts
  remain all-time; undated records are excluded and counted. This is not an
  as-of reconstruction of what was known that month.
- Zarvis's `query_project_history` uses that same reader. A narrowly phrased
  `Show project history for Zaino.` (also supported in Portuguese and Spanish)
  returns a computed overview without requiring a model. Broader analysis can
  call the tool; bounded excerpts disclose their counts and must not be summed.
  The API and tool expose the same derived insights as the profile; these always
  describe all linked history even when a timeline month is selected.

Financial reads use the existing database mirror without mutations and preserve
the published proposal-status policy. No private scanner, viewing key or admin
override data is exposed. A source failure leaves amounts unavailable. Catalog
funding references can remain as explicitly dated context. Queries do not run
the importer or the repository collector.

## Identity and financial rules

1. A project uses its canonical catalog ID. Repository membership comes from
   the reviewed project mapping, not every repository under an organization.
2. Grant-title associations come from curated funding events, with an exact
   case/whitespace-normalized title and program match. Community recipient
   aliases and application topics must already be curated. Substring search
   never establishes a financial association. Multiple matching proposals block
   the amount/milestone association until identity is resolved.
3. Grant identities and payment IDs deduplicate records. Reused grants name all
   associated project identities. Amounts describe the grant, never an inferred
   component allocation; there is no cross-project grand total.
4. Requested USD, published approval **status**, ledger budget USD, budget USD
   of paid entries and recorded ZEC are different measures. The available
   proposal source has no distinct approved-amount field. An approved request
   must not be relabeled as an approved amount without further evidence.
5. Values remain decimal strings of cents/zatoshis, summed with BigInt.
   Negative returns remain negative. Unknown and absent values remain null;
   incomplete subtotals include missing-record counts. Test, internal and
   operational worksheet rows are outside this grant history.
6. Payment dates, decision dates, publication dates, import dates and snapshot
   dates are separate. Unknown event dates stay unknown. A stale catalog
   decision cannot overwrite a more recent published proposal status.

## Evidence vocabulary

| Level | Establishes | Does not establish |
| --- | --- | --- |
| Source record | A proposal, published decision or ledger entry exists | Delivery, current valuation or bank/on-chain settlement |
| Published artifact | A repository release was published | Acceptance of a funded milestone, adoption or impact |
| Team reported | A mapped team progress reference or reviewed report claim | Independent acceptance of the work |
| Reviewed delivery | A source documents delivery/acceptance of the specifically linked milestone | Overall project success or causal impact on the network |
| Documented integration | A reviewed source documents a specific integration | A user count, traffic volume or causal impact |
| Usage observation | A scoped metric with unit, period, population and methodology | Use outside that scope, unique people from requests, or total network adoption |

The repository snapshot is bounded and dated; do not call it the complete or
live release history. Maintainer progress links without extracted dates remain
undated. A community without a repository is assessed from its own reports,
not assigned zero output. Missing evidence is not proof of non-delivery,
lateness, misconduct or zero funding. No unsupported impact scores are emitted.

## Persisting new learning

`src/data/project-history/evidence.json` is the versioned admission point for
reviewed public reports, releases, integrations, usage and milestone evidence.
It includes two directly inspected Zaino releases as publication evidence only.
Repository sources are refreshed separately with the checked collector and audit command in `docs/ECOSYSTEM.md`. Approvals, payments and
release reviews cannot manufacture delivery sign-off; no acceptance or usage
claim has been admitted merely to fill the interface.

For each new record, a reviewer must inspect the original source, record its
event date, canonical project ID, source URL, review date and a concrete review
note. `reviewed_delivery` additionally requires the exact linked milestone IDs.
A team statement stays `team_reported` unless the stronger claim is actually
supported. `published_artifact` records add reviewed releases beyond the bounded
snapshot and deduplicate the same release URL. `usage_observation` requires a
nonnegative decimal metric, unit, period, population and methodology; the period
cannot extend past publication. No other type can carry a measurement.
Only acceptance reviews may bind milestone IDs. All those IDs must still resolve
under the exact project/award mapping; otherwise the review is retained visibly
but withheld from current acceptance insights.
Do not auto-promote model summaries into reviewed facts. Never store
private discussions or credentials in this public evidence file.

Corrections append a new ID with `supersedes` pointing to the earlier entry;
they do not erase the original. The validator rejects duplicates, forward/cyclic
references, cross-project corrections and reviews dated before their event.
The Evidence tab retains superseded records and their review notes. Neither
superseded nor not-yet-eligible reviews affect current insights. Paid-entry counts
count distinct ledger rows, not necessarily distinct accepted
milestones. Milestone IDs are ledger content IDs; corrections to their source may require
a reviewed re-link, never a fuzzy reassignment.

To extend coverage, first resolve identity and source scope, then add adapters
or reviewed evidence. Preserve these meanings in the profile, model prompt and
monthly reporting. The monthly producer can consume the public API; this change
does not change the approved Monthly/Operations design or schedule, and does
not automatically rewrite published reports.

## Validation and remaining limits

Tests cover program/identity isolation, repeated-title ambiguity, shared awards,
   partial/failed sources, refunds, exact amounts, release deduplication,
non-inference of completion, evidence admission and correction handling,
UTC filters, and Zarvis's no-model route/tool dispatch. Verify the rendered
directory/profile on desktop and compact viewports, the four sections, source
links, month filters, empty/failure states and the Ask Zarvis handoff.

This is an assembled current record, not a complete bitemporal warehouse.
Database corrections are not reconstructed as historical states. The reviewed
evidence file supplies persistent curation; collecting full release archives,
extracting all community reports, admitting milestone acceptance evidence and
longitudinal source snapshots remain further coverage work. The interface must
keep those boundaries visible.

## Governance comparison

The existing `/governance` page now contains a question-by-question comparison,
starting with the five September 2026 NU7 scope questions. The checked input is
`src/data/governance/comparisons.json`. Original ZCAP and coinholder results were
inspected directly; numbers and judgments from third-party generated artifacts
are not an ingestion source.

Store original integer weights plus their explicit decimal scale and voting unit.
Each question and body has its own denominator. The default includes abstentions;
an explicit control excludes them without changing the exact-tally disclosure.
Question, round and percentage basis persist in the URL. The ZCAP Sprout question
has 134 answers, not the 135 ballots submitted overall. Do not replace its
denominator with turnout. Fractional ZEC is preserved, missing data stays missing,
ties stay ties, and rounding cannot erase a small nonzero minority or imply unanimity.

The panel does not combine weights across questions, equate ZEC with people,
infer voter identities or coordination, or label a leading option a community
consensus. Historical rounds can be added only after mapping their actual options,
rules and original tallies; it currently covers one round, not the full archive.

## Before production

Test the directory filters and browser back, grant-to-profile navigation,
overview-to-detail actions, timeline month/type filters, community reports,
review notes/corrections and the Ask Zarvis handoff. On Governance, switch all
five questions, change the abstention basis, reload the shared URL and inspect
the raw tallies. Check compact screens and keyboard navigation. Source outages
must show unavailable data, never a zero financial amount or a failure rating.

The preview reads the existing public mirror with automatic imports disabled.
Model calls remain disabled in the preview; the direct history answer and model
tool dispatch have automated coverage. A production-provider smoke check remains
necessary before enabling the branch for users. This work does not deploy the
separate chain-analytics branch or change the Monthly publication pipeline.

### October 2026 source audit

History consumes the complete collected public release listing when available, with a compatibility fallback for older snapshots. Removed publications retain their original observed-at date and an explicit no-longer-listed state; they are excluded from latest-current-activity summaries. An updated repository cutoff never substitutes for a report's publication date.

Curated ZecHub DAO proposal references appear as dated context, outside ZCG/Coinholder financial totals. Contextual grant-status notes (for example, ZecKit closure and later maintainer updates) remain in the timeline and do not create additional grants. Community report links with unextracted dates remain undated until a source review admits their claims.
