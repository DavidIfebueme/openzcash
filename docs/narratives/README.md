# Zcash Pitches & Narratives

`/narratives` is an OpenZcash educational library with 20 pitches and eight
perspectives on private digital money. English is the default; Brazilian
Portuguese and Spanish have complete editions. Every pitch has one-sentence,
approximately 30-second and approximately 60-second versions.

## Editorial direction

The current copy was written for OpenZcash around everyday situations: receiving
income, helping family, supporting projects, running a business and building
payment software. These are illustrative scenarios, not customer testimonials.
The text explains the value of privacy while distinguishing fully shielded
transfers from transparent transfers, and payment confidentiality from device
or network anonymity. It makes no price, adoption or investment promises.

The page contains no external links, source panels, community-cell references
or contributor attributions. All next steps stay within OpenZcash. The earlier
source-based edition was replaced; `source-records.json` is a historical research
record of that previous edition, not authorship metadata for the current copy.
It is not imported by the application. Removing public references does not change
the requirement to fact-check future technical edits.

## Content and presentation

- `src/lib/narratives/pitches.json`: complete pitch editions and audience tags.
- `src/lib/narratives/narratives.json`: eight editorial perspectives and internal next steps.
- `catalog.ts`: filtering, shared links and URL-state validation.
- `ui-es.json` and `es.json`: translated interface and filter labels.

Narratives use an editorial two-column layout: a compact introduction beside an
opening line, expandable longer explanation, technical context and related
pitches. On narrow screens the sections stack. Colors follow the shared light
and dark themes. Printing includes only selected pitches and relevant context.

The sidebar entry is **Zcash Pitches & Narratives**, before Monthly, with an
outline megaphone icon. The shared command palette loads the multilingual catalog
only when opened. Ongoing Test starts collapsed while retaining normal toggling.

## Validation

Run the catalog and UI tests, lint changed files, typecheck and build. Check
translations, filtering, internal links, clipboard feedback, print media,
light/dark appearance and narrow-screen layout in the browser. Tests enforce
that library links stay internal in both sections and all three languages.
Local validation and a PR do not mean the page has been deployed.
