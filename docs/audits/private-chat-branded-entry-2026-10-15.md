# Private Chat: branded entry and origin boundary

The requested public entry is `https://openzcash.org/private-chat`. The portal serves a dedicated HTML document rather than its React application shell. A full-page frame loads the existing isolated chat service. The address bar stays on OpenZcash; the chat's document, worker and cryptographic state keep their separate origin.

## Boundary review

- Only `?embedded=1` enables framing, and only by `https://openzcash.org`. The parent is server-selected, never supplied by a URL parameter. Standalone chat continues to use `frame-ancestors 'none'`. Other routes retain their existing anti-framing headers.
- The parent has a nonce-protected script and stylesheet, no portal runtime, `connect-src 'none'`, no referrer, no cache and no indexing. Its frame destination is fixed in production. The local override is limited to loopback in development.
- A fragment invite is captured in memory and removed from the top-level address. It is never included in the iframe URL or HTML attribute. The parent sends it once after a ready message from the exact child window and origin.
- The child accepts only bounded invitation/room messages from the exact parent window and origin. It does not automatically connect, join or accept a conversation. It sends only readiness to the parent, not aliases, keys, transcripts or session state.
- Generated invite links use the branded parent address. Exit navigates the top-level window after the existing confirmation. Nym transport and per-conversation encryption are unchanged.

This isolates an honest chat document from unrelated portal scripts. It does not protect against a compromised operator replacing the entry page, a compromised browser/device, or code served by the chat service. The hosting and entry gateway IP visibility described in the pilot documentation is unchanged. Browser storage partitioning and physical mobile keyboard behavior need continued device testing.

## Local verification

- 136 chat tests passed, including new framing, invitation-origin/source validation and branded invite cases.
- 55 entry/navigation tests passed, including fragment clearing, forged readiness rejection, one-time handoff and oversized token rejection.
- Type checks and changed-file lint passed in both worktrees.
- Served preview headers verified: the dedicated parent policy and the child policy permit only the intended frame relationship.
- Both production builds passed.
- Two synthetic preview sessions connected through the real Nym network. The branded fragment was removed from the parent address, appeared as a received invitation, and required request/accept. Alice's message arrived in Bob's session. Bob's reply was submitted, but the browser harness detached Alice's tab before a reply receipt was verified; this is not recorded as a bidirectional delivery test.
- A 390 x 844 viewport showed the full conversation/composer without horizontal overflow. The exit confirmation navigated the top-level page back to the portal and cleared the test session. This is viewport emulation, not a physical phone test.

## Release

- Chat source: `2266fdd`; Railway deployment `fdbceb8e-f5f8-49d8-9324-86475ff2c534` succeeded. Public standalone and embedded documents return 200, with their respective strict ancestor rules and no-referrer. Readiness returns 200.
- Portal change: PR #169, merged as `1a36aeb8a1af252c89e0a94dfb646cec06503382`; Railway deployment `4c5d1c55-f782-4ce9-a106-e9e1d7d341c3` succeeded.
- Public HTTP checks passed for the branded route, fresh CSP nonces, frame destination, no-referrer/no-store, absence of portal scripts, the relative menu link and the unchanged anti-framing policy on `/zcg`.
- Browser verification: clicked Private Chat below Monthly in the public menu; the chat rendered while the top-level URL remained `https://openzcash.org/private-chat`. No redirect to the service hostname occurred.
- The public embedded page created a synthetic identity and reached `Connected via Nym`. Its generated invite used origin `https://openzcash.org` and path `/private-chat`. The invite was revoked, the session was explicitly cleared, and the page was left at the empty alias form. This public check is separate from the two-session local preview test above.

References: [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [CSP frame ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
