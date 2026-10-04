# Ecosystem visual identity

Verified on 2026-09-08. This is a presentation layer, not an update to the funding or repository snapshot.

Categories use a shared palette in cards, repository rows and dialogs. Each has a text label and an icon as well as color. Funding history and lifecycle are neutral, independent badge dimensions. Automated tests enforce at least 4.5:1 text contrast for every category.

## Mark selection

1. A dedicated, curated project logo takes precedence.
2. A confirmed team mark may identify the maintainer, but is labeled **maintainer mark**, not presented as the project's own logo. The shared `zcash` namespace is explicitly labeled **namespace mark**; it is not attributed to a single maintainer.
3. Unknown marks use a category glyph. Image loading errors fall back to the same glyph. No initial-letter logos or invented project brands are generated.
4. Source links and the distinction above are available in details and accessible image labels. These marks do not imply endorsement, funding, payment, security review or project delivery.

The registry's existing logos remain unchanged. Only the files below are added. All are served locally, without third-party requests in visitors' browsers. No recoloring, cropping or modification of the source artwork was performed.

## New source assets

| Local asset under `public/logos/ecosystem/` | Official source | Asset |
| --- | --- | --- |
| `zakura.png` | [Zakura](https://zakura.com/) — HTML apple-touch icon | [PNG](https://zakura.com/apple-touch-icon.png?h=8f8253a6fc48984781d0) |
| `cipherscan.png` | [CipherScan media kit](https://cipherscan.app/press) — logo mark for small spaces | [PNG](https://cipherscan.app/logo.png) |
| `free2z.png` | [Free2Z](https://free2z.cash/) — HTML apple-touch icon | [PNG](https://free2z.cash/brand/apple-touch-icon.png) |
| `bison-wallet.png` | [Bison Wallet](https://bisonwallet.org/) — HTML favicon | [PNG](https://bisonwallet.org/img/favicon.png) |
| `zcash.png` | [zcash GitHub namespace](https://github.com/zcash) | [Avatar](https://avatars.githubusercontent.com/u/16122764?v=4&s=128) |
| `zcash-foundation.png` | [Zcash Foundation](https://github.com/ZcashFoundation) | [Avatar](https://avatars.githubusercontent.com/u/26173891?v=4&s=128) |
| `shielded-labs.png` | [Shielded Labs](https://github.com/ShieldedLabs) | [Avatar](https://avatars.githubusercontent.com/u/123885412?v=4&s=128) |
| `zodl-lab.png` | [ZODL](https://github.com/zodl-inc) | [Avatar](https://avatars.githubusercontent.com/u/8797295?v=4&s=128) |
| `tachyon.png` | [Project Tachyon](https://github.com/tachyon-zcash) | [Avatar](https://avatars.githubusercontent.com/u/237353586?v=4&s=128) |
| `zingolabs.png` | [Zingo Labs](https://github.com/zingolabs) | [Avatar](https://avatars.githubusercontent.com/u/70598323?v=4&s=128) |
| `zechub.jpg` | [ZecHub](https://github.com/ZecHub) | [Avatar](https://avatars.githubusercontent.com/u/108132802?v=4&s=128) |
| `qedit.jpg` | [QEDIT](https://github.com/QED-it) | [Avatar](https://avatars.githubusercontent.com/u/24523976?v=4&s=128) |

GitHub avatar identity was checked against the public account API. ZecHub is a User account, not an Organization, so its source is `/users/ZecHub`. JPEG payloads retain their original bytes with the correct `.jpg` extension.

The generic mdBook favicon on the FROST documentation and the default GitHub identicon for zecrocks were deliberately not used as product logos. FROST identifies Zcash Foundation as the maintainer; zecrocks uses its category glyph until a dedicated mark is verified.

Original asset copyright and trademark rights remain with their respective owners. This catalog uses the marks for identification only.

## Project history directory

The history directory resolves community identities through the existing `COMMUNITIES` catalog, including its 13 locally stored community marks. That catalog records its verification date and links to the communities' own public accounts. A community mark is labeled **community logo**; it is never inferred from a country flag or a lead's personal avatar. ZecHub retains its existing project mark because its history deliberately joins the two catalogs.

Project histories preserve dedicated product logos and explicitly label maintainer or namespace marks. The existing, sourced Tachyon asset is now connected to its `project-tachyon` maintainer identity. Unknown identities continue to use the category glyph. These presentation mappings change neither source records nor financial associations.
