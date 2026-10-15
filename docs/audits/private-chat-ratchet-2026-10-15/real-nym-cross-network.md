# Private Chat: two-host Nym test (15 October 2026)

**Result:** the current controller, transport worker, and Olm ratchet completed a synthetic conversation across two independent hosts and networks on the actual Nym mixnet. The Mac client and the Linux client connected, exchanged a signed invitation, required explicit acceptance, delivered 12 encrypted messages with authenticated receipts, blocked sending while the Linux client was offline, reconnected through Nym, and propagated conversation end. The raw, sanitized run result is [real-nym-cross-network.json](real-nym-cross-network.json).

## Test boundary

- Client A: macOS workstation, Node 26.5.0, isolated Nym WASM worker and in-memory identity.
- Client B: Railway `redesign` non-production Linux VM (Ubuntu 24.04), an independent Nym WASM worker and identity. Node 26.5.0 was installed **only in a temporary test directory** to match the local runtime. Its Ubuntu `libatomic1` dependency was also extracted there, after the official package's SHA-256 matched `fe49cbbc7be753528380c724a8eef5f1e31dffa9221f692c5069048d81c7449d`. Neither dependency changed the VM's system runtime or deployed application.
- Both clients ran the same `ChatController`, `createNymTransport`, staged browser worker, Nym WASM 1.4.1, and Matrix crypto WASM 18.9.0. The six relevant remote source/worker hashes matched their local copies after the run; the JSON pins the broader local source set.
- No simulator, fake Nym service, direct chat connection, public test endpoint, deployment, service restart, or environment-variable change was used. The out-of-band **synthetic** invitation moved through the test coordinator's private process pipes; it was neither printed nor written to the report.
- This exercised headless clients on distinct machines/networks. It **did not** exercise two physical handsets, mobile browsers, page rendering, or the production hosting route.

## Observed flow

| Check | Result |
| --- | --- |
| Independent Mac/Linux processes and Nym round-trip probes | Passed; 13.8 s for both routes |
| Signed invitation and explicit remote acceptance | Passed; 3.6 s |
| Ten alternating encrypted messages and receipts | Passed; 16.4 s |
| Linux network interruption and offline-send refusal | Passed; no offline frame submitted |
| Linux Nym reconnection and two more messages | Passed; 10.3 s |
| Remote notification of conversation end | Passed |

The successful run took about 51 seconds end-to-end. The Mac worker submitted 20 application frames and received 19; the Linux worker submitted 19 and received 20, including probes, invitation/control frames, messages, and receipts. The Linux worker established two Nym connections (initial and reconnect). The worker fetch audit recorded zero unexpected HTTP destinations. The Mac worker recorded one `network` failure event during the run, but the asserted message and receipt flow completed; this single observation does not establish long-run stability or latency percentiles.

## Runtime finding

An initial Linux attempt with the VM's system Node 22.19.0 failed before the WASM client obtained a Nym address: four worker-error events, 11 approved topology requests, zero Nym connections, and zero sent/received frames. The Mac connected in the same attempt. Node 26.5.0 on Linux then completed the full test. This points to an environment/runtime compatibility issue for the **headless test adapter**; the available evidence does not isolate the underlying worker exception or prove a browser compatibility defect. Do not use the failed Node 22 attempt as chat delivery evidence.

## Privacy and operational limits

- A direct invite was used. **Discover across two hosts was not validated**: the corrected native SURB directory was not active during this test. The earlier same-host SURB test and this cross-host direct-chat test are separate evidence.
- The test proves each client's Nym route and end-to-end message delivery for one short synthetic session. It does not measure multi-user capacity, mobile network switching, durable directory recovery, or real user-device behavior.
- The controller's ratchet implementation was exercised through alternating messages, but this integration run is not an independent cryptographic review.
- All test clients exited. The remote temporary directory (including its test identity and isolated dependencies) and local staging archive were removed; the deployed Railway service and its configuration were left untouched.

Reproduce with `scripts/private-chat-cross-network-role.mts` and `scripts/private-chat-cross-network-coordinator.mts` after staging the role, private-chat sources, staged Nym worker/WASM, and pinned dependencies on a second non-production host. Keep invitations in process pipes and save only the sanitized report.
