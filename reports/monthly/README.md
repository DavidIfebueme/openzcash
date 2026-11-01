# OpenZcash monthly production standard

**Editorial 4.0 is the active format:** two English PDFs, **Monthly** and **Operations**, plus the **Sources & Data** view. Use [the master prompt](OPENZCASH-MONTHLY-PROMPT.md), [the machine-readable contract](reading-set-contract.json), [the design system](DESIGN-SYSTEM.md) and [the publication guide](PUBLISHING.md).

## Fixed Monthly and detailed Operations

Monthly has 10 pages: cover, ZF, Shielded Labs, Tachyon, Zakura, four wallets, hardware, supporting stack, products, highlights and handoff. Wallets are on **page 6**, products on **page 9**, and the last page opens Operations in the same reader. Operations owns payments, ZCG proposals/decisions, votes, community activity, project status, treasury and events. Its 20-page reference is not a future quota. Sources & Data keeps complete registers, exact values and original links without becoming a third PDF.

The approved reference PDFs are stored in `standards/editorial-4.0/`; their hashes and manifests are in `reference.json`. They remain usable when the preview server is off. Historical numbers, logos' surrounding copy, vote schedules, counts and sign-off must not be copied as current facts. Fresh evidence and real review are required every month.

## Run preparation

The existing Codex routine is scheduled monthly on day 1 at 09:00 America/Sao_Paulo. Read `routine-activation.json` for whether the Editorial 4.0 prompt has actually been saved in that job. The native Editorial 4.0 update was authorized, saved and verified on October 1, 2026. Each run must still match the saved prompt to the active standard and complete fresh publication gates. It is a local Codex task and requires that host to be available. This repository does not run a cloud cron.

Read the active standard from the durable project folder before consulting deployed historical instructions. Run `python reports/monthly/check_monthly_standard.py --scheduled-for YYYY-MM-01` to verify the saved format, approved reference hashes and intended calendar boundaries. Use `--automation-file /absolute/automation.toml` to also compare the actual saved job with `AUTOMATION-PROMPT.md`. This check does not fetch data, generate a report or establish a successful future run.

Keep one private workspace per issue with current raw sources, capture metadata, evidence snapshot, reviewed calculations, coverage/status registers, page content, assets, chart exports, per-page review and a production record for both PDFs. Store issue-specific facts in data, never in a reusable renderer. Derive closed-month and comparison dates from the intended schedule; keep the actual evidence cutoff separate.

## Research, export and review

Follow the master prompt for coverage and financial logic. Requested, approved, committed and paid amounts stay distinct. Keep range/unknown semantics. Reconcile payment rows before rounding. Date ZEC holdings and their price separately. Check community and proposal counts against the current reviewed universe.

Use the approved layouts and the current evidence to compose both PDFs. Preserve Data artifact identity and edits where applicable. Export reviewed charts with source/query/hash bindings. Inspect every final PDF page for copy, facts, logo authenticity, size, alignment and clipping. Record fresh sign-off tied to source, renderer, page and both PDF hashes; retain automatic financial checks and semantic review.

For a current Editorial 4.0 issue, run `validate_reading_set.py --content /private/issue/issue-content.json --evidence /private/issue/reading-set-evidence.json`, followed by `test_reading_set_gates.py --issue-dir /private/issue`. The private evidence packet includes complete source captures with hashes/timestamps, independently reconciled Sheet/API ledger rows for both months, display bindings, complete register identities and wallet release records. These gates check financial sums, payment coverage, missing values, source freshness, proposal/community coverage and stable/prerelease labels. They complement the all-page editorial/visual review and `test_reading_set_import.py`; they do not replace either. Keep source captures and review packets private.

Prepare the reader as a complete bundle. Monthly and Operations keep independent page positions, counts, chapter navigation and downloads. Both upper and lower arrows turn one page. The final Monthly button opens Operations page 1 of the same issue. Sources & Data provides search, pagination, original links and CSV. Verify complete-page fit at desktop and compact sizes and render the actual PDF at least at 2×, not full-page thumbnails.

## Legacy tools and migration boundary

`standards/editorial-3.7/` preserves the former instructions. `publication-contract.json`, `render_pdf.py`, `validate_issue.py`, `test_quality_gates.py`, `build_viewer.py` and `import_publication.py` currently implement the legacy full evidence / single-PDF pipeline. Their slide-7 and appendix checks are historical constraints, not permission to change the approved public layout back. The date-specific `build_bundle_preview.py` is the September prototype, not a generic next-month source collector.

Reuse the legacy tools' financial, source, type-size and review protections when preparing current evidence. `import_reading_set.py` now imports both reviewed PDFs and the four registers into `src/lib/monthly/reading-sets.json`; the public `/monthly` reader selects that bundle while retaining legacy editions. Its source folder and hash-bound review are described in [PUBLISHING.md](PUBLISHING.md). Never call a successful legacy import evidence that the two-publication integration works. Verify the current outputs and live reader before claiming publication. Do not silently loosen the data gates or publish only one PDF.

This change locks the prompt, schedule and acceptance standard. It does not turn the dated preview into a new monthly close or claim that the production website already supports the new bundle. [PUBLISHING.md](PUBLISHING.md) defines that final integration and publication gate.
