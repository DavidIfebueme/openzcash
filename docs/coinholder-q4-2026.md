# Q4 2026 Coinholder submissions

The permanent **Proposals** entry is `/coinholders/proposals`, with direct
application pages at `/coinholders/proposals/:issueNumber`. The round is shown
inside the page rather than in the navigation. Old `/coinholders/q4-2026` links
and application URLs redirect to the collection. The program overview, Coinholder menu,
command palette and FPF page link to the round. Historical rounds keep their
existing result redirects.

## Sources and eligibility

- Repository: <https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram>
- Required label (exact match): `Ready For Vote - All Steps Completed`.
- Schedule: <https://forum.zcashcommunity.com/t/q4-coinholder-directed-retroactive-grant-program-call-for-proposals/58598>

The source currently has no explicit Q4 label or milestone. The Q4 view selects
open issues created from the October 30, 2026 call through December 31, 2026.
Pull requests and decided, withdrawn or cancelled issues are excluded even if
they retain the ready label. Older rounds are not inferred from titles.
If FPF adds a round marker, update this selection rule and its tests together.
This page represents active submissions; it is not an archive of all Q4 votes.

Program administration is filed on the forum, not as a GitHub application, so
the listing never contains it. `src/lib/coinholder/administration.ts` records
each such request with its forum link and the cycle whose vote carries it; for
Q4 2026 that is FPF's 2027 renewal ($58,000). The page lists it in its own
**Program administration** section below the applications, and the round's
Proposals count and total requested include it (on November 17, 2026, 54
GitHub applications plus this request made 55). The API returns it in `administration`, apart from
`proposals` and `totals`.

Amounts come only from `Requested Grant Amount (USD)` and are stored in cents.
An explicit amount may include a parenthetical `reduced from` or `increased from`
history note, optionally dated and referencing another section. For example,
`$1,690 (reduced from $2,000 on 2026-11-02, see Other Funding Sources)` contributes
$1,690 to the total. Both amounts must be valid USD values and agree with the
stated direction. Conditional amounts and arbitrary prose remain unknown.
Unrecognized or missing amounts stay unknown; project cost is not substituted.
The list sends summaries to the client and renders the full Markdown only on
the application page using the existing safe proposal renderer.

## Refresh and failure behavior

`src/lib/coinholder/q4-server.ts` reads all pages of the public GitHub issue
listing. It uses the existing optional server-side `GITHUB_TOKEN` and needs no
database. Successful snapshots are reused for five minutes on access. Failed
reads retry after one minute; a previous successful snapshot remains explicitly
stale. Without a complete successful read, figures are unavailable, not zero.
The cache is per process and is lost on restart.

`GET /api/coinholders/proposals` exposes the same summaries, source status and
last successful check. Initial unavailability returns HTTP 503. Proposal
bodies and credentials are not exposed by this endpoint.

The schedule determines phase copy, not evidence that a poll is running or a
vote was cast. Closing deadlines use UTC. The active cycle opens by default in Results, Voting activity and Verify.
Each shows an illustrated pending state with the same announced timeline.
Historical results are selected explicitly with `?round=<id>`; activity archives
currently cover Q3 2026 only. A pending cycle never fetches Q3 voting data,
shows zero tallies or enables verification of an unpublished result.

## Validation

Unit coverage includes exact-label eligibility, historical exclusion, amounts,
phase boundaries, pagination, cache retries, source failures, removed labels,
search, filters, sorting, direct links and historical redirects. The public
navigation and Zarvis index also include the new entry.

The collection uses a compact round summary and schedule, searchable proposal
cards, and a Sources & method disclosure for eligibility details. Long applicant
summaries are limited to two lines in the list; the application remains complete
on its detail page. Refresh uses the same five-minute server cache. The page
also refreshes while visible without replacing a search field during typing.
Search (`q`), topic (`topic`) and ordering (`sort`) live in the collection URL.
Browser Back, reloads and shared collection links restore the same view. Filter
edits replace the current history entry through Next's native History API
integration, without refetching the page for every keystroke. Unknown topics or
sort values fall back to the unfiltered/default selection; clearing filters
preserves the selected ordering.

## Recurring cycles and adjacent pages

`src/lib/coinholder/cycles.ts` owns the active cycle, announced dates, phase and
route helpers. The shared timeline renders in Proposals, Program overview,
Results, Voting activity, Verify and The fund. Overview labels Q3 as the latest
**results**. The fund keeps pending requests outside its approved commitments.
The Copilot links to current proposals and the results archive.
Both public API indexes and the published Coinholder Copilot instructions identify
the current submissions endpoint separately from the dated round archive.

FPF describes the program as quarterly. Future dates must come from the next
announcement, not an automatic four-month offset. To advance the cycle, update
`ACTIVE_CYCLE` and its GitHub intake bounds together. The current proposal reader
uses that configuration; its internal `q4` names refer to the initial integration.
The page and API remain `/coinholders/proposals` and `/api/coinholders/proposals`.
Add a completed cycle to `ROUNDS` only after checking published outcomes; add
activity/verification sources only when they exist. The calendar alone never
creates results or a voting-chain identifier.

Historical result, verification and proposal-return links carry the round id,
so changing the active cycle does not redirect a Q3 record into a Q4 view.

If The fund cannot read its live balance source, it still renders the current
cycle and published payouts. Balance-dependent values remain unavailable;
no missing balance is presented as zero or counted as available funding.

The round cards share the existing Zcash brand mark, a concise in-progress
status, and a connected timeline. The timeline stacks vertically on narrow
screens; decorative graphics are separate from the text and dates. Scheduled
phases never turn into an inferred final result.

The timeline follows the announced windows. A window whose announced end has
passed shows a check mark, the open window is marked **Now**, and between two
windows the one that opens next is marked **Next**. The Results stage of the
pending views is never marked from the calendar. `cycleNote()` gives the one
sentence under the round name: between windows it names the one that closed
and the date the next opens ("Submissions are closed. Community review opens
Nov 16."); after the scheduled vote it falls back to the neutral line.

Proposals, Program overview and The fund show the round's illustration beside
that sentence: a zebra at a ballot box. It carries a ballot while submissions
are open, drops it in the box during the scheduled voting window and stands
beside the box the rest of the time. The drawing was generated for OpenZcash
with an image model and reduced to flat alpha masks in
`public/illustrations/zebra-*.png`, one for the ink and one for the ballot per
pose, which the stylesheet fills with the theme's ink and accent colours, so
the same files serve the light and dark themes. It is decorative and hidden
from assistive technology; the sentence beside it says where the round stands.
