# Private Chat: portal navigation and centered layout

The branded entry now renders the existing app hierarchy beside the isolated chat. It uses the portal's 252px sidebar, 1400px content limit, local fonts and light/dark palette. On viewports at or below 960px, navigation moves into a dismissible drawer with a focus trap. Private Chat stays below Monthly.

## Boundary review

- The host still serves a dedicated, nonce-protected HTML document. It imports the route model on the server without loading the portal's React, Zarvis, treasury or analytics runtime. `connect-src 'none'`, no-referrer and no-store remain in place. Only same-origin images and fonts were added to the host CSP.
- The cross-origin frame and its ancestor allowlist remain unchanged. `embedded=1&shell=portal` enables the integrated layout; older embeds and standalone views retain their own header during rollout.
- The new bridge accepts only an exact parent window/origin and strictly shaped theme or bounded leave-request messages. The parent sends a theme value or opaque request ID, never a destination command. The chat returns only the matching request ID and a boolean navigation decision. It exports no aliases, keys, invite contents or transcripts.
- An active identity, draft alias or incoming invitation triggers the existing local confirmation. Cancel retains the session. Confirm explicitly clears the controller and then authorizes the parent to navigate to the previously selected same-origin link. Unsolicited, wrong-origin, wrong-window, mismatched and replayed approvals are ignored.
- Encryption, invitation handoff, discovery and Nym transport are unchanged. This review does not extend the pilot's anonymity guarantees or replace an independent security audit.

## Verification

- 138 chat tests and 56 portal/navigation tests passed, including authenticated bridge validation, cancellation/clearing behavior and parity with the shared navigation model.
- TypeScript, changed-file ESLint and both production builds passed.
- Local browser checks: 1440×1000 desktop, 390×844 mobile, both themes, mobile menu open/close/Escape, ZCG expansion without leaving the chat, and matching parent/frame themes.
- A synthetic session connected over the real Nym network inside the new wrapper. Selecting News showed a confirmation; cancel retained the identity, while confirm cleared it and navigated the parent document to News. No user conversation or real contact was used.
- These checks use desktop browser viewport emulation. No new physical-device or two-person cross-network certification is claimed for this layout change.

## Release

- Chat source: `ed63955`.
- Portal source: `3ef824b`; PR #170.
- Chat deployment `88667e77-4e30-451f-8263-73a9aeff0ed4`: SUCCESS. The new portal-shell view, legacy embed and standalone view return 200 and retain their intended ancestor restrictions. Readiness returns 200.
- Portal PR #170 merged as `7d05f572d9edce0b7d553d2e8fd500b4f25b3522`; deployment `9e3db47e-0251-4ebe-9530-b87cd88c966a`: SUCCESS.
- Public HTTP checks: new navigation and centered layout present, fresh CSP nonces, no external portal scripts, `connect-src 'none'`, no-store/no-referrer, and unchanged anti-framing on `/zcg`.
- Public browser checks: desktop sidebar, 390×844 mobile drawer and both themes rendered correctly. The parent and frame theme matched. A synthetic identity reached `Connected via Nym`; cancelling a News navigation retained it. Confirming the next navigation cleared the session and opened `/news`. Clicking Private Chat in the public portal menu returned to the official `/private-chat` URL with an empty alias form and disconnected state. No invitation or message was sent in this release smoke check.
- Screenshots: `private-chat-sidebar/production-desktop.png` and `private-chat-sidebar/production-mobile-menu.png` in the task's local visualization artifacts. Temporary deployment sources were removed after the successful release.
