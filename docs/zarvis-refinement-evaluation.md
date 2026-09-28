# Zarvis refinement evaluation — 2026-09-27

Local date: 27 September in America/Sao_Paulo. Real requests below completed on 28 September UTC. This is evidence for the development candidate, not production acceptance.

## Scope

- Preserve requested analysis after the treasury calculator returns verified figures.
- Clarify Sapling viewing-key capabilities and separate ZIP revisions/status/dates from live activation.
- Add bounded Auto, Quick and Deep analysis modes.
- Tie mascot reactions to the request/response; remove automatic celebration and settle answer gestures.

## Regressions and corrective iterations

1. The former successful-calculator branch immediately returned its numeric summary. An analytical request therefore lost its requested limitations and sensitivity test. It now preserves the deterministic numbers and continues into checked synthesis. Simple calculator questions retain the short branch. A regression checks both requested analysis and suppression of an unsupported financial amount.
2. A real ZIP 310 attempt returned only a promise to fetch another passage after exhausting its tool rounds. The final round now exposes no tools, including web search, and explicitly requires an answer or a precise evidence gap. The repeated question returned a substantive answer.
3. Using high reasoning for every analytical Auto question caused the community scenario to hit the 110-second deadline. Auto analytical questions now use medium effort, while explicitly selecting Deep analysis uses high. A repeated community scenario completed in 74.25 seconds. This is not a general latency guarantee; heavy questions can still time out.
4. Browser inspection showed old pose-specific CSS taking precedence over two new reaction animations. Selector precedence was corrected; computed animation names then matched the comparing/attentive reactions. A completed response has one arrival gesture followed by quiet breathing, rather than a continuously repeated speech gesture.

## Real configured-provider checks

Provider: xAI, model: `grok-4.7`. Synthetic public questions only, through loopback `/api/zarvis`. The application held the credential in server memory. No credential or private conversation is included in this report. All final checks below used zero hosted web-search calls.

| Case | Mode | Observed latency | Human review of the returned answer |
| --- | --- | --- | --- |
| ZCG + Lockbox at a hypothetical 20× ZEC price; three limitations and one sensitivity test | Auto / medium | 74.25 s | Complete calculator block plus analysis; distinguishes valuation from cash and separate spending restrictions; discusses fixed nominal budget, liquidity and governance; suggests growing the budget while holding price fixed. Treats 20× as conditional, not a forecast. |
| Does ZIP 310 prove an IVK holder can always detect spent Sapling notes? | Auto / medium | 53.49 s | Rejects that premise, distinguishes IVK from FVK nullifier capability, explains document-wide FVK assumptions and limits, and treats matching-OVK recovery separately. |
| Compare IVK/FVK and whether either can spend; requested under 180 words | Explicit Deep / high, browser | 33.98 s | Correct IVK/FVK/OVK distinctions, no spending power, official ZIP source. More verbose than requested; brevity remains an improvement area. |
| ZIP 317 revision 0: 4 Sapling spends, 1 output, 1 Orchard action, no transparent actions | Auto / low | 14.04 s | 25,000 zatoshis using max(4,1) + 1 logical actions; conventional wallet policy, not a consensus minimum; no claim about today's active revision. |
| Current ZEC price with only a stale saved quote | Auto / local | 0.09 s server request | Explicitly says current price could not be confirmed and dates/labels the saved quote. Mascot uses the uncertain reaction, not celebration. Zero model calls. |
| Current ZEC price after the feed recovered, sent by clicking the gallery chat button | Auto / local | Not used as a latency benchmark | Returned the fresh quote with its timestamp and source. This also verified pointer-based send in a fresh browser tab. |

These are a small targeted evaluation, not a statistically representative accuracy score or a claim that Zarvis knows everything. The treasury reply still repeated some verified figures in its narrative, and the long ZIP reply included more metadata than necessary. The amount guard checks numerical provenance, not whether every sentence is entailed by its source.

### Reproduction prompts

- “If ZEC rises 20 times, could ZCG plus Lockbox finance a Zcash society for centuries? Analyze the fixed USD budget hypothesis, distinguish valuation from spendable resources, identify the three strongest limitations and suggest one useful sensitivity test. Do not invent current balances or predict a price.”
- “Does ZIP 310 prove an incoming viewing key holder can always identify spent Sapling notes? Explain the actual attack assumptions, the key required and the limit of that conclusion. Cite the relevant ZIP sections.”
- “Compare an incoming viewing key and a full viewing key in Sapling. Can either spend funds? Keep the answer under 180 words and cite ZIP 310.” Select Deep analysis.
- “For ZIP 317 revision 0 only, with 4 Sapling spends, 1 Sapling output, 1 Orchard action, and no transparent actions, what is the conventional fee in zatoshis? Is it a consensus minimum? Keep it concise and do not assert which revision is active on mainnet.”

Provider-assisted reproduction incurs normal API charges and can produce different wording. Source refreshes and changing public balances also change scenario results.

## Automated and browser verification

- `npm test`: **795 Vitest tests passed**, 9 existing optional database tests skipped; **3 Node knowledge-index checks passed**.
- Changed TypeScript/TSX files: scoped ESLint passed.
- `npm run build`: passed, including TypeScript and production page generation. Existing middleware-convention warning remains.
- Final deadline-copy adjustment: all 6 route tests passed again.
- Desktop dark and mobile light inspected; response-depth control remains compact and accessible.
- At 390 px, main chat scroll width was 390 px; gallery scroll width was 375 px with its scrollbar. No horizontal overflow.
- Gallery computed motion: comparing → `zarvis-compare`; uncertain/clarifying → `zarvis-attentive` on their respective artwork.
- Pause/resume verified in the conversation and gallery. Body/head paused. Reduced-motion emulation produced `animation-name: none` and was reset.
- One mascot per response; its completed state persisted. Existing eight artworks now cover thirteen expression states, with ten representative gallery examples.
- Browser automation on an older preview tab had inconsistent pointer coordinates; a fresh tab successfully exercised pointer-based pause/resume, theme switching and Send. No product change was retained for that automation issue.

## Source boundaries

- [ZIP 310](https://zips.z.cash/zip-0310): IVK/FVK scope and security properties; matching OVK recovery is separate from spend detection.
- [ZIP 317](https://zips.z.cash/zip-0317): revision-scoped conventional fee calculations are distinct from consensus and deployment.
- [Grok 4.7](https://docs.x.ai/developers/models/grok-4.7): supported reasoning efforts.
- [OpenZcash methodology](https://openzcash.org/zcg/methodology): source/reporting conventions; the application scenario engine supplies financial figures.

## Release status

No production deployment or enablement was performed. The candidate remains in draft PR #35. Local test/build success does not establish remote CI success, production database migration readiness, or approval of final production usage/provider settings. Those operational checks must be completed before promotion. Model answers remain fallible, deeper analysis increases cost/latency, and hosted-search/provider limits are not a dollar billing cap.
