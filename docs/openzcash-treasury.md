# OpenZcash Treasury

Direction confirmed on 2026-11-10: maintain OpenZcash as open-source community infrastructure, supported by voluntary donations and contributions. Revised on 2026-11-12: OpenZcash will not apply for a grant for itself, neither to ZCG nor to the Coinholder retroactive grants; the open letter says so.

## Screens

- `/openzcash-treasury` is the project's own treasury, separate from the ZCG and Coinholder funds shown elsewhere in the portal.
- `/openzcash-treasury/letter` contains the open letter. Both screens are published in English only.
- The letter is laid out as a sheet of paper. Its title and signature use Cormorant Garamond, the serif file bundled for the Ceremony pages (`src/app/ceremony/fonts/`); the text stays in the portal face. A phrase wrapped in `**…**` in the copy is set in bold. The release note, the links and the actions sit below the sheet.
- The letter, signed by Michae2xl, states how donations are designated: a memo may direct a donation to Michae2xl for work already delivered; donations without that note fund maintenance and improvements. The same guidance sits under the donation address, quoting `DESIGNATION_MEMO` from the copy module. Memos appear in the transactions panel; the treasury screen does not total designated amounts separately.
- The treasury landing page uses a compact balance/activity panel beside the donation address, QR and viewing key. The letter and contribution links sit below it. Account separation and viewing-key scope remain available in the native disclosure control; a short memo-visibility notice is always visible beside the donation address.
- The transactions panel filters All / Incoming / Outgoing, with transaction ID, UTC date and exact ZEC amounts. A text memo appears only when present and expands to show its full content. Memos render as plain text, with direction-control characters removed so a memo reads in the order it was written. `null` history stays unavailable in every filter; a verified empty list has a distinct empty state. Test fixtures are never loaded by the public page.
- Copy lives in `src/lib/openzcash-treasury/content.ts`. The Markdown draft in `docs/articles/` is for editorial review, not evidence of publication.
- The sidebar and phone drawer show OpenZcash Treasury near the bottom. Ongoing Test is hidden; its bookmarked URLs still resolve. Opportunities → Crosslink → View Crosslink incentives opens the existing guide. The guide's return path and breadcrumb now point to Opportunities.

## State of the treasury

On 2026-11-10 the owner supplied the dedicated mainnet donation address and full viewing key for public disclosure. These intentionally public details live in `src/lib/openzcash-treasury/account.ts`; they are not spending credentials. The QR is generated locally from that exact address using the existing `qrcode` dependency, with no amount, memo or external QR service. The address and full key can be copied; the QR can be downloaded as PNG. Clipboard failure is reported, and the full key opens for manual selection.

The owner identified Vizor as the source wallet. Local ZIP 316 encoding checks validated both Bech32m checksums, F4Jumble padding and item lengths. The address includes an Orchard receiver; the full viewing key includes transparent, Sapling and Orchard items. These encoding checks do not prove account-to-address derivation or a synchronized balance. The generated PNG was independently decoded with jsQR and matched all 106 characters of the supplied address.

The owner confirmed the account was created in Vizor on 2026-11-10. A dedicated local ZKool engine imports only the published full viewing key. The worker checks that its exported full viewing key and Orchard donation address match the public configuration. It chooses a scan start before the creation day, verifies that block's timestamp through TLS lightwalletd, waits for synchronization with transaction details, and reconciles the complete net history against the engine's confirmed balance before publishing a snapshot.

## Read-only synchronization

Engine baseline: [ZKool 6.36.0](https://github.com/hhanh00/zkool2/releases/tag/zkool-v6.36.0), commit `4d12780960392d87b850ddaf677c49ee058f538e`, compiled with `cargo build --locked --release --bin zkool_graphql --no-default-features --features graphql,ledger --manifest-path rust/Cargo.toml` from the upstream repository root. This is a separate dependency, not part of the web application's npm build.

Start the compiled engine with a dedicated database and loopback binding:

```sh
zkool_graphql --db-path /path/to/treasury.db --lwd-url https://zec.rocks \
  --port 18232 --bind-address 127.0.0.1 --coin 0 \
  --allow-unauthenticated --allow-unencrypted-database --no-mempool
```

These flags are for a local engine containing only the expressly public viewing key. Do not expose its GraphQL port to the network or reuse a database that contains spending keys. The web app exposes only its validated read-only snapshot. On macOS, `XDG_DATA_HOME` can keep the engine's downloaded Sapling parameters in the same dedicated runtime directory.


- `scripts/sync-openzcash-treasury.ts` is an operator CLI, separate from the Next.js application. `npm run treasury:sync` performs one scan; `npm run treasury:sync -- --watch` repeats every 30 seconds.
- `OPENZCASH_TREASURY_ENGINE_URL` defaults to `http://127.0.0.1:18232/graphql` and must be a dedicated loopback service. It must contain only this public watch-only account. Do not point it at a personal wallet database.
- `OPENZCASH_TREASURY_INDEXER` defaults to `https://zec.rocks`. The engine and worker must use the same mainnet indexer.
- `OPENZCASH_TREASURY_BIRTHDAY_HEIGHT` can pin an earlier starting height. Its block timestamp must precede the owner-confirmed creation day with a one-day margin. Without an override, the worker starts 10,000 blocks below the current tip and steps backward if necessary.
- `OPENZCASH_TREASURY_SNAPSHOT_PATH` defaults to `.cache/openzcash-treasury/snapshot.json`. The worker writes atomic replacements. Engine databases, lock files and snapshots are local runtime data and must not be committed. The web process only needs read permission for the snapshot.
- `GET /api/openzcash-treasury` serves the validated snapshot with `Cache-Control: no-store`. No request imports a key or starts a scan. Legacy key-import, admin and scanner HTTP routes stay retired.
- The page refreshes the read-only feed every 15 seconds. It shows the synchronized block and UTC timestamp. After two minutes without a successful scan, it labels the data as the last known balance; errors retain the previous verified snapshot. Missing, invalid or wrong-account data remains unavailable, never zero.

Amounts are exact integer zatoshis. Received and Spent are positive and negative **net account movements**, with outgoing fees included. Change and transfers between pools are not counted twice. A zero-net transfer stays in All as Internal and retains recoverable memos. Every published snapshot must satisfy `received - spent = confirmed balance`. Only confirmed transactions appear; an unconfirmed test donation appears after mining and the next successful scan.

Memos come from the engine's decrypted external notes and outgoing outputs. Blank/non-text memos are absent; multiple recovered text memos remain distinct. The UI renders plain text, never memo HTML. A full viewing key cannot recover outgoing data encrypted with an unrelated/randomized outgoing key. This integration cannot manufacture a missing memo.

Coverage follows the account's shielded keys and the engine's stored transparent addresses; it is not an exhaustive search of all possible transparent child indexes. The published donation address is Orchard-only. Expense purposes and receipts can be added as separate records; the viewing key does not prove off-chain expense claims or the absence of other wallets.

The scanner is a separate persistent service. Deploying only the Next.js UI does not deploy the scanner or its runtime database. Run the worker beside the engine and share the snapshot read-only with the web process. The current local preview is not evidence of a public deployment.

Viewing-key terminology: [ZIP 316](https://zips.z.cash/zip-0316#terminology). Public viewing keys can expose transaction details and memos; they do not authorize spending.

## Source release and contributor incentives

The commitment is to release the maintained codebase under MIT, without a grant, preserve attribution, and welcome contributors. At implementation time the GitHub repository was still private, so the screens describe public release as in preparation. This change does not change repository visibility.

The proposed incentive model publishes a task's scope, budget and acceptance criteria before work begins and records deliveries and payments. No rewards or budgets are promised by this change.

## Editorial boundaries

The letter uses the founder's description of the work as pioneering. It does not claim that Zarvis was the first AI project in Zcash or assert an independently verified priority ranking. Since block zero refers specifically to the funding-history view. Links beside the letter let readers explore the actual work.

The letter, a code release, wallet disclosure, verified treasury data and a public deployment are separate events.
