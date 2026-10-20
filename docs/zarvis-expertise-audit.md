# Zarvis expertise audit — 20 October 2026

The audit found missing knowledge and reproducible response-quality failures.
The branch corrects them and adds regression coverage. This is a bounded audit
of the application, retrieval and representative conversations, not a ranking
of AI systems or a claim that Zarvis can answer every Zcash question correctly.

## What was missing and what changed

| Finding | Correction |
| --- | --- |
| The new narrative library was absent from the public knowledge index. Generic extraction cannot preserve its multilingual JSON structure. | An explicit projector indexes all 20 pitches in three languages and three lengths, plus eight narrative themes in three languages. Every pitch retains its context and the corresponding factual limitation. Historical attribution files remain outside the application index. |
| Several current navigation destinations had no content evidence. Navigation labels alone could masquerade as knowledge. | The allowlist now covers every visible public navigation destination, with reviewed workflow notes for printing, Crosslink, Participate, Private Chat and Zarvis. Tests check coverage and exclude private fields. |
| Communication requests could retrieve irrelevant protocol or governance material. A conference “opening” did not activate pitch guidance. | Audience/occasion terms, requested language and length guide retrieval. Speech, introduction, opening, presentation, script and social-post briefs are recognized. A writing brief mentioning “avoid price predictions” no longer automatically fetches a price. Read-only tools remain available for facts actually needed. |
| A Portuguese-to-Spanish follow-up retained Portuguese provenance and added headings, notes and a second option. | Explicit output-language requests update the session. Revisions retain the user’s current brief, while a new topic ends it. Assistant text cannot set the brief or language preference. |
| A live answer called a 180-word draft “about 150 words”; another opening had 263 words. | The application measures the whole delivered draft. It checks a maximum of 80 words for 30 seconds, 150 for 60 seconds and one concise sentence when requested. One bounded repair may shorten it; failure is stated honestly. Numeric restatements are checked again without starting another repair cycle. Explicit user word counts override the timing defaults. |
| Technical answers found incomplete or irrelevant passages for Orchard recursion and Sapling viewing keys. | Retrieval prefers the relevant ZIP 224 and ZIP 310 passages and retains document-wide scope. It distinguishes Halo 2's recursion capability from Orchard's specified design, and an IVK from an FVK's ability to detect spends. |
| Crosslink records were difficult to retrieve and allocation was absent from the tool response. A generic `recipients` field implied a total across different reward groups. | A fixed public reader uses the page's dated records, includes the launch allocation and labels mining/staking recipients explicitly. Overlapping discretionary groups are not summed. ZEC fields participate in the existing numeric guard. Reports remain reports, not independently verified payouts or live balances. |
| Static site evidence disappeared from the source drawer when reusable copy omitted inline links; the UI showed zero sources after a grounded pitch. | The drawer retains public site records actually supplied to the model, without inserting references into the reusable pitch or inventing a retrieval/freshness date for static material. |
| Printing guidance repeated passages, speculated about pop-up blocking and once suggested selecting hidden cards. | Separate workflow guidance explains selection, the yellow print action, embedded-browser limitations, and the difference between a visible card and an existing selection later hidden by filters. |
| Editorial review could be mistaken for tests, merge, deployment or complete anonymity. | Instructions and public documentation state those evidence boundaries explicitly. Zarvis has no internal CI/deployment/private-chat/wallet access. |

The baseline public index contained **295 records from 56 source files**. The
new index contains **537 records from 71 allowlisted source files**, including
180 localized pitch versions and 24 localized theme records. Its revision is a
content fingerprint, not a release certification.

The existing reference corpus contains 135 ZIP documents. The external corpus
contains 52 official-blog posts, 26 wiki pages and 55 forum topics, with snapshots
from 8 October 2026. This audit did not refresh that entire external corpus.
Current prices, releases, activation, laws and other changing facts still need
current evidence from the permitted readers or research tools.

## Factual checks

The corrections were checked against [ZIP 224](https://zips.z.cash/zip-0224)
and [ZIP 310](https://zips.z.cash/zip-0310). The first specifies Orchard using
Halo 2 without using recursive proofs in that design; the latter's examples
assume a full Sapling viewing key even where a step mentions its derived IVK.
Neither a proposal's status label nor a static excerpt independently verifies
live network activation.

The comparison guidance also reflects [Bitcoin's privacy documentation](https://bitcoin.org/en/protect-your-privacy)
and [Zcash's Bitcoin comparison](https://z.cash/learn/how-is-zcash-different-than-bitcoin/):
public on-chain addresses and amounts do not automatically identify every
person or expose all their holdings/off-chain payments. ZEC belongs to a
separate network. Drafts should explain practical privacy without caricaturing
Bitcoin, other payment systems or ordinary bank/card donations.

## Automated validation

- Full suite: **4,020 passed; 16 optional tests skipped** across 300 files.
- Auxiliary Node checks: **57 passed**, including the public index projection
  and the error fallback handler.
- After adding explicit Crosslink units to the numeric guard, the affected
  retrieval, grounding and engine suites passed **197 tests**. These overlap
  the full-suite count; they are not 197 additional tests.
- Repository lint completed with no errors and four existing warnings in
  unrelated UI files.
- Final production build passed, including TypeScript, knowledge-index
  generation, error-fallback freshness, proposal-card and wallet-schema gates.
  The separate knowledge-index freshness check also passed.

An earlier parallel run hit the existing five-second timeout in a Monthly PDF
integrity test. With two workers and unchanged assertions/timeouts, the full
suite passed. No PDF test was disabled or weakened.

Coverage includes all catalog translations and lengths, visible public routes,
multilingual retrieval, context revisions, false technical premises, trusted
instructions versus retrieved data, length repairs, usage accounting, numeric
repair interaction and public-source provenance. Mocked provider tests verify
contracts; they do not prove the quality of an arbitrary generated answer.

## Real conversations and browser review

Real calls used the isolated local preview and **Claude Sonnet 5.5** through the
normal `/api/zarvis` endpoint. Requests were synthetic. Existing quotas,
deadlines and spending controls were retained. No credentials, private user
conversations or feedback tokens are stored in the audit artifact.

The [case definitions](zarvis-expertise-cases.json) describe eight scenarios:
English business pitch, Portuguese nonprofit pitch, Spanish one-sentence
revision, two protocol false premises, test/deployment/privacy boundaries,
printing, Crosslink incentives and an opening for a skeptical Bitcoin audience.
The [recorded responses](zarvis-expertise-live-results.json) preserve the
eight-case batch and the two affected-case retests, with manual review. The
batch completed all eight requests, but only six delivered the expected answer:
the Portuguese NGO pitch and Bitcoin opening hit the honest length fallback.
After adding explicit lower word targets, both retests produced usable copy
within the cap. The Portuguese draft was shorter than the preferred range.
Completion is separate from semantic review; this is not a reliability
percentage, and the failures remain in the artifact.

Earlier failures are described above rather than erased by the later passes.
The browser check also exercised the actual **Craft a Zcash pitch** starter,
question submission, completed answer, copy controls and the expandable
library sources. The final observed starter produced a concise English pitch
and showed four consulted library examples. No physical printing was performed.

## Maintaining the improvement

1. Change the original catalogs or reviewed site guides alongside the feature.
   Run `npm run knowledge:build` and commit the generated index. Never broaden
   ingestion to private routes, environment files or the whole repository.
2. Run `npm run eval:zarvis` and the relevant regression tests. Add new failures
   as cases, preserving the distinction between retrieval and answer quality.
3. Before a model/provider change or release, repeat the opt-in live evaluation:

   ```sh
   python3 scripts/eval-zarvis-expertise.py --confirm-paid \
     --url http://127.0.0.1:4237 \
     --cases business-pitch-en donation-pitch-pt rewrite-es \
       protocol-false-premises evidence-boundaries print-workflow \
       crosslink-incentives bitcoin-panel
   ```

   The runner is loopback-only, stops on service refusal/error, and does not
   override quotas. Inspect every answer against its rubric; do not treat HTTP
   success as a pass.
4. Refresh dated corpora through the existing synchronization process and
   review changes. New facts should be evidenced, not learned from prior chat
   answers or promotional assertions.

## Scope and remaining limits

- The new material is local/PR evidence. No merge, production deployment,
  production feature enablement or provider switch was performed.
- Other providers retain automated transport coverage; they were not live
  evaluated in this audit. Model outputs remain nondeterministic.
- Word limits estimate speaking time. They do not score persuasion, originality
  across the whole internet or factual entailment. A bounded repair can fail.
- Source drawers show consulted records, which can include extra context. They
  do not certify that every claim is supported by every listed source.
- The financial guard checks recognized figures and units, not every meaning,
  recipient identity, legal conclusion or causal claim. Source reports can be
  wrong. Crosslink test money is distinct from mainnet ZEC.
- Knowledge coverage of a public route does not mean access to its private
  systems or a complete understanding of all future changes. Further audience,
  occasion and adversarial evaluations should extend this case set over time.
