# Ecosystem purpose and tag audit — 2026-10-05

The overview previously counted only the 127 project/component records. Its four Community and four Education records excluded 26 additional community identities. The community directory contains 27 groups, including ZecHub, which already exists as a project. The complete history directory therefore contains 153 unique identities, not 154.

## Counting rule

- One identity, one primary area. Counts describe mapped records, not independent teams, grants, active products or successful deliveries.
- Community and Education are subcategories of the display area **Community & education**. All community-directory identities are included; ZecHub is counted once. Education applications, media work and events remain projects/initiatives, not regional community groups.
- Functional tags can overlap. They are searchable attributes and are not added together to produce the primary-area counts.
- Every overview bar opens the history directory using the same work-area helper. Legacy exact category URLs retain their meaning.
- Category counts are dynamic. The tests check completeness, identity uniqueness, shared ZecHub handling and link/filter equivalence, rather than freezing today's catalog size.

## Implemented corrections

| Record | Before | After / reason |
| --- | --- | --- |
| Zcash Coin Voting | Community | Governance: voting software |
| Private coinholder voting | Developer tools | Governance: application purpose; SDK/circuit components keep separate repository purposes |
| Zallet, Zcash Walletd, zecd | Infrastructure | Wallets: RPC/REST/server wallet roles, with watch-only and light-client differences preserved in tags |
| red·bridge | Infrastructure | Payments & DeFi: cross-chain value transfer; prototype status preserved |
| Zcash Ika Integration | Developer tools | Libraries & SDKs: signing package, explicitly transparent-transaction scope |
| zecping | Infrastructure | Developer tools: diagnostic client, not a lightwallet server |
| Zair | Cryptography | Developer tools: airdrop CLI/SDK; cryptography is secondary |
| ZecHub Bounties | Payments & DeFi | Community: contributor tooling; ZEC payment capability retained |
| Human-readable Ironwood proof | formal-verification tag | Mathematical exposition/Bulletproofs; not a separate machine-checked verifier |
| Zcash Wallet Formats | Standards tag | Wallet-format survey; not an adopted standard |
| ZECpages | subscriptions tag | Removed because the inspected source does not substantiate it |
| Zcash Name Service | protocol tag | name-service; avoids suggesting base-consensus ownership |
| Ragu | No prototype tag | Prototype maturity made explicit |
| Dynamic Fees | Generic source/status | Dedicated official source and proposed-upgrade tag |

Sixteen project records receive a dated purpose review with source URLs and rationale. No funding amount, award status, repository association, project ID or community identity is changed by these project edits. The repository snapshot is regenerated from the existing collection cache; its original collection date and observations are preserved.

Seven repository-level overrides keep voting chains, circuits, wallet libraries and the general Namada node fork classified by their own implementation purpose. They do not change project associations. The Zair project remains under Developer tools with a cryptography tag; its mixed CLI, SDK and circuit scope supports more than one useful facet.

## Evidence and limits

The accompanying JSON records the judgment for every project and community, including unchanged classifications. It distinguishes newly read primary sources from review of the existing curated descriptions and source inventory. A classification audit is not a fresh verification of every release, every social account, every delivered milestone or every adoption claim.

The review also found source-maintenance follow-ups: CipherScan's current site and repository redirect to ZecBlock, and Zero's official repository names have evolved. These are recorded separately; historical funding identities and repository mappings are not silently replaced.

## Validation

- Full suite passed: 2,704 tests passed and nine skipped, plus six public-knowledge checks. After the final seven repository overrides, 170 focused ecosystem/history tests passed, including the added repository-purpose regression.
- Full lint, final changed-file lint, typecheck and the final production build passed.
- Independent comparison confirmed funding objects/events, stable identities, repository mappings and snapshot observations were preserved.
- Rendered preview at 1440 × 1000 and 390 × 844: the overview shows 153 unique histories and Community & education 34; its link opens exactly 34 histories. The community-only filter shows 27 groups. Mobile area selection works, and the main content has no horizontal overflow in the tested viewport.
- Both light and dark presentations were inspected. Stable regression checks cover complete community inclusion, ZecHub deduplication, education grouping, voting separation, reviewed source safety, exact category compatibility and graph-to-directory membership.

These checks validate the local candidate. They do not establish a production deployment.
