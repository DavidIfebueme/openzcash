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
- The embedded preview connected through the real Nym network. Additional release checks are recorded below when complete.

References: [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [CSP frame ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
