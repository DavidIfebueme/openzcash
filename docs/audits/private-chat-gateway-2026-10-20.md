# Private Chat gateway recovery — 2026-10-20

## Diagnosis

The public branded page and the isolated chat both exhausted their connection retries. The web service health check returned `ready: true`, which does not establish mixnet availability. With SDK 1.4.1 and the deployed gateway identity, a fresh synthetic client failed before receiving its Nym address: `no gateway with id`.

The Nym entry-gateway API still listed `CFofVdokf1gUucHwFK7MppJFAu8aRTiPHvGjud7Bdc7h` (`s2.sa.br.nympool.drpip.im`) with performance 0.38 and role Inactive. Its WebSocket accepted an upgrade. Therefore HTTP reachability alone was insufficient: the configured node was rejected by the SDK's eligible topology. No performance or topology protections were relaxed.

## Remediation

- Validated replacement identity: `5k434EhsMhrsFJVnupQzmjx8bK5qRqBtEhR4pv1EGLdi`.
- Exact WSS origin: `wss://nym-exit.ch-node2.oceanus.li:9001`.
- The API reported performance 0.99 and EntryGateway at validation time.
- A synthetic client using the unchanged SDK completed an authenticated transport setup and self-message round trip in 7.3 seconds. The integrated browser preview connected, disconnected and reconnected with the same alias.
- Exhausted retries now turn the connection intent off, allowing the existing Try again control to restart directly. The alias and conversation state remain in the tab.
- A sanitized gateway-unavailable reason replaces the generic failure message for this SDK error. No identifiers, credentials or raw SDK errors are logged.
- Nym-only delivery, fixed WSS CSP, end-to-end encryption and the directory identity are unchanged. The directory uses a separate gateway.

## Validation

139 chat tests passed; TypeScript, targeted lint and production build passed. The retry regression and worker error classification failed before the code fix and passed afterward. Local browser round-trip checks are not certification of physical mobile devices or separate networks.

The deployment must update both public gateway variables together and rebuild the browser bundle. The web health check remains only an HTTP readiness check. Future gateway health checks should validate the SDK topology and a mixnet round trip, not only HTTP/WSS reachability.
