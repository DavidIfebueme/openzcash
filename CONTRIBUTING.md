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

- Node 24.22.1 (`.nvmrc` and `package.json`, `engines.node`)
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
npm ci
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
| `data/` | Public coinholder vote snapshots with provenance (mirrors `services/participate/data`) |
| `docker/` | Dockerfiles for local engine containers (e.g. the zkool GraphQL engine) |
| `ops/` | Edge/runtime adapters: the error-fallback handler and its tests |
| `reports/` | Monthly report production tooling and publishing records |

## A good first task

The typical small change is one surface, fixed and tested in the same PR. For
example, a news-filter change may touch `src/app/news/page.tsx`, its data module,
and the colocated tests (`src/app/news/page.test.tsx`,
`src/lib/news/feed-identity.test.ts`). Pick a page or module and run the relevant
tests alongside the gate below.

## Dev workflow

- Branches in this repo use topic prefixes such as `fix/`, `docs/`, or a personal
  `<name>/<topic>` prefix; PRs target `main`.
- Branch lifecycle: merged branches are kept for 30 days for reference and
  recovery, then deleted during housekeeping. Never delete an unmerged branch
  without its author's confirmation.
- The [CI workflow](.github/workflows/ci.yml) runs typecheck, lint, tests, copilot
  tests, and the production build on pull requests and pushes to `main`; see the
  [CI overview](docs/ci.md) for what each job does.
- Keep PRs to one surface when practical; the test gate below is fast.

## Tests

Run the gate before opening a PR:

```bash
npm run typecheck && npm run lint && npm test && npm run test:copilot && npm run build
```

Run the gate on the exact changes being submitted and report any skipped suites.
`npm test` also runs the ecosystem-sync suite (`scripts/lib/ecosystem-*.test.mjs`).
The CI test job does not configure a database, so the opt-in PostgreSQL suites
below are skipped there. They should also be run locally when changing imports,
publication policy, or persisted snapshots.

Other suites:

- `npm run lint` (eslint)
- `npm run test:copilot` (node + Python unittest for the published skills)
- `npm run eval:zarvis` (Zarvis answer evaluation)

To add tests, colocate a `*.test.ts` (or `.tsx`) file next to the module; vitest
picks up `src/**/*.test.{ts,tsx}` (`vitest.config.ts`). Five PostgreSQL suites
are independently skipped unless their environment variable is set:

| Variable | Required local database | Suite |
| --- | --- | --- |
| `ZCG_SNAPSHOT_TEST_DB_URL` | A migrated database on a loopback host; uses temporary tables | `src/lib/zcg/import-snapshots.integration.test.ts` |
| `ZCG_PUBLICATION_TEST_DB_URL` | Host `127.0.0.1`, database name starting with `openzcash_d1_test` | `src/lib/zcg/publications.integration.test.ts` |
| `ECOSYSTEM_TEST_DB_URL` | Host `127.0.0.1`, database `openzcash_ecosystem_test` | `src/lib/ecosystem/snapshot-store.integration.test.ts` |
| `COINHOLDER_TOPICS_TEST_DB_URL` | Host `127.0.0.1`, database `openzcash_topics_test` | `src/lib/coinholder/topic-store.integration.test.ts` |
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

## Deployment checklist

Deployments promote `main` to Railway. Work through this checklist for every
production promotion; do not skip steps from habit.

1. **Pre-deploy gate.** CI is green on `main` (typecheck, lint, tests, copilot
   tests, build, service checks, Participate database checks).
2. **Configuration review.** Confirm in the Railway service variables:
   `DATABASE_URL` (production database), `CRON_SECRET` (set and ≥ 16 chars),
   and, when AI features are enabled, the `ZARVIS_*` and provider variables
   (`docs/zarvis.md` documents each one and its default). No secrets in Git;
   no placeholder values in production.
3. **Migrations.** Boot migrations apply automatically on start
   (`scripts/migrate.mjs` in the start command); watch the deploy logs for the
   `zarvis.store` failure line that indicates a migration that did not apply.
4. **Data import.** Verify the ZCG import ran (deploy logs, or trigger
   `GET /api/cron/refresh` with the service `CRON_SECRET`) and that the ledger
   endpoints return current rows.
5. **Post-deploy smoke.** Check, over HTTPS on the production origin:
   `GET /api/zarvis/health` (ok), `GET /api/chain-tip` (current height),
   `GET /api/zcg` (index), and the homepage render. For AI features, one
   direct-answer question and one model-assisted question with citations.
6. **Rollback.** Railway's "redeploy previous" reverts the release; migrations
   are additive by convention (no destructive steps without a paired
   application change), so rollback does not require a database revert.
7. **Cron verification.** Confirm the refresh and legal-archive schedules
   (`src/instrumentation.ts`) and the Zarvis canary (`/api/zarvis/canary`)
   appear in the logs after one full cycle.

## Included services

Run checks inside `services/participate` and `services/private-chat` for service
changes. Their own READMEs describe setup and integration tests. CI also builds
and tests both packages, and installs the Participate baseline in disposable
PostgreSQL. Wallet, email-provider and real Nym delivery checks are separate
operator acceptance tests; CI does not send messages or transact.
