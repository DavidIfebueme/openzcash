# Real Nym validation — 15 October 2026

The final ratchet/controller passed nine checks against an actual native Nym directory. Evidence is in `real-nym-native-surb.json`; `real-nym-preratchet-baseline.json` is a separate earlier run with the development address-return directory, not evidence for the final protocol.

## What ran

- Two independent local Nym WASM workers, with isolated ephemeral IndexedDB. They ran the exact staged browser worker, actual `createNymTransport`, and actual `ChatController`. Network transport was not simulated. Both users shared one physical machine/network; this does not certify two independent devices or mobile browsers.
- A temporary directory on the existing **non-production Railway redesign** Linux service, without changing its environment, configuration, deployment, or public routes.
- The official `nym-binaries-v2026.20-glasgow` Linux x86_64 `nym-client`, verified against the release SHA-256 `076391d969cf4dc8715ed2aa6650b43a34120b050c93fc760c511f5b48b2e4f5`. Its fresh test identity was isolated with the officially supported `NYM_HOME_DIR`; stats reporting was disabled before running. Cover traffic/delays retained defaults.
- The exact compiled application directory runtime: authenticated room, encrypted persistence, anonymous SURB responses, no address fallback. The native socket and operator health endpoint bound only to loopback.
- Linux `flock` retained the exclusive OS lock on inherited FD 3; the runtime's lock validation was unchanged. Python was absent on this test host, so the Python production launcher itself was not exercised here.
- The report pins the binary, uploaded compiled runtime, controller, ratchet, envelope, and dependency lockfile by SHA-256. Initial source hashes still matched after the test; additional hashed source files had not changed since before it started.

## Outcomes

1. Both routes passed actual mixnet round-trip probes.
2. Private-room publication and discovery succeeded using encrypted requests and SURB replies.
3. Requesting a conversation required the other user's explicit acceptance.
4. Ten alternating messages arrived with authenticated delivery receipts.
5. The offline user could not submit a message; no direct connection fallback occurred.
6. Reconnection restored the conversation, then two more messages and their receipts arrived.
7. Ending the conversation reached the peer.
8. Refusing a new invitation reached the requester.
9. A correctly signed but expired synthetic invitation was refused before transmission. This last boundary check is local; it did not wait five wall-clock minutes.

Totals: **47 application frames submitted and received**, including **six anonymous directory operations**, three client connections (one reconnect), and 15 topology fetches. The worker fetch audit observed no unexpected HTTP destinations. Native directory counters reported six requests, six queued replies, zero discarded requests and zero failures; the client assertions establish that those replies arrived, beyond merely being queued.

The ten-message phase took about 15.3 seconds; reconnect plus two messages took about 13.5 seconds. These are single-run observations, not load-test percentiles.

## Operator note

Do not use a raw TCP connect/disconnect as the native client's readiness probe. During setup, an incomplete connection to the native WebSocket coincided with a native panic; after the test supervisor used passive listener inspection, startup and the full run succeeded. Use the directory's loopback HTTP health endpoint or a valid WebSocket protocol interaction. Health alone still does not prove mixnet delivery.

The temporary supervisor had a 25-minute hard cleanup deadline and was explicitly stopped after validation. Cleanup evidence is attached to the final JSON. The test removed its temporary directory and private native/application identities. No production deploy took place.

## Remaining operational evidence

This run does not establish durable-volume recovery across native-client/service restarts on the eventual production host, 20-user capacity/latency, independent-device/mobile behavior, or an independent cryptographic audit. Existing simulated runtime restart/lock tests remain separate from this real-network evidence.

## Reproduce

Start an approved native directory and make its public descriptor available in a local file. Set `PRIVATE_CHAT_TEST_DIRECTORY` to that file, `PRIVATE_CHAT_TEST_REQUIRE_SURB=true`, and `PRIVATE_CHAT_TEST_ROOM` to an admitted private room link through the process environment without printing it. Optionally set `PRIVATE_CHAT_TEST_REPORT` to a JSON output path. Run:

```sh
node --import tsx scripts/private-chat-real-nym.mts
```

The harness refuses a non-SURB directory when required. It uses only synthetic aliases/messages and emits no addresses, room links, private keys, or message bodies.
