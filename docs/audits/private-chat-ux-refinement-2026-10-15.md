# Private Chat: guided entry and responsive conversation

Date: 2026-10-15 (America/Sao_Paulo). Branch: `michae2xl/private-chat`. Published to the isolated production pilot after approval of the desktop/mobile preview.

## Changes

- Guided alias → explicit Nym connection → invitation/conversation. Unavailable invitation controls no longer compete with the initial action.
- Incoming room and chat links are captured in tab memory and removed from the URL fragment. Room entry and directory availability remain separate explicit actions. Received links do not require another copy/paste step.
- Larger type, 44px primary actions and toggle hit areas, and a compact mobile conversation layout. A visual viewport listener lets the shell respond when available screen height changes.
- Clear connection states and a recovery action while messages remain paused. Sending remains gated by the controller's route and peer checks.
- Confirmation before clearing a conversation or leaving via the shell. A remotely ended conversation offers “New conversation”; the alias and room survive clearing just the conversation.
- Incoming messages preserve the reader's scroll position and offer a “New messages” action. Acceptance now gives immediate busy feedback.

No changes to the Nym transport, directory protocol, ratchet, network fallback policy or persistence of chat content. The shell receives only an in-memory session-active boolean; no messages or keys cross that context. Theme preference remains the only localStorage use in these UI components.

## Validation

- Private Chat suite: 20 files, 119 tests passed. After the final acceptance feedback change, the 14 interface tests passed again.
- TypeScript check and scoped ESLint passed. Diff whitespace check passed.
- Browser: two synthetic sessions in the local app used real Nym. Invitation, explicit acceptance, bidirectional text, emoji and delivery receipts were observed. A connection was switched off, sending became disabled, explicit reconnect restored the conversation, and a new message arrived at the peer.
- Cancelling the exit confirmation preserved the conversation. After the peer ended it, “New conversation” cleared old messages and restored the invite action.
- Captured desktop at 1440 × 900 and mobile at 390 × 844, in both themes. The mobile entry and active conversation had no horizontal overflow. At 390 × 520, the message input remained inside the viewport (bottom approximately 442px).
- Synthetic sessions were cleared after the exercise. No existing private room or real participant was accessed.

These were browser sessions on one computer, not two physical phones or networks. Virtual keyboard, background suspension and touch ergonomics still need iOS/Android device testing. This interface refinement is not a new independent security audit.

## Production release

- Source commit: `6f55eb8` (`feat(chat): simplify entry and improve mobile conversations`), pushed to the private repository.
- Railway web deployment: `8fe62ede-7abf-475f-b049-24d95a09ab18`, status `SUCCESS`. Build completed with Next.js 16.3.8. The directory service and its persistent volume were not redeployed or reconfigured.
- Public URL: `https://private-chat-production-b8bd.up.railway.app/private-chat`.
- HTTP verification at `2026-10-16T01:16:10Z`: updated onboarding returned 200; health returned ready; root redirected to the chat; `/zcg` and the direct presence endpoint returned 404; Nym worker and WASM returned 200.
- Response retained nonce-based CSP, pinned gateway, no-store, no-referrer, noindex and blocked camera/microphone permissions. Inline nonce matched the response policy.
- A fresh synthetic browser session on the public URL reached **Connected via Nym** after an explicit connection. Cancelling the exit dialog preserved the connection; confirming exit subsequently cleared the synthetic session.
- Hosted desktop and 390 × 844 mobile screens were captured. Mobile content width was 390px, with no horizontal overflow. No participant room was entered and no existing conversation was inspected.
- The two-person message/reconnection evidence above was obtained in the local app before release. The public check verifies connection and interface behavior; the user's physical-device/cross-network test remains separate.

## Preview artifacts

An external local preview gallery contains the desktop/mobile captures, theme selector and mobile entry screen. Screenshots show synthetic content and no reusable room link. The runnable preview is available at `http://127.0.0.1:4430/private-chat` while the local development server is running.
