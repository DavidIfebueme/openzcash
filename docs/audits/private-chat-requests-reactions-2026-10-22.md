# Private Chat: pending requests, replies, reactions and Discover removal

Date: 2026-10-22 (America/Sao_Paulo). Branch: `michae2xl/chat-network-status`. Published to the isolated pilot after the Railway incident of 21 October was closed and the user authorised the deployment.

## Changes

- Accepting one request no longer drops the other pending requests or the invite. Requests stay under "Requests" in the sidebar with Accept and Decline for each; new ones keep arriving while the invite is valid (5 minutes) and expiry clears only what is still pending. A link from someone who already asked is answered instead of requested back; requests sent at the same time resolve by key order (`e478dea`).
- Reply with a quote and reactions. Hovering a bubble (tapping it on a phone) shows Reply and React. A reply sends only the quoted message id (`re` on the `text` packet) and the bubble renders the quote from local history; tapping the quote jumps to the original. Reactions use a fixed set of six emoji carried by a new `react` packet inside the ratchet, one per person per message. Neither counts toward the 400-character or 200-message limits and nothing is stored beyond the tab (`83e50da`).
- Mobile open chat: the network status panel leaves the compact header, html/body follow the theme colour (no light band behind the shell in dark mode), the document is scroll-locked under the height-locked shell and keyboard-induced scrolling is undone on visual viewport changes (`e478dea`).
- Discover, rooms, presence and the Nym directory removed from the code: controller, interface, presence API route, directory modules, native client bridge, scripts, ops image, `NEXT_PUBLIC_PRIVATE_CHAT_DISCOVER` flag and the directory variables in the pilot deployment and Dockerfile. A `#room=` link shows a notice asking for a direct invite (`b4a4adc`). The `private-chat-directory` service had already been taken offline on 22 October; its volume is preserved.

No changes to the Nym transport parameters, cover traffic, gateway pinning, CSP policy shape or the Olm ratchet. No content telemetry was added.

## Validation

- Private Chat suite: 19 files, 117 tests passed after the removal (45 room, presence and directory tests were deleted with their code). TypeScript check, scoped ESLint, `git diff --check` and a production `next build` passed on the final source.
- Local preview with three real Nym sessions on one computer (two desktop tabs, one phone viewport embedded in the portal entry): two requests listed and accepted one after the other, a link from a pending requester answered with Accept, a reply with its quote delivered both ways, reactions synced and replaced on both sides, light and dark themes, no console errors. The mixnet was slow that night: two acceptances took about a minute and two messages needed Retry.
- A `#room=` link opened through the portal entry showed the notice inside the embedded chat.

Browser sessions on one computer are not two physical phones or networks. The iOS keyboard case behind the earlier "white screen" report could not be reproduced in emulation; the fixes address the causes found (light document canvas in dark mode, document scroll under the shell, misaligned panel).

## Production release

- Source commit: `b4a4adc` (`refactor(chat): remove Discover, rooms, presence and the Nym directory`), pushed to the private repository with `e478dea` and `83e50da`.
- Deployment source staged with `node scripts/stage-private-chat-pilot.mjs web` and uploaded with `railway up` to the `private-chat` service, environment `production`.
- Railway deployment: `5abcba29-5986-4944-8639-997ab88646b1`, status `SUCCESS` (healthcheck passed), created 12:32 UTC. Five earlier uploads between 07:10 and 07:53 UTC failed before any build with `Failed to snapshot repository. Please try again in a few minutes.` during the Railway platform incident of 21–22 October (builds paused, then restored by plan; CLI snapshot uploads recovered around 12:30 UTC). The previous deployment `b02644bd` stayed online throughout.
- Public URL: `https://private-chat-production-b8bd.up.railway.app/private-chat`; the portal entry at `https://openzcash.org/private-chat` embeds it unchanged.
- Post-deploy checks at about 12:40 UTC: `/private-chat` 200 with the nonce CSP, `no-store`, `no-referrer`, `noindex` and blocked camera/microphone; the embedded document returned `frame-ancestors https://openzcash.org`; `/healthz` 200; the retired `/api/private-chat/presence` 404; worker and WASM 200. The served HTML contains the new FAQ entry and no Discover copy. The portal entry at `openzcash.org/private-chat` returned 200 with its own CSP and loaded the new chat.
- Live check on the public URL with two synthetic sessions on one computer (one embedded in `openzcash.org/private-chat`, one direct): both reached Connected via Nym through the pinned gateway; the request appeared under Requests and was accepted; a message, a reply carrying its quote and a 👍 reaction were delivered both ways with receipts. Sessions were cleared afterwards. One computer and one network are not two phones.

The `PRIVATE_CHAT_DIRECTORY_ADDRESS` and `PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY` variables were deleted from the service after the release, with the user's approval; no redeploy was triggered. The `private-chat-directory` service remains offline with its volume preserved.
