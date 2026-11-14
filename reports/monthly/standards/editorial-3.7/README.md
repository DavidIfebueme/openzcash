# OpenZcash Monthly production standard

Use [the monthly prompt](OPENZCASH-MONTHLY-PROMPT.md) for research and [the design system](DESIGN-SYSTEM.md) for composition. The September reference is an approved example, never the data source for another month.

## Editorial hierarchy

1. **Headline:** one supported conclusion. A number belongs here only when it is the main finding.
2. **Subline:** only information needed to define scope, period or status. Omit it when the page is already clear.
3. **Evidence:** additional detail, a breakdown, comparison or next verified date. Do not restate the headline amount, version or deadline.

Example: **“$168.5k in grant payments”** / **“Sep 1–10, 2026 · Partial month · 11 installments · 192.550 ZEC”** / the individual paid installments. The exact USD total remains inspectable in the source data; it is not repeated in the subline.

A compact treasury hero and the exact total in its reconciliation table may coexist. Table column labels, reference-register identities, page navigation and native text accompanying official artwork are purposeful repetitions. Do not delete names, dates, approval conditions or reporting gaps just to reduce word counts. Repeating the same figure across the cover and a detailed section is different from repeating it three times on one page.

## One issue directory

Each issue owns `report-content.json`, `evidence-snapshot.json`, captured `source-data/`, official `brand-assets/`, native chart PNGs under `charts/`, `chart-exports.json`, `quality-review.json` and its final PDF. Store issue-specific dates, versions, metrics, event details and feature text in the JSON. Keep monthly facts out of renderer and viewer source files.

The JSON's `edition` defines publication month, completed financial month, comparison month, development-window start and cutoff. `quality` binds the source cutoff, ledger hash, reviewed query IDs and critical displayed figures. Its required sections and coverage universe must be refreshed for the new issue. Neither 44 pages, 32 communities nor 37 proposals is a future quota.

For a requested interval inside one month, set `edition.mode` to `period`, `partial` to `true`, `windowStart` and `cutoff` to its inclusive bounds, and `month` and `financialMonth` to that same month. Set `comparisonMonth` to `null` and supply a distinct PDF `filename`. Only the interval's payment rows enter totals, categories and date charts. Paginated payment registers retain every ledger ID once. Newly published reports about earlier activity and standing governance context must keep their actual dates. The default `monthly` mode still requires a completed financial month and its preceding-month comparison.

Fresh source capture and a new editorial review are mandatory for each new month. Retaining the layout does not authorize carrying over findings, balances, quotes, release states or upcoming dates. A missing value stays unavailable. A partial period stays partial. A frozen PDF's market quote never becomes live automatically.

Every new issue uses quality schema 3 or later. Slide 7 is the `wallets` page with `walletLayout: "2x2"`: ZODL, Zingo, Vizor and Zkool, in that order. `walletReleases` and the four `cards` share this roster. Each release retains its source file, exact tag, source key, date, platform and state; an unavailable in-period update uses `evidenceState: "no-update"`, null version/date and an explicit gap statement. The source appendix retains the OpenZcash Wallets directory and official repository links for extras. The validator checks this recurring contract; legacy schema-2 issues retain their original layout.

## Production sequence

Use the bundled Python runtime with ReportLab, Pillow and pypdf. This approved typography uses installed Gill Sans and DIN fonts; missing fonts are an explicit failure, not a silent substitution. Resolve Node and PDF tools through workspace dependencies.

1. Research using the master prompt; retain source responses, capture metadata and complete registers. Refresh the reviewed Data queries and draft the issue JSON.
2. Read the live Data presentation through WebMCP before revisions. Preserve app ID, section IDs, filters, chart edits and owner text changes. `sync_evidence_view.py` only synchronizes authored sections and tables already present in that app; creating a new issue/query universe remains a deliberate authoring step.
3. Update the evidence view, use the installed Data builder, and capture native charts through WebMCP at 3×. Bind PNG hashes, chart definitions and reviewed query-row hashes in `chart-exports.json`. Never replot from a screenshot or substitute another dataset.
4. Run `validate_issue.py` and the regression checks below. Render a draft. Inspect **every page** for semantic repetition, attribution, financial status, dates, line breaks, readable sizes, contrast and collisions. Do not use a contact sheet alone to approve the smallest table or a suspected collision.
5. Record page-by-page editorial and visual review in `quality-review.json`: issue hash, snapshot hash, renderer SHA-256, and each stable page ID with its page hash plus `editorial: passed` and `visual: passed`. Do this only after actual review. Changing copy, data or renderer invalidates sign-off.
6. Run final validation and render **without `--draft`**. Render that final PDF to page PNGs, build the viewer, and verify page navigation, one download, the evidence link and a complete page fitting the available viewport. Keep a production record with PDF hash and any unresolved evidence limitations.

```sh
python validate_issue.py --issue-dir /absolute/issue
python test_quality_gates.py --issue-dir /absolute/issue -v
python render_pdf.py --issue-dir /absolute/issue --draft

# After real editorial and visual review:
python validate_issue.py --issue-dir /absolute/issue --final
python render_pdf.py --issue-dir /absolute/issue
pdftoppm -scale-to 1800 -png /absolute/issue/OpenZcash-Monthly-Month-Year.pdf /absolute/issue/render/page
python build_viewer.py --issue-dir /absolute/issue --viewer-dir /absolute/preview --pdfjs-dir /absolute/pdfjs-dist
```

`render_pdf.py` runs validation itself; normal final export refuses a missing or stale review. Its layout checks reject overflowing paragraphs, out-of-bounds text and tables requiring type below 14 pt. Shorten, reflow or paginate instead of weakening these checks. `--draft` is for working previews; it still enforces data and editorial checks.

Automatic checks catch specific known failure modes. They do not establish completeness of all public ecosystem activity, validate the truth of an unread source, or replace semantic and visual review. Source outages and unavailable month-end balances must remain explicit in the issue.

One monthly task produces one unified English PDF. The authorized recurring publication workflow is documented in [PUBLISHING.md](PUBLISHING.md); the recurring schedule is managed separately from the website.

## Website library

The **Monthly** app at `/monthly` reads the approved PDF itself, using a pinned, same-origin PDF.js distribution. The PDF is not re-composed for the website. Desktop and mobile share page navigation, chapter selection, internal/source links and an optional download. Stable links use `/monthly/{edition-id}#7` for slide 7.

Both the upper and lower arrows turn one page at a time. The thumbnail strip follows the selected page automatically; its arrows must never jump between groups of previews. The page counter, rendered PDF, selected thumbnail and shared URL stay synchronized, including at group boundaries and the first and last page.

After completing the production sequence, import the issue into the local website:

```sh
python reports/monthly/import_publication.py --issue-dir /absolute/approved-issue
```

The importer runs the final quality gates, compares the PDF with its production-record hash, checks all pages against the fixed 1200 × 675 format and requires the slide-7 wallet grid. It derives thumbnails and searchable page descriptions from the PDF, then updates `src/lib/monthly/editions.json` only after every asset is ready. It copies no private evidence or credentials into the public library. `publication-contract.json` fixes the minimum design version and the wallet roster. New months reuse the design, never the old facts or sign-off.

Each standard month has one catalog entry. Partial editions retain their own dates and are explicitly marked **Partial period**. An approved revision uses `--replace`; its new content-addressed asset directory prevents a cached older PDF being shown with newer metadata. Previous assets remain available to already shared PDF URLs. New imports appear in the month selector without a reader code change. The September historical reference is grandfathered by its exact reviewed PDF hash and visibly labeled **Reference edition**; that exception cannot admit another PDF.

Run the website's monthly integrity tests, type check and build, then inspect the integrated preview. Importing prepares local website files; deployment remains a separate action. The public reader has no upload or editing controls.

PDF.js 5.6.205 is vendored under `public/monthly/pdfjs/5.6.205` with its Apache license and distribution hashes. Updating it requires replacing the module and worker together, reviewing the distribution manifest, and repeating reader checks. PDF rendering does not require relaxing the website's evaluation or embedding restrictions.
