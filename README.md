<p align="center"><img src="docs/img/logo.jpg" alt="OpenZcash logo" width="132"></p>

# OpenZcash

**Public, verifiable transparency for the Zcash Dev Fund.** OpenZcash mirrors the
official Zcash Community Grants (ZCG) spreadsheet, audits it against the on-chain
Dev Fund Lockbox, and serves the result as dashboards, a read-only API, and an
agent skill. Anyone (or any AI) can ask where the money goes and get a cited
answer.

Live: **[openzcash.org](https://openzcash.org)**

[![CI](https://github.com/Michae2xl/openzcash/actions/workflows/ci.yml/badge.svg)](https://github.com/Michae2xl/openzcash/actions/workflows/ci.yml)
[![Tests 4,276](https://img.shields.io/badge/tests-4%2C276-brightgreen.svg)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node 24.22.1](https://img.shields.io/badge/node-24.22.1-brightgreen.svg)](package.json)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fopenzcash.org)](https://openzcash.org)

<p align="center"><img src="docs/img/openzcash-menu.png" alt="OpenZcash dashboard menu" width="740"></p>

> The portal never holds spend keys. Current public chain reads use a public
> lightwalletd; historical reconciliation still displays previously scanned data.

## Try the API right now

```bash
curl --fail --silent --show-error --compressed \
  "https://openzcash.org/api/zcg/data/grants?search=ZecHub&format=csv"
```

One row per grant, straight from the live ledger. Amounts are USD (dollars) and
ZEC, and the payment ledger at `/api/zcg/data/disbursements` carries provenance on
every row (`sourceSheetGid`, `sourceRow`, `sourceUrl`). The full endpoint index
lives at `GET /api/zcg`.

## Included applications

The root contains the portal. [Participate](services/participate/README.md) and
[Private Chat](services/private-chat/README.md) are separately runnable services
with their own dependencies, tests and setup guides. See
[Local development](docs/local-development.md) for the complete topology.

## What's inside

- **Grants ledger**: the ZCG public spreadsheet, normalized into grants,
  milestones, payments and recipients, and reconciled milestone-by-milestone so
  totals can't silently drift.
- **On-chain Lockbox**: the Dev Fund pool value live from the chain tip
  (deterministic block-reward math + lightwalletd), cross-checked against the
  off-chain ledger.
- **Live pipeline**: proposals under review right now, read first-hand from the
  ZCG GitHub issue tracker.
- **Public API**: every figure available as JSON and CSV, no key required.
- **ZCG Copilot**: an [agent skill](skills/zcg-copilot) that turns any coding
  agent into a grounded grants copilot (see below).
- **ZCG Office**: a playful 3D room where each proposal under review walks the
  floor as a zebra.

## Explore the site

| Surface | What you'll find |
| --- | --- |
| [Zarvis](https://openzcash.org/zarvis) | Ask a grounded AI assistant; answers cite public records. |
| [Coinholders](https://openzcash.org/coinholders) | Coinholder-directed retroactive grants: rounds, results, independent verification. |
| [Ecosystem](https://openzcash.org/ecosystem) | Zcash projects, community histories, and wallets. |
| [ZEC Observatory](https://openzcash.org/zec-observatory) | ZEC price, markets, and liquidity. |
| [Privacy & Policy](https://openzcash.org/legal) | Zcash legal and regulatory news, with PGP coverage. |
| [News](https://openzcash.org/news) | Community news, filterable by source. |
| [Monthly](https://openzcash.org/monthly) | A monthly Zcash reading magazine, as PDF. |
| [Ceremony](https://openzcash.org/ceremony) | The Zcash Ceremony archive and ten-year retrospective. |
| [Funding history](https://openzcash.org/funding-history) | Protocol funding allocations over time; allocations are distinct from recipient spending. |
| [Governance](https://openzcash.org/governance) | How a change becomes a Zcash rule, the decision open now, governance panels compared side by side, and every upgrade and poll on record. |

## Public API

All read-only, public, no auth. Amounts are USD (dollars) and ZEC.

| Endpoint                          | Returns                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/zcg`                    | Self-describing index of the data endpoints                                   |
| `GET /api/zcg/data/grants`        | Per-grant aggregation (milestones, paid, status)                              |
| `GET /api/zcg/data/disbursements` | The payment ledger (filters: `search`, `grant`, `category`, `type`, `sheet`, `limit`) |
| `GET /api/zcg/data/recipients`    | Per-recipient totals                                                          |
| `GET /api/zcg/office`             | Proposals under review right now                                              |
| `GET /api/chain-tip`              | Current block height                                                          |

Append `?format=csv` to the `data/*` endpoints for CSV. This table covers the
ZCG data API; the live index at [openzcash.org/api](https://openzcash.org/api)
lists the site's public endpoints by area. Methodology:
[openzcash.org/zcg/methodology](https://openzcash.org/zcg/methodology).

## ZCG Copilot (agent skill)

```bash
npx skills@1.7.2 add https://openzcash.org --skill zcg-copilot
```

Install from the site's published copies; the source can also be installed from `skills/zcg-copilot` in your checkout.

Ask your agent about grants, spending, recipients, and proposals under review;
answers come from the live API above with a citation on every figure, never from
the model's memory. BYO-LLM — no hosted service, no key. See
[`skills/zcg-copilot`](skills/zcg-copilot).

The same mechanism publishes `coinholder-copilot` and `zechub-copilot`, and every
skill is served from the site at
[`/.well-known/skills/index.json`](https://openzcash.org/.well-known/skills/index.json)
for open discovery.

## Local development

Requires Node **24.22.1** and Postgres. Use the version pinned in `.nvmrc` and `package.json` `engines.node` for development, builds, and production.

Create `.env.local` with the connection string for your local development database:

```dotenv
DATABASE_URL=postgres://USER@localhost:5432/openzcash
```

Replace `USER` and the database name with your local settings. Use `.env.example`
as a reference for additional settings; omit unused optional variables instead
of copying blank values or placeholder URLs.

```bash
npm ci
npm run db:migrate           # apply the schema
npm run import-zcg           # mirror the ZCG spreadsheet into the DB
npm run dev                  # http://localhost:3000
```

The public read side needs `DATABASE_URL` and a seeded ledger. Leave
`ZCG_SHEET_ID` unset to use the built-in public spreadsheet id; an empty value
does not select the default. The legacy admin,
treasury onboarding, viewing-key and scan HTTP routes are retired. Public-data
imports still use the separate `CRON_SECRET` when triggered manually.

```bash
npm run typecheck && npm run lint && npm test && npm run test:copilot && npm run build
```

The [CI workflow](.github/workflows/ci.yml) runs these checks on pull requests and
pushes to `main`; see [CI overview](docs/ci.md) for what each job does. Database
integration tests require disposable local databases;
see [Contributing](CONTRIBUTING.md#tests) for their opt-in settings. Python 3 is
required for the copilot tests. Live AI features also need the provider settings
described in [Using Zarvis](docs/using-zarvis.md) and [Zarvis configuration](docs/zarvis.md).

The full suite currently counts 4,276 automated checks: 4,178 vitest tests,
75 `node --test` and Python checks, and 23 ecosystem-sync tests (4,253 of them
gated in CI on every pull request), with 19 environment-gated skips. Counts are
refreshed at each release checkpoint.

## Documentation

- [Local setup and service dependencies](docs/local-development.md) — covers the included Participate and Private Chat services
- Methodology: [openzcash.org/zcg/methodology](https://openzcash.org/zcg/methodology)
- [Design and credits](docs/design-and-credits.md) — the evidence-led standard for new screens
- [Funding history methodology](docs/funding-history-methodology.md)
- [ZEC Observatory methodology](docs/zec-observatory-methodology.md)
- [Using Zarvis](docs/using-zarvis.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and the first-task
pattern. New and substantially revised screens follow the
[evidence-led design and credit standard](docs/design-and-credits.md).

## Security model

- **No spend keys.** Public on-chain reads use a public lightwalletd. Existing
  reconciliation records remain in the database, but no new viewing-key scans
  can be started through the site.
  The project's own treasury is the one account still scanned: an optional
  process beside the site reads its publicly disclosed viewing key and is not
  reachable over HTTP ([docs/openzcash-treasury.md](docs/openzcash-treasury.md)).
- **Legacy admin retired.** Login, onboarding, management and administrative
  write routes return 404. Old sessions and invite links grant no access.
- **Public data stays available.** The spreadsheet/GitHub importers and public
  APIs are separate from the retired admin routes.
- **Secrets live only in `.env.local`** (gitignored). `.env.example` is names and
  placeholders only.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Postgres + Drizzle ·
Tailwind · React Three Fiber (the 3D office) · deployed on Railway.

## License

Portal and Private Chat: MIT — see [LICENSE](LICENSE). Participate retains
[Apache-2.0](services/participate/LICENSE). Third-party assets retain their notices. Data is mirrored from the ZCG public spreadsheet,
the ZCG GitHub issue tracker, and the Zcash Community Forum.

See [Source distribution](docs/source-distribution.md) for the included services,
licenses, excluded private material and operational boundaries.
