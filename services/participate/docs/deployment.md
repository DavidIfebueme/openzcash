# Hosting Participate

Deploy this application independently from the portal, with PostgreSQL and a
private backend listener. Keep the portal and Participate databases separate.
The portal proxies only its allowlisted API, page, and asset paths. A public
backend domain is unnecessary for this arrangement.

Set `APP_BASE_URL`, `PARTICIPATE_PARENT_ORIGIN`, and `PASSKEY_ORIGIN` to the exact
public HTTPS portal origin. Configure `PARTICIPATE_COMMUNITY_ID` for the intended
community. Use distinct random session, internal and email-auth secrets, and
your own verified email sender. Store all secrets in the deployment environment.
Run schema upgrades explicitly before deployment; startup must not seed or
silently replace an existing database.

`npm run build` creates Next standalone output. `npm start` is the generic
hosting path. The included Docker/runtime supervisor additionally supports a
private Railway database or a pinned SSH tunnel; it is optional and intentionally
rejects unknown topology. A generic host should use `next start` behind its TLS
proxy with a private database connection and health check. Adapt deployment
configuration to the chosen provider before use.

Set `CREDIT_PAYMENTS_ENABLED=false`, `PARTICIPATE_COMMITTEE_ENABLED=false`, and
`PARTICIPATE_PUBLIC_DEMO=false` initially. The demo fixture is for isolated local
or disposable demo databases only. It must not share production accounts.

## Optional worker and chain integration

The web application reads records and accepts authorized application actions.
The `participate:worker` command runs separately and reads a private
`PARTICIPATE_AUTOMATION_CONFIG`. The worker needs its own restricted database
role and a compatible operator-managed wallet transport. The transport contract
is implemented in `lib/archive/automation-transport.ts`.

The repository provides the application-side integration, queue, reconciliation,
policy and verification code. Installing it does not provision or activate a
wallet node, signer, SSH identities, Signal sender, monitoring host, or funded
account. Keep writer endpoints and spend authority out of the web environment.
Test transactions on an isolated test network before authorizing chain writes.
No background worker is automatically started by the local setup.

## Release checks

Run tests and build; verify the deployed database health, exact public-origin
rules, anonymous reads, rejected cross-origin writes, and account authorization.
Verify a real email flow and passkey enrollment on your final domain with your
own test account. Recheck proxy headers after TLS termination. Maintain encrypted
backups and test restoration into a separate database before changes.

The `deploy/participate-web-runtime.mjs` wrapper and systemd files preserve the
original OpenZcash hosting policy (including its domain and private database
restrictions). They are reference adapters, not the generic start command.
For your own host use `npm run build` and `npm start` with reviewed networking.
The legacy `deploy/check-public-participate.mjs` checks the iframe workspace;
validate the current native portal journey separately.
