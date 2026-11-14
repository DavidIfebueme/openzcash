# CI overview

This document describes the repository's automated checks: what runs, when,
and how to work with them. It is aimed at maintainers and contributors who
want to know what a red check means and where to add a new one.

The single workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## When it runs

- Every pull request targeting `main`.
- Every push to `main`.
- Manually, via "Run workflow" (`workflow_dispatch`).

Runs are grouped per workflow and ref with `cancel-in-progress`, so a rapid
series of pushes to the same PR cancels obsolete runs. The workflow declares
top-level `permissions: contents: read` and uses no repository secrets: every
job runs against the checkout with dummy local values only. The `pull_request`
trigger (never `pull_request_target`) means fork PRs run with the read-only
default token.

## Jobs

| Job | What it checks | Timeout | Notes |
| --- | --- | --- | --- |
| `quality` | `npm run typecheck`, `npm run lint` | 10 min | Fails before tests on the same breakage |
| `test` | `npm test` (vitest, node suites, error fallback, ecosystem sync) and `npm run test:copilot` (node + Python unittest for the published skills) | 20 min | Matrix currently pins Node 24.22.1, matching `engines.node` and `.nvmrc` |
| `build` | `npm run build` | 30 min | Restores `.next/cache` keyed on `package-lock.json`; uses a dummy `DATABASE_URL` that is never connected (no page queries at build time) |
| `services` | Per-service gate for `services/participate` and `services/private-chat`: typecheck, lint, tests (plus runtime tests for Participate), build | 20 min | Uses each service's own `package-lock.json` cache |
| `participate-database` | Participate database integrity against a disposable `postgres:16` service container (schema setup, isolated demo test database, full test suite) | 20 min | The only job with a database; the root `test` job has none |

## What is intentionally not in CI

- The five opt-in PostgreSQL suites of the portal (see
  [Contributing](../CONTRIBUTING.md#tests)): the CI test job configures no
  database, so they are skipped there and must run locally when touching
  imports, publication policy, or persisted snapshots.
- Anything that sends messages, transacts, or exercises provider credentials:
  wallet, email-provider and real Nym delivery checks are operator acceptance
  tests.

## Reading failures

- A `quality` failure is a type or lint error: run `npm run typecheck` and
  `npm run lint` locally; the error output is identical.
- A `test` failure names the file and case; rerun a single vitest file with
  `npx vitest run <path>`. Environment-gated skips report as `skipped`, not
  failed.
- A `build` failure after a route or page rename is usually the generated
  Next.js type validators: see "Debugging and common failures" in
  [Contributing](../CONTRIBUTING.md#debugging-and-common-failures).
- `services`/`participate-database` failures are scoped to
  `services/participate` and `services/private-chat`; each service README
  describes how to run its suites locally.

## Adding a check

1. Prefer wiring new tests into the existing npm scripts (`npm test` and the
   service scripts) over adding workflow jobs: the coverage then follows every
   trigger and matrix entry for free.
2. If a genuinely new job is needed, follow the existing pattern: pinned Node
   24.22.1, `cache: npm`, an explicit `timeout-minutes`, and no secrets.
3. Pin third-party actions to full commit SHAs (this workflow uses
   `actions/checkout`, `actions/setup-node` and `actions/cache`); Dependabot
   keeps the pins current once `.github/dependabot.yml` is present.
4. Update this document in the same PR that changes the workflow.
