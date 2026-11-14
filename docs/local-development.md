# Local development and self-hosting

Use Node **24.22.1** and PostgreSQL. This distribution contains three independent
applications. Each has its own lockfile; install dependencies in each directory
you intend to run. No production data, credentials or Git history is included.

| Directory | Application | Dependencies |
| --- | --- | --- |
| Repository root | OpenZcash portal, public APIs, data importers and Zarvis | PostgreSQL; public data sources; optional AI provider |
| `services/participate` | Accounts, passkeys, proposal records and discussion | Separate PostgreSQL; optional verified email sender |
| `services/private-chat` | Isolated experimental chat and Nym worker | Browser and Nym network; separate origin; no database |

## Portal

Create a local database and put its connection string in `.env.local`. Use
`.env.example` as a reference; omit optional blank/placeholder values.

```sh
npm ci
npm run db:migrate
npm run import-zcg
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The import reads the public ZCG spreadsheet. Other pages use current external
sources and may show stale/unavailable states if those sources cannot be reached.
A new database does not reproduce production's historical observations.

AI features are optional. Enable them only with your own provider keys and
budgets. Coinholder semantic tags analyze official public proposal text and cache
by content revision; see [Zarvis](zarvis.md) and the environment template.

## Participate and Private Chat

Follow the [Participate guide](../services/participate/README.md) and
[Chat guide](../services/private-chat/README.md). Recommended local ports are
3001 and 3002. Configure the portal with:

```dotenv
PARTICIPATE_UPSTREAM_URL=http://127.0.0.1:3001
PRIVATE_CHAT_SERVICE_ORIGIN=http://127.0.0.1:3002
```

Chat permits HTTP loopback only in development. In production use a separate
HTTPS origin. Match its `PRIVATE_CHAT_PARENT_ORIGIN` to the portal. Unconfigured
Chat fails closed; cloning this project never silently selects OpenZcash's
hosted Chat. Participate also needs its public-origin and community settings.

The optional committee practice flow uses a separate portal, backend and
disposable database. Follow [Committee practice](../services/participate/docs/committee-practice.md);
the public free pilot and committee practice are separate modes.

## Checks

```sh
npm run typecheck
npm run lint
npm test                # vitest + node suites + error fallback + ecosystem sync
npm run test:copilot
npm run build
```

The full gate in one line is documented in [Contributing](CONTRIBUTING.md#tests);
`npm test` includes the ecosystem-sync suite.

Run the equivalent checks inside each included service. PostgreSQL suites are
opt-in and use disposable databases; see [Contributing](../CONTRIBUTING.md) and
the Participate guide. `DISABLE_AUTO_REFRESH=true` pauses portal accounting
imports, not every external reader. Use local databases and no production keys
for verification.

Published Monthly editions are included. Generating a new edition additionally
needs the Python/PDF dependencies and fonts in [Monthly](../reports/monthly/README.md).
