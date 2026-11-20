# Source distribution

The public OpenZcash repository contains the portal and the independently
runnable Participate and Private Chat services. See [Local development](local-development.md)
for setup and [Contributors](../CONTRIBUTORS.md) for attribution.

| Component | Location | License | Required to run |
| --- | --- | --- | --- |
| Portal | Repository root | MIT | Node 24.22.1, PostgreSQL, public data sources |
| Participate | `services/participate` | Apache-2.0 | Separate PostgreSQL, explicit portal origin; own email provider for sign-in |
| Private Chat | `services/private-chat` | MIT | Separate web origin, Nym connectivity; no application database |

Each application has its own lockfile and install/build commands. The CI workflow
checks the portal and both services, including a fresh Participate database with
its SQL integrity rules. A successful local run does not establish that a remote
workflow or hosted deployment has passed.

## Included and excluded

The distribution retains application code, public-source importers, verification
scripts, tests, technical documentation, public historical snapshots, published
Monthly documents, contributor credit, and applicable asset/font licenses.

OpenZcash made its existing repository public on November 20, 2026. Earlier
commits and branches remain accessible, including pilot screenshots and
operational records that are absent from the current release.

The default branch includes example environment files and public grant data.
For self-hosting, supply your own provider credentials and databases. Keep
private wallet material, backups, journals and unpublished grant materials
outside Git.

A new installation does not contain the hosted site's users, credit balances,
notifications or observed history. Data import and provider availability determine
what the new instance can show. Dated public samples are not new official decisions.

## Operational boundaries

- The portal does not silently select the hosted OpenZcash Chat. Set an explicit
  Chat origin and matching parent origin; unconfigured embedding fails closed.
- AI classification is optional, uses the operator's provider account and budget,
  and stays disabled in the source template until configured.
- Participate's web server has no wallet spending authority. The optional chain
  worker requires a separate operator-managed signer and view-only reader. Those
  running services, credentials and deployment-specific wallet binaries are not
  provisioned by this repository.
- Committee permissions, real payments and the free pilot require explicit
  configuration. Source publication grants none of those permissions.
- Private Chat remains experimental. See its [privacy boundaries](../services/private-chat/README.md)
  and Participate's [remaining work](../services/participate/docs/implementation-status.md).

Before hosting, follow [Security](../SECURITY.md), test the final origins and
credentials, verify backup/restore and establish monitoring. Publishing source
and enabling a production service are separate release decisions.
