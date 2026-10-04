# Ecosystem source audit — 4 October 2026

The stale Zakura version originated in the GitHub snapshot dated 8 September, not in Zakura’s current release. The replacement source collection ends at **4 October 2026, 21:05:24 UTC**. Zakura **v1.6.0**, published 1 October, is now present in its history.

## Scope and source receipt

| Source / layer | Coverage | Observation basis |
| --- | --- | --- |
| GitHub public repository inventory and activity | 579 canonical repository records; 24 newly observed repositories; 29 changed existing latest-release markers | Complete paginated collection at the common cutoff; zero collection failures |
| Listed published release history | 12,894 source records, including previews and notices | Repository-wide records; shared and multichain repositories can include non-Zcash work |
| Previously observed release records absent from the new listing | 11 | Preserved with last-observed and missing-as-of dates; excluded from current release claims |
| Identity map | 153 histories from 127 project records and 27 communities | ZecHub overlaps and is combined; 41 identities have no linked GitHub repository |
| Public financial mirror | 771 proposals, 899 payment rows | Existing mirror imported 1 October 2026 at 15:49:55 UTC; read-only export, not a fresh financial import |
| Newly approved proposal mappings | All 22 previously unmapped recent approvals linked by reviewed application scope | Canonical application URLs and exact program/title joins; not organization-name guesses |
| Community context | 25 existing ZecHub DAO proposal references across 11 communities; 11 histories with curated report links | Proposal creation is context, not approval or payment; report publication dates remain unknown where not extracted |
| Manual artifact review | ZODL iOS 3.15.0 and Vizor iOS 0.0.50 | Official Apple US storefront lookup; distinct from GitHub/desktop releases |

Global registry review remains dated 8 September: fresh repository measurements do not mean that every description, historic award or delivery claim was reverified. Newly reviewed identities and funding mappings carry their own review dates.

## Corrections and boundaries

- Added canonical `chainapsis/vizor-wallet`. `valargroup/vizor-wallet` remains a separate fork. Vizor’s past-deadline Q3 application is not presented as approved or rejected by a vote.
- Added 14 distinct scopes for recent funding: external Ironwood audits, independent Zebra research, ZcashToCash, Valar Ironwood integration, independent Orchard research, ZODL core protocol, THORSwap Metro, CipherPay, a human-readable Ironwood proof, Network School Kazakhstan, GraphSense accounting, Connaugh videos, the Colosseum track, and independent cross-node security research. Existing identities received the remaining verified associations, including Ghana’s Q4 application.
- Independent bounties and audit reimbursements are separated from Foundation, Shielded Labs and protocol-team funding. Dependency repositories and shared work are labeled by scope.
- ZecKit’s two status notes are timeline context; only its actual grant is counted. ZecHub DAO references add no inferred financial amounts.
- Explicit `alpha`, `beta`, `rc` and other preview tags are recognized even when GitHub’s prerelease flag is false. Zebra 7.0.0-rc.0 and Zallet beta are not labeled as stable. Raw API flags are preserved.
- The full listed release history is retained, while 90-day activity keeps its original definition. Removed records stay traceable without becoming the newest current artifact, including after a prior editorial review.
- Published records are not accepted milestones, integrations, users or mainnet activation. Crosslink feature-network releases retain that limitation; absent Tachyon/Ragu releases do not mean inactive research.

## Remaining evidence gaps

Four ambiguous grant-title views still withhold amounts: Unstoppable Wallet; Zcash Arabia (May to September 2026); Zcash Global en Español; Zcash UniFFI Library addenda. The audit does not invent joins to make those totals appear complete.

GitHub collection is complete for the configured inventory, not a claim to have discovered every project in the Zcash ecosystem. Non-code work, community reports, app-store distribution outside reviewed storefronts, milestone acceptance and adoption need their own evidence. The referenced `cipherpay-mcp` repository returned 404 and was excluded; five accessible canonical CipherPay repositories were mapped.

Refreshing the financial mirror and resolving the four ambiguous joins remain separate from this read-only audit. Payment settlement and every historical project claim were not independently certified.

Very large monorepos still produce long individual histories. The explorer receives a compact projection without the full release archive, while full archives remain available to history/API consumers. Repository counts must not be used as a cross-project delivery leaderboard.

## Repeatable controls

`npm run sync-ecosystem` performs fresh public source reads. Incomplete owner inventory, selected-repository failure, pagination failure, missing activity or changed repository identity prevent replacing the snapshot. `--cached` only resumes a collection less than 24 hours old and keeps its original cutoff.

`npm run audit:ecosystem -- --finance /path/to/public-finance-records.json --baseline /path/to/prior-snapshot.json --output /path/to/audit.json` produces the full source map and fails on stale/incomplete repository data or unresolved canonical mappings. Without an explicit financial export, finance is unassessed. History screens show a warning once repository data exceeds seven days. This is a manual refresh plus a guard; it is not an automatic refresh schedule.

Validation: 2,615 application tests passed with nine skipped; six public-knowledge tests and 17 collector tests passed. Typecheck passed; lint has no errors and four pre-existing warnings. Production build passed. The rendered preview confirms Zakura v1.6.0, its source URL and collection dates, and Vizor’s canonical repository with its separate iOS evidence. An independent review found no duplicate timeline identifiers or unlisted releases selected as latest activity across all 153 histories.

## Primary source examples

- [Zakura v1.6.0](https://github.com/zakura-core/zakura/releases/tag/v1.6.0)
- [Zebra v7.0.0-rc.0](https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0-rc.0)
- [ZODL Android 3.15.0-2852](https://github.com/zodl-inc/zodl-android/releases/tag/3.15.0-2852)
- [ZODL iOS US lookup](https://itunes.apple.com/lookup?id=1672392439&country=us)
- [Vizor desktop 0.0.59](https://github.com/chainapsis/vizor-wallet/releases/tag/release/v0.0.59)
- [Vizor iOS US lookup](https://itunes.apple.com/lookup?id=6776591245&country=us)
- [Vizor application status](https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/66)
- [Ghana Q4 application](https://forum.zcashcommunity.com/t/zcash-ghana-october-2026-december-2026/57632)
- [Zkool 6.32.0 release candidate](https://github.com/hhanh00/zkool2/releases/tag/zkool-v6.32.0-rc)
- [Crosslink feature network v14](https://github.com/ShieldedLabs/crosslink_monolith/releases/tag/v14)

Snapshot SHA-256: `6937150b6b9b53e6d4d11131dcfd95a559ce0e812e5f334feadd35eaa5da8d11`
