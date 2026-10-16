# Multiple conversations and compact invites — release validation

Date: 2026-10-15. Branch: `michae2xl/private-chat-conversations`.
Scope: local preview and isolated production pilot, published after user approval.

## Product behavior

- One tab can retain up to eight independent direct conversations. `New chat`
  creates another invite or accepts another person's link without ending the
  current conversations.
- The list shows the last message and unread count. Each conversation has its
  own draft, transcript, delivery states and connection check.
- On mobile, `Chats` above the conversation returns to the list. Ending a chat
  removes only that conversation; leaving/reloading still clears the session.
- Discover remains an opt-in, encrypted room directory, not a shared group chat.
  Its operational room capacity and server configuration are unchanged.

## Security review of the change

- All conversations share the existing ephemeral tab identity and Nym transport.
  Each accepted pair has a separate Olm ratchet. No cryptographic primitive or
  v3 message protocol was changed.
- Incoming packets select a context by conversation ID, then require the matching
  authenticated sender key and active consent before decrypting or applying data.
  A selected UI contact never decides where a received packet is routed.
- Asynchronous sends retain their original conversation context. After encryption,
  context membership, consent, transport generation and session identity are
  rechecked. Switching UI contacts cannot redirect a send; closing a context
  cancels its other queued data.
- Each context owns replay tracking, peer probes and acknowledgement state.
  Reconnection marks all peers unready and independently verifies each route.
  There is still no direct-network fallback when Nym is unavailable.
- Memory remains bounded: eight contexts, 200 transcript entries per context,
  one live invite and at most five pending requests. No transcript persistence,
  analytics endpoint or external shortener was added.
- The same tab identity remains linkable across contacts who compare its public
  key, and a compromised endpoint can read every transcript in that tab. This
  feature does not promise separate anonymous identities per conversation.

## Compact invite format

- `ozc3.` encodes the existing signed fields in a bounded binary representation.
  Standard Nym address keys are encoded as bytes; nonstandard valid address
  lengths have an explicitly sized string representation.
- Expiration is reconstructed from the signed creation time and the existing
  fixed five-minute lifetime. Signature verification and the signing-key to
  encryption-key binding remain mandatory before requesting a chat.
- Canonical re-encoding, strict UTF-8, size checks and exact byte lengths reject
  malformed forms. Legacy `ozchat3.` links are still accepted by this client.
- Measured fixture: 622-character legacy token becomes 341 characters (45.2%
  smaller). The local full URL is 383 characters instead of 664 (42.3% smaller).
  A short opaque code would require a separate resolver; this format does not.
- Clients predating this change cannot read `ozc3.`. The production client now
  supports compact links. Existing old tabs must reload before receiving them;
  users should finish current conversations first because reloading clears them.

## Validation

- 21 test files / 153 tests passed, covering the chat, directory, shell and proxy.
  The native-runtime test requires a temporary local socket and passed outside
  the port-restricted sandbox.
- Added regressions for two simultaneous peers, background unread messages,
  switching during asynchronous encryption, cross-conversation ciphertext,
  reconnecting all peers, per-conversation closure, capacity and expiration.
- Added UI coverage for independent drafts and the mobile list transition.
- Invite tests cover legacy compatibility, Unicode aliases, address forms,
  truncation, trailing bytes, oversized input and mutation of every encoded byte.
- Scoped ESLint and full TypeScript checks passed.
- Real Nym: three synthetic browser identities (Alice, Bob, Carol), one computer
  and one network. Alice accepted two compact invitations in one tab. Both pairs
  exchanged messages; transcripts remained separate and a background message
  produced an unread badge. Alice disconnected and reconnected; both peers
  resumed. A retried message was not duplicated at Bob; Carol received a new
  post-reconnection message.
- Desktop 1440 × 900 and mobile 390 × 844 were checked in light and dark themes.
  No horizontal page overflow. Screenshots contain synthetic conversations only.

This is an implementation review and transport exercise, not an independent
security audit or a new physical-device/cross-network qualification.

## Production release

- Feature source: `df390428e65941be74aa1a1cbecd647bb4b5fc28`. Final source includes
  CSS correction `e684624`, on the same branch pushed to the private repository.
- Final Railway deployment: `82ddbd12-dbf3-40cc-83f9-56da37d27610`, `SUCCESS`,
  service `private-chat`, environment `production`. Next.js/Docker production
  build and healthcheck passed. The directory and main portal were not redeployed.
- Public URL: `https://private-chat-production-b8bd.up.railway.app/private-chat`.
  The main portal's Private Chat menu below Monthly was followed to this URL;
  the link retains `noreferrer`.
- The staged source was built from committed files. Its 1,782-file
  [manifest](private-chat-conversations-2026-10-15/web-artifact-sha256.json)
  has SHA-256 `d782e27c47b9d6f270382243f2b74746256798b01e64300cedbe5b0d604d058e`.
  No `.env`, database, room secret, chat history or local runtime state was sent.
- Final HTTP checks at `2026-10-16T01:58:47.719Z`: chat 200, health ready, root
  redirect 307, portal and direct presence endpoints 404, Nym worker/WASM 200.
  Nonce CSP, pinned gateway, no-store, no-referrer, noindex, and blocked
  camera/microphone permissions remained intact.
- Three synthetic browser identities on the public site used real Nym. One tab
  retained two accepted conversations. Bidirectional messages, delivery receipts,
  a background unread badge and isolated transcripts were observed. Both peers
  received new messages after the central session disconnected and reconnected;
  offline sending was disabled. These sessions used one computer and network.
- The first production check exposed a layout bug at 1280 × 720: the chat list
  could shrink below its contents and the footer intercepted conversation clicks.
  The final CSS prevents that shrinkage and lets the sidebar scroll. Both contacts
  were clicked successfully after deployment; DOM hit testing confirmed neither
  button was covered. Both conversations exchanged messages on the final release.
- Mobile 390 × 844: returning to the list and selecting either conversation
  worked; document width remained 390px. No console errors were recorded in the
  final client. [Desktop](private-chat-conversations-2026-10-15/desktop.png),
  [mobile list](private-chat-conversations-2026-10-15/mobile-list.png),
  [mobile conversation](private-chat-conversations-2026-10-15/mobile-chat.png).
- All synthetic sessions were cleared and extra test tabs closed. No participant
  room or existing real conversation was accessed. Physical-phone and separate-
  network testing remains the user pilot's next step, not a completed result here.
