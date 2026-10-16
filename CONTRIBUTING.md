# Contributing to OpenZcash

Thanks for helping make Zcash funding transparent. This guide covers setup, the
test gate, and the patterns this repo actually uses.

## What this project does

OpenZcash mirrors the official ZCG public spreadsheet into Postgres, reconciles it
milestone by milestone, audits it against the on-chain Dev Fund Lockbox, and
serves dashboards, a read-only JSON/CSV API, and agent skills. The system never
holds spend keys, and the legacy admin surface is retired (those routes return
404).

## Prerequisites

- Node >= 20.9.0 (`package.json`, `engines`)
- Postgres (any local instance; `docker-compose.yml` ships an optional
  `postgres:16` container under the `db` profile)
- Python 3, only if you run the copilot-skill test suite

## Environment setup

Create `.env.local` with the connection string for your local development database:

```dotenv
DATABASE_URL=postgres://USER@localhost:5432/openzcash
```

Replace `USER` and the database name with your local settings. Use `.env.example`
as a reference for additional settings, not a ready-to-run configuration. Omit
unused optional variables: blank `CRON_SECRET` and placeholder RPC URLs fail
validation even in mock mode. Only add a valid value when enabling that feature.

```bash
npm install
npm run db:migrate           # apply the schema
npm run import-zcg           # mirror the ZCG spreadsheet into the DB
npm run dev                  # http://localhost:3000
```

Secrets live only in `.env.local` (gitignored). `.env.example` is names and
placeholders only; never commit real values. Leave `ZCG_SHEET_ID` unset to use the
built-in public spreadsheet id (`src/lib/zcg/sheets.ts`); setting it to an empty
string disables that fallback.

## Repository map

| Path | What lives there |
| --- | --- |
| `src/app` | Next.js App Router pages and API route handlers |
| `src/lib` | Domain modules: `zcg/` (ledger, importers, repos), `zarvis/` (AI assistant), `zcash/` (chain reads), `coinholder/`, `markets/`, `legal/`, and more |
| `src/lib/db` | Drizzle client and the schema (`schema.ts`) |
| `scripts/` | Import, sync, knowledge-build, and eval tooling |
| `skills/` | The published agent skills (`zcg-copilot`, `coinholder-copilot`, `zechub-copilot`) |
| `drizzle/` | Generated SQL migrations |
| `docs/` | Methodology, design standards, and evaluation records |

## A good first task

The typical small change is one surface, fixed and tested in the same PR. For
example, commit `59cf88e` ("fix(news): keep source filters and rendered rows in
sync") touches `src/app/news/page.tsx`, the lib module behind it, and adds
colocated tests (`src/app/news/page.test.tsx`, `src/lib/news/feed-identity.test.ts`).
Pick a page or module, make the change, and add a colocated `*.test.ts` next to
what you touched.

## Dev workflow

- Branches in this repo use topic prefixes such as `fix/`, `docs/`, or a personal
  `<name>/<topic>` prefix; PRs target `main`.
- There are no `.github/` templates yet; a short description of what changed and
  why is enough.
- Keep PRs to one surface when practical; the test gate below is fast.

## Tests

Run the gate before opening a PR:

```bash
npm run typecheck && npm test && npm run build
```

Verified on a clean checkout (2026-10-05): `npm run typecheck` exits 0, and
`npm test` reports 205 test files passed, 3 skipped (2,883 tests) from vitest plus
6 passing tests from `node --test scripts/build-zarvis-knowledge.test.mjs`.

Other suites:

- `npm run lint` (eslint)
- `npm run test:copilot` (node + Python unittest for the published skills)
- `npm run eval:zarvis` (Zarvis answer evaluation)

To add tests, colocate a `*.test.ts` (or `.tsx`) file next to the module; vitest
picks up `src/**/*.test.{ts,tsx}` (`vitest.config.ts`). Four PostgreSQL suites
are independently skipped unless their environment variable is set:

| Variable | Required local database | Suite |
| --- | --- | --- |
| `ZCG_SNAPSHOT_TEST_DB_URL` | A migrated database on a loopback host; uses temporary tables | `src/lib/zcg/import-snapshots.integration.test.ts` |
| `ZCG_PUBLICATION_TEST_DB_URL` | Host `127.0.0.1`, database name starting with `openzcash_d1_test` | `src/lib/zcg/publications.integration.test.ts` |
| `ECOSYSTEM_TEST_DB_URL` | Host `127.0.0.1`, database `openzcash_ecosystem_test` | `src/lib/ecosystem/snapshot-store.integration.test.ts` |
| `LEGAL_ARCHIVE_TEST_DB_URL` | Host `127.0.0.1`, database `openzcash_legal_test` | `src/lib/legal/archive-store.integration.test.ts` |

Use disposable local databases only. The publication, legal and ecosystem suites apply
migrations and clear their test tables. Setting one variable does not enable
the other suites; report any skipped suites with your validation results.

## Debugging and common failures

- **`tsc` fails with `TS2307` inside `.next/dev/types/validator.ts`** after
  routes were renamed or deleted: the generated Next.js type validators are
  stale. Delete the regenerated artifacts (both gitignored):
  `rm -rf .next/dev/types tsconfig.tsbuildinfo`, then run `npm run typecheck`
  again.
- **`npm run dev` or `npm run build` rewrites `public/.well-known/`**: the
  `predev`/`prebuild` hooks republish the agent skills (`scripts/publish-copilot.mjs`).
  Leave those regenerated diffs out of unrelated PRs.
- **Import behaves as frozen**: `DISABLE_AUTO_REFRESH=true` pauses the spreadsheet
  import cycle while keeping diligence signals warm (`src/instrumentation.ts`).
- **Chain reads without a node**: `ZCASH_GATEWAY=mock` (the `.env.example`
  default) uses the built-in dataset; real RPC needs the Zebra/zallet variables.

## Code patterns

- **To add a public JSON/CSV endpoint**, copy an existing data route such as
  `src/app/api/zcg/data/grants/route.ts`: read params, call a repo function,
  wrap the hot path in `cached()` (`src/lib/cache/memo.ts`), and return through
  `dataResponse()` (`src/lib/api/serialize.ts`) for JSON/CSV, cache headers, and
  gzip.
- **To add or revise a screen**, follow the
  [evidence-led design and credit standard](docs/design-and-credits.md):
  clear records, accessible sources, both themes, and visible attribution for
  community contributions.

## Help

Open an issue at
[github.com/Michae2xl/openzcash/issues](https://github.com/Michae2xl/openzcash/issues).
Discussions are not enabled on this repository.
