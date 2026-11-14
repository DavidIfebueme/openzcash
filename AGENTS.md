<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OpenZcash — agent guidance

Read [CONTRIBUTING](CONTRIBUTING.md) for setup, the test gate, and the
first-task pattern; this file is the agent-facing summary of the same rules.

## What this project is

OpenZcash is a public transparency portal for the Zcash Dev Fund: it mirrors
the ZCG public spreadsheet, reconciles it against the on-chain Lockbox, and
serves dashboards, a read-only JSON/CSV API, and agent skills. The portal
never holds spend keys. The legacy admin, treasury onboarding, viewing-key and
scan HTTP routes are retired and must stay retired: `src/proxy.ts` returns 404
for them and `getIsAdmin()` is a stub that always returns false. Do not add
login, write, CORS-enabled, or key-import routes without an issue that records
the decision.

## Repository map

| Path | What lives there |
| --- | --- |
| `src/app` | App Router pages and API route handlers |
| `src/lib` | Domain modules (`zcg/`, `zarvis/`, `coinholder/`, `markets/`, `legal/`, …) |
| `src/lib/db` | Drizzle client and schema |
| `scripts/` | Import, sync, knowledge-build, and eval tooling |
| `skills/` | Published agent skills (`zcg-copilot`, `coinholder-copilot`, `zechub-copilot`) |
| `drizzle/` | Generated SQL migrations |
| `docs/` | Methodology, design standards, evaluation records, service guides |
| `data/` | Public coinholder vote snapshots and the published treasury snapshot, with provenance |
| `docker/`, `ops/`, `reports/` | Local engine containers; edge adapters; monthly report tooling |
| `services/participate`, `services/private-chat` | Separately runnable services with their own deps, tests, and READMEs |

## Setup and gate

Node 24.22.1 (`.nvmrc`). Setup: `.env.local` with `DATABASE_URL`, then
`npm ci`, `npm run db:migrate`, `npm run import-zcg`, `npm run dev`. The full
gate, required before pushing:

```bash
npm run typecheck && npm run lint && npm test && npm run test:copilot && npm run build
```

`npm test` covers vitest, the node suites, the error fallback, and ecosystem
sync. Python 3 is required for `test:copilot`. The five opt-in PostgreSQL
suites and their required databases are listed in
[CONTRIBUTING](CONTRIBUTING.md#tests); run them when touching imports,
publication policy, or persisted snapshots.

## Conventions

- TypeScript throughout; colocate vitest tests as `*.test.ts(x)` next to the
  module; `node --test` for `scripts/**/*.test.mjs`; Python unittest for the
  skills. The CI workflow (see [docs/ci.md](docs/ci.md)) runs the same gate
  on every PR.
- Commits are capitalized imperative sentences; the squash-merge appends the
  PR number. One topic per branch (`fix/`, `docs/`, or `<name>/<topic>`).
- New or substantially revised screens follow the
  [evidence-led design and credit standard](docs/design-and-credits.md).
- Documentation must match the code: verify every command, path, and
  behavioral claim against the current tree before writing it, and label
  planned work as planned.

## Boundaries

- Secrets live only in `.env.local` (gitignored). Never commit real values,
  keys, or internal URLs.
- Public API routes are read-only and unauthenticated by design; validation
  goes through zod and queries stay parameterized (Drizzle tagged templates).
- Data shown on the site carries provenance; keep `sourceSheetGid` /
  `sourceRow` / `sourceUrl` style attribution intact when moving data.
- The OpenZcash Treasury runtime (`scripts/treasury-runtime.ts`) is a separate
  process started beside the site. The web application must not import it,
  proxy the wallet engine or expose it over HTTP; the site only reads the
  snapshot file. See [docs/openzcash-treasury.md](docs/openzcash-treasury.md).
- Do not start agent work on `main`; branch first.
