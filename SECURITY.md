# Security

This distribution includes experimental privacy and governance components.
The supported source is the current default branch; older snapshots may retain
known issues. Review the [installation guide](docs/local-development.md),
[Participate scope](services/participate/docs/implementation-status.md), and
[Private Chat trust boundaries](services/private-chat/README.md) before hosting.

## Reporting a vulnerability

Use GitHub **private vulnerability reporting** on this repository (Settings →
Security → "Report a vulnerability"); it reaches the maintainers directly and
keeps the report private. If it is unavailable, contact a maintainer through
their published GitHub profile and ask for a private channel before sharing
sensitive details. Do not open a public issue containing credentials, personal
data or an unmitigated exploit.

Include the affected commit, component, reproducible steps and expected impact.

### What to expect

- Acknowledgement of well-formed reports within **72 hours**.
- Triage and an initial severity assessment within **14 days**.
- Coordinated disclosure: we ask for a reasonable window to fix before any
  publication, and we will credit reporters by name unless they prefer
  otherwise.

### Safe harbor

We consider security research conducted in good faith — on your own local
instance of this source, or against accounts and data you own — to be
intended, welcome and lawful interaction. Research that avoids degradation of
service, exfiltration of other users' data, and privacy violations will not
be treated as hostile. If you are unsure whether something is in scope, ask
first via the reporting channel above.

### Scope

In scope: the source in this repository (portal, `services/participate`,
`services/private-chat`, skills, scripts) and its documented self-hosted
deployment, plus the public endpoints of <https://openzcash.org> when
exercised without degradation of service.

Out of scope: the ZCG spreadsheet and its upstream sources, GitHub, the Zcash
Community Forum, upstream providers (OpenAI, Anthropic, xAI), Railway, and any
third-party service the site mirrors or reads. Vulnerabilities in those belong
with their operators. Social engineering, spam, and denial-of-service testing
against hosted services are out of scope.

## Hosting boundary

Keep application and provider secrets outside Git. Use distinct credentials
for each service, explicit origins, least-privilege database accounts and
restricted network access. Public source access does not grant authority to
activate committee operations, paid credits or wallet signing.

The checks actually performed before publication are recorded in the topic
audits under [docs/audits](docs/audits). Automated tests and dependency scans
are not an independent cryptographic audit, a penetration test of the hosted
infrastructure or a promise that software has no defects.
