# Zcash Pitches & Narratives

Public route: `/narratives`. Initial language: English. Portuguese (`pt-BR`) and
Spanish (`es`) are available from the language selector. This is a curated
educational library, not an official ecosystem position or a popularity ranking.
No individual panel preparation, personal biography or panel PDF is used.

## Edit content

- `src/lib/narratives/pitches.json`: 20 stable pitch IDs, theme, audience IDs,
  source cells, explicit attribution, editorial/review status, date, title,
  context, approach, and three reviewed text lengths per language.
- `src/lib/narratives/catalog.ts`: eight narrative families, factual explanations,
  analogy limits, next steps, source records, filters and shareable URL state.
- `src/lib/narratives/es.json`: Spanish catalog/narrative translations, keyed by
  their English source text.
- `src/lib/narratives/ui-es.json` and `i18n.ts`: Spanish interface translations.
  English and Portuguese UI text are paired at the call site.
- `source-records.json`: links and content hashes for the 37 spreadsheet cells
  used in the expanded selection. Open the source cells to review their original
  wording; the hashes identify the text used during this review.

To add a pitch, use a new stable ID, an existing family and valid audience IDs.
Write each text length deliberately; do not generate a longer version by blindly
stitching fragments. Supply all published languages, preserve explicit source
attribution, and link each source cell. An author mentioned in one source is not
necessarily the author of other contributions or of the editorial adaptation.
Review factual claims against primary documentation, then set the actual review
date and status. Keep source titles in their original language for recognition.

To add a language, extend `locales`/`Locale`, supply the corresponding fields in
all pitch records and narrative/UI translations, add its selector label and
metadata alternate. The library and site search use the same catalog. Run
`npx vitest run src/lib/narratives/catalog.test.ts` and the project checks.

## Sources and review evidence

Reviewed on **2026-10-20** (America/Sao_Paulo).

1. Community spreadsheet, tab **Elevator Pitch**, `gid=494982174`:
   https://docs.google.com/spreadsheets/d/1BOl7YEARrMQISaCmNa-C9yW3hDBn5x6y/edit#gid=494982174
   Read successfully through its XLSX export. A1 is the prompt; A2–A125 contain
   124 contributions. Links and content hashes for the selected cells are retained here.
2. Editorial family reference, **Elevator Pitches: “What Is Zcash?”**:
   https://docs.google.com/document/d/1LLYzEBzGQUGJK6VeuY0hGc15CbgG1EFi1as9l6tMa_w/edit
   Read successfully through its text export. All eight families are retained.
3. The source catalog links the primary pages actually consulted: Z.cash Learn,
   How to use Zcash, Shielded and transparent Zcash, zero-knowledge proofs,
   maximum supply; the protocol specification; ZIP 310; and the Zcash privacy
   recommendations. The protocol retrieved was
   `v2026.7.0-318-ga34cfc [NU6.2]`, dated 2026-10-16. ZIP 310 is explicitly an
   **informational draft about existing Sapling key properties**, not evidence
   that a new feature has activated. Legacy zcashd setup advice is not reused.

The initial web reader could not access either Google document, but the export
requests succeeded. There is no unresolved access gap for these two sources.
The guessed Z.cash viewing-keys article was inaccessible and is not cited or
claimed as reviewed; the protocol and ZIP 310 supply the relevant evidence.
Source URLs can change; review dates are snapshots, not claims of live freshness.

Export SHA-256 values (for identifying the reviewed inputs, not live monitoring):

- TXT: `90a203ef1b7a7e8067f32ff4e1225b004b89c342da19c286479e938b6502270c`
- XLSX: `26a3e85a2d569764e9a118f27688fc5336fcb0aa4d4e68fc42dbb3f755259e78`

## Deduplication and editorial decisions

There are no exact duplicate spreadsheet entries after NFKD normalization,
lowercasing, punctuation removal and whitespace normalization. This does not
make the entries independent votes. The document repeats “Unstoppable private
money.” twice and includes reordered variations. It also repeats ideas already
in the sheet. These are one source lineage, not multiple endorsements.

The initial curation groups variations, retaining every used cell:

- Cash: A90/A94/A107; attribution to Elzz belongs to A94 only.
- Bitcoin: A4/A59/A120; supply context: A32/A62/A105.
- Verification: A51/A69/A111; payment design: A17/A78/A125.
- Autonomy/donations: A11/A37/A116; work: A61/A96/A118.
- Business: A63/A61; selective disclosure: A57/A121. The handle @robmarn is in A121.
- Metaphors: A9/A102/A104. The envelope version is an editorial formulation;
  the document separately contains an envelope metaphor. It is not presented
  as a verbatim spreadsheet contribution.
- Short openings: A12/A13/A22; Jonathan Bird, Free2Z is explicitly named in A22.
- AI-era surveillance: A8/A40. This is a perspective on data minimization, not an
  empirical claim that AI can know everything or that Zcash prevents profiling.

Corrections distinguish shielded/transparent transfers, public blockchain data
from bank records, ZEC from BTC, issuance from supply cap, viewing from spending
rights, disclosure scope from universal auditability, and protocol privacy from
network/device privacy. Absolute anonymity, instant settlement, guaranteed
returns, no issuance and quantum-resistance claims are not recommended.

## UX and integration

`src/lib/design-routes.ts` places Narratives immediately before Monthly in the
shared sidebar and app navigation. The existing command palette loads
`src/lib/narratives/search.ts` when opened and finds pitches and narratives in
all three languages. No replacement shell, calculator shortcut or second search
interface is introduced.

URL parameters preserve language, length, query, audience, theme and section.
Content links remove unrelated filters so the target remains visible. Print
selection survives filter changes and uses the currently selected language and
length. Print output includes the selected text, context limits and source URLs.
External references open in a new tab with `noopener noreferrer`; arrows mark
external links. Internal next steps remain within the app.

The page uses the shared light/dark theme tokens and typography. Container
breakpoints account for the space taken by the site sidebar.
The compact introduction leads into a featured pitch and the two library tabs.
Desktop filters sit beside the pitch cards; mobile filters expand on demand.
The glossary is available at the end of the library, and printing controls appear
once a pitch is selected. Audience, length and actions have distinct visual levels.

## Validation

Run `npm test`, `npm run typecheck`, `npm run build` and lint the changed files.
Catalog tests cover translations, source references, filters, shared URLs,
preparation coverage, global search and navigation order. Browser review should
cover both themes, a narrow viewport, clipboard actions, curated preparation,
inline links, the global search and print media with only selected content.
Validation is recorded in the pull request; it does not imply deployment.

## Expanded examples and inline references

The library now contains 20 adapted examples in English, Portuguese and Spanish.
Eight additions cover a coffee purchase (A7/A26), family support (A47/A61),
verification (A51/A69), personal boundaries (A11/A36), independent work
(A11/A37), record access (A57/A121), public addresses (A4/A42) and profiling
(A8/A40). These are illustrative editorial scenarios, not testimonials.

There is no separate Sources tab. Each pitch visibly links its primary references
and source cells. Narrative sections retain their direct references and link to
other examples in the family. Old `view=sources` links fall back to the pitch
library. The preparer allows choosing among matching examples.
