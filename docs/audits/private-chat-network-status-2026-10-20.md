# Nym status inside Private Chat — 2026-10-20

The user requested monitoring inside the chat dashboard. The mistakenly created Codex heartbeat was deleted. A compact, expandable Nym network panel now sits immediately below the connection control; it does not replace the user's authenticated mixnet connection indicator.

## Sources and meaning

- `https://status.nym.com/api/v1/endpoints/statuses?page=1&pageSize=1`: the current Gatus observation for each service. The Validators tile specifically describes **Nyx RPC checks**, not the health of all consensus validators. Signers and other APIs are counted separately.
- `https://validator.nymtech.net/api/v2/unstable/nym-nodes/skimmed/mixnodes/active`: the current active mixing set.
- `https://validator.nymtech.net/api/v2/unstable/nym-nodes/skimmed/entry-gateways`: listed entry-capable gateways and the configured browser gateway's topology score.
- Links to `https://status.nym.com` and `https://nym.com/explorer` open only on an explicit click, with no referrer. The topology feed is the official Nym API; listed/active node counts do not certify end-to-end delivery.

Fresh source data in the local preview showed 1/1 Nyx RPC check, 16/16 signers, 3/3 APIs, 60 active mix nodes, 627 entry gateways and a 99% browser-gateway score. These are timestamped observations, not fixed UI values.

## Privacy and failure behavior

The browser polls only the fixed same-origin `/api/private-chat/network-status` path every two minutes while visible. It omits cookies and referrers. The server makes fixed, credential-free upstream requests, shares a 60-second in-flight/cache snapshot across visitors, and bounds response sizes and timeouts. It does not forward request headers, IPs, aliases, messages, invitation tokens or user identifiers to Nym's monitoring sources. The panel makes ordinary public-status HTTP requests to the chat host; it is separate from private message/Discover transport.

The route rejects query parameters and remains restricted to the enabled chat's canonical origin by the isolated pilot proxy. No broad API exception or external browser CSP permission was added. Portal routes, Discover, session crypto, gateway selection and the Nym-only message transport remain unchanged.

Missing sources, malformed payloads, incomplete pagination, stale epochs, service samples over five minutes old and topology snapshots over thirty minutes old produce unknown data. Failed refreshes and expired snapshots after a background tab resumes cannot retain a green status. A listed gateway below the SDK 1.4.1 minimum of 50% is flagged; Inactive epoch role alone is not rejected. A fresh, complete topology with no configured gateway is reported as not listed, not a successful connection.

## Validation

- 171 chat, route and proxy tests passed; the additional background-tab expiry regression also passed afterward.
- TypeScript, focused lint and the full production build passed before the final visibility-only refinement; the deployment build must validate the final source.
- Real sources rendered in the local preview. Desktop light/dark and 390×844 mobile were inspected, including keyboard disclosure, compact layout and no horizontal overflow. No browser console errors were observed.
- Public status and successful HTTP responses are not proof of a real peer exchange. This change does not claim new physical-device or cross-network certification.

Publication and served-route checks are recorded after deployment.
