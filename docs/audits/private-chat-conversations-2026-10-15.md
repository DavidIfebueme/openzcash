# Multiple conversations and compact invites — preview validation

Date: 2026-10-15. Branch: `michae2xl/private-chat-conversations`.
Scope: local preview only. This change has not been deployed to the production pilot.

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
- Clients predating this change cannot read `ozc3.`. Compact links are for this
  preview until the receiving production client is upgraded as well.

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

This is an implementation review and local transport exercise, not an independent
security audit or a new physical-device/cross-network qualification. A production
build and release verification remain part of the subsequent deployment step.
