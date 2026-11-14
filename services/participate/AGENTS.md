<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Participate — agent guidance

Separately runnable Next.js service (committee/treasury operations). Read its
[README](README.md) first. Gate from `services/participate`: `npm run typecheck && npm run lint && npm test -- --maxWorkers=2 && npm run test:runtime && npm run build`. Database tests need the disposable Postgres setup described in the README and run in CI (`participate-database` job). Keep changes inside this directory; the root portal has its own package and gate.
