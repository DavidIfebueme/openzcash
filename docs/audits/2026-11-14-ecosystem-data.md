# Ecosystem data refresh — 14 November 2026

The daily collection had not published since 11 November 2026:
`/api/ecosystem/status` showed that day as the last success and
`source-unavailable` as the latest outcome. The registry named `ShieldedLabs/zero` as a repository of the Zero project, and
that repository is no longer publicly available (GitHub returned 404). A
repository named in the registry that cannot be read holds the publication, so
`/development` and the ecosystem catalog stayed on the 11 November collection.

Registry change, limited to the Zero project entry:

- `ShieldedLabs/zero` removed from its repositories; `ShieldedLabs/zero-zb`
  remains.
- Its repository source now points to `ShieldedLabs/zero-zb`. The project page
  `https://shieldedlabs.net/zero/` is unchanged as a source.

The registry baseline remains 8 September 2026; this change does not rereview
project descriptions, classifications or funding associations.

The public repository snapshot was fully recollected with a cutoff of
`2026-11-14T19:39:41.525Z`:

- 607 canonical public repositories, across 14 recorded owners; no collection failures.
- 13,206 currently listed published release records and 19 previously observed
  records retained separately as unlisted.
- 26 newly discovered repositories: `ShieldedLabs/nsm`,
  `ShieldedLabs/ziggurat-zcash`, `ZcashFoundation/oss-fuzz`,
  `ZcashFoundation/zebra-benchmarks`, `free2z/minreq`, `free2z/ureq`,
  `free2z/utf8-zero`, `valargroup/equihashverify`, `valargroup/signatures`,
  `valargroup/sphincs.art`, `valargroup/wallet-pir-config`, `zakura-core/arti`,
  `zakura-core/rust-rocksdb-wrapper`, `zecrocks/zakura-common`,
  `zecrocks/zakura-wallet-libraries`, `zecrocks/zcash-android-wallet-sdk`,
  `zecrocks/zcash-swift-wallet-sdk`, `zingolabs/delegator-report`,
  `zingolabs/sinsemilla`, `zingolabs/sinsemilla-proofs`, `zingolabs/z3`,
  `zingolabs/zcash_voting`, `zingolabs/zingod`, `zingolabs/zingolib-tui`,
  `zodl-inc/keystone3-firmware` and `zodl-inc/zodl-ohttp`.
- Six repositories were renamed or transferred and keep their stable IDs. The
  five named in the registry under `runziggurat` now resolve under
  `equilibriumco` (`ziggurat-crunchy`, `p2p-viz`, `ziggurat-zcash`,
  `ziggurat-core` and `ziggurat-viz`), with the earlier names retained as
  aliases; `zodl-inc/zodl-i18n` is now `zodl-inc/zodl-l10n`.
- 35 existing repositories have a changed GitHub latest-release marker.
- Snapshot SHA-256: `bfd70da2d01c6b88dcc08fdb4ab322f971060ba72fdb6982ef162ac977845c0d`.

The ecosystem audit passed with zero issues: all 153 history identities have
sources, 112 have repository history, and 41 have no GitHub association. No
finance export was supplied; payment and milestone completion were not assessed.

Because the registry hash changes, the production store starts a new
publication row: the bundled snapshot above is served until the next daily
collection completes.
