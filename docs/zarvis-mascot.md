# Zarvis Ironwood — iterations

## Artwork and rendering

The original user-provided character sheet is preserved byte for byte at `public/zarvis/ironwood-reference.png`. Navigation and the small floating launcher still use its portrait via `ZarvisMark`.

The main welcome mascot and replies use `ZarvisFigure`: full-body artwork with a genuinely transparent background, no circular frame, and padding for the animation. Eight poses cover resting, waving, thinking, explaining, reading, exploring, protecting and celebrating. SVG layers separate head, eyes and selected arms; CSS adds gentle breathing and gestures with pauses. This is raster artwork with animated layers, not a supplied 3D model or fully articulated rig.

The new atlas is `public/zarvis/ironwood-poses-v2.png` (1254 × 1254 RGBA, 1,690,474 bytes). It was created on 2026-09-26 using the built-in image-generation tool, in edit mode, referencing the original character sheet and requesting `transparent_background: true`. The output was copied without bitmap modification; pose selection and animation happen in the component. Next's existing image optimizer delivers the asset.

## Behavior

- Opening or tapping the welcome mascot triggers a greeting with a moving hand.
- Idle: breathing and blinking. Pointer movement over the mascot adds a small gaze response.
- Draft entered: resting pose with gentle attention and breathing.
- Request: thinking; actual source lookup events can switch to exploring or reading.
- Answer text streaming: explaining, reading, exploring or protecting, based on the question topic.
- Completion: a brief celebration, then the answer retains its topic pose and gentle motion. This acknowledges response completion, not factual verification. Older answers are still.
- Error or interrupted response: a thoughtful pose; the textual error stays visible.

Pause works before and during a conversation and freezes the current gesture without resetting it. Motion stops when the tab is hidden or `prefers-reduced-motion` is enabled. No sound, extra model calls, telemetry or fake network progress were added for animation. The interface remains English; responses follow the question language.

## Review locally

- `/zarvis`: the clean main chat.
- `/zarvis/iterations`: eight animated examples shown together, with the actual trigger for each pose. Four example-question buttons fill and focus the real chat without submitting. The previous/current comparison is expandable and retains its ten state controls. “Follow the live conversation” binds those comparison figures to real request events. Manual expression controls do not call the AI provider.
- The comparison route is development-only (`notFound()` in production), omitted from navigation and marked noindex.

## Earlier verification — iteration 02, 2026-09-26

| Check | Result |
| --- | --- |
| Focused existing Zarvis suite | 24 tests passed in 3 files |
| TypeScript | Passed (`--noEmit --incremental false`) |
| Scoped lint | Passed for changed components and local route |
| Desktop light and dark themes | Full figure visible, background transparent, original theme colors retained |
| Mobile, 390 × 844 | Main chat: body width and scroll width both 390 px; no horizontal overflow. Comparison controls also work |
| Manual wave | Button pressed and figure state `greeting` verified on mobile |
| Thinking / replying / complete / error | Computed animations: `zarvis-figure-ponder`, `zarvis-figure-talk`, `zarvis-figure-hop`, `zarvis-figure-shake` |
| Pause | Computed animation becomes `none`; resume restores motion |
| Reduced motion | Emulated preference produces `animation-name: none`; preference reset after testing |
| Live integration | Actual OpenAI answer via local POST `/api/zarvis`, HTTP 200, `application/x-ndjson` |
| Live state binding | Draft changes state to `listening`; sending changes it to `thinking` |

### A real test led to a correction

Question: “In two short sentences, explain what a Zcash viewing key reveals and whether it can spend funds.”

The first answer incorrectly generalized viewing-key visibility to senders/receivers. The curated background was expanded using [ZIP 310](https://zips.z.cash/zip-0310) and [ZIP 316](https://zips.z.cash/zip-0316). A fresh real conversation then correctly distinguished incoming and full viewing keys, stated that a viewing key does not itself reveal the shielded sender, and denied spending authority. Two consulted source links were shown. This checks that example; it is not an exhaustive accuracy evaluation of the model.

### Earlier real checks retained

- GPT-5 mini streamed a basic shielded-transfer explanation in 5.12 seconds.
- An official ZIP 316 search completed in 8.45 seconds with its source link.
- Treasury answers used public ZCG sheets imported into an isolated local database and separated a block-accrual Lockbox estimate from a reporting date.
- Local credentials are passed to the process in memory. This work does not enable production or resolve the separate credential-rotation follow-up.

## Response layout — iteration 03, 2026-09-26

User review found two small figures stacked during a request: the placeholder assistant label and the separate progress indicator. These are now one response component with one figure. The status appears beside the same figure and disappears when the response finishes. Completed responses retain the explaining pose, without continuous movement.

The figure is 144 × 137 px on desktop (previous message icon: 36 × 34 px). On mobile and compact chat surfaces it is 108 × 103 px, beside the name/status; the response text then uses the full available width below. This avoids a narrow text column on phones.

Browser verification used real requests: an official ZIP 316 lookup on desktop and a beginner privacy explanation on mobile. In both cases the conversation contained exactly one figure while waiting and after completion; the progress block count dropped from one to zero. Desktop and 390 × 844 light/dark views were inspected. TypeScript, scoped lint and `git diff --check` passed. The existing AI pipeline was unchanged in this iteration.

## Softer motion and more poses — iteration 04, 2026-09-26

The full-body library now has eight poses. The new atlas `public/zarvis/ironwood-actions-v3.png` (1254 × 1254 RGBA, 1,723,276 bytes) adds reading, exploring, protecting and celebrating to the four approved poses. It was generated in edit mode with genuine alpha transparency, using the approved atlas and the original official character sheet as references. The source image was copied without bitmap modification.

Body, head, eyes and selected arms have separate SVG layers. Breathing is grounded at the feet (6.8-second cycle); head movements use longer cycles with rests, and hand gestures have smaller arcs. Poses stay mounted and blend over 380 ms so streamed text does not restart the character. The latest answer stays gently animated after completion; older answers are still.

The topic of the user's question chooses an illustrative answer pose locally: privacy/security uses the shield, documentation/ZIP questions use the book, and ecosystem/wallet exploration uses the magnifier. Other answers keep the explaining pose. These choices are cosmetic, do not indicate that an answer is correct or safe, and do not change model prompts, tool selection or API requests. Actual source-checking status events select reading or exploring while work is in progress.

| Check | Result |
| --- | --- |
| Existing Zarvis tests | 24 passed in 3 files |
| TypeScript and scoped ESLint | Passed |
| All eight poses | Inspected in the local comparison page; full body retained and no circular frame |
| Desktop light/dark | New props and figure edges remain visible on both backgrounds |
| Mobile, 390 × 844 | Actual conversation inspected in both themes; body width and scroll width both 390 px |
| Independent motion | Computed body, head and arm animations differ: `zarvis-soft-breathe`, `zarvis-soft-nod`, `zarvis-soft-gesture` |
| Pose transition | Computed opacity transition: 0.38 seconds |
| Pause/resume | Head and body report `animation-play-state: paused`; the head transform remains identical across observations |
| Reduced motion | Body/head report `animation-name: none` and `transform: none`; emulation reset after checking |
| Real OpenAI response | POST `/api/zarvis` returned HTTP 200 and streamed NDJSON for a ZIP 316 question |
| Completed response | One full-body figure, `reading` pose, `data-animated=true`; the answer includes the official ZIP 316 source |

The comparison page has ten state buttons covering eight artworks (Idle/Listening share a pose; Thinking/Error share a pose). It remains local/development-only. The normal chat retains its clean layout and one mascot per answer.

### Exact additional art prompt

Use case: identity-preserve. Asset type: a transparent production sprite atlas extending Zarvis Ironwood for the OpenZcash chat. Input image 1 is the current approved four-pose sprite atlas: match its exact character proportions, materials, camera angle, warm lighting and scale. Input image 2 is the original official character sheet: preserve its robot-and-nature identity and use its reading/exploring/protecting action ideas. Create ONE square PNG with EXACTLY FOUR new full-body poses in a precise 2 by 2 grid of equal square cells, no drawn grid. Same complete robot in every cell: oversized aged ivory/silver metal head, small compact body, black glass face, friendly glowing gold eyes, gold trim, leafy twisting wood crown, Zcash Z emblem on forehead and chest. Head size, body proportions, crown, face dimensions and feet baseline must match the approved atlas. Top-left: READING, calmly looking at an open small brown book held at chest level, book below the face, friendly curious eyes. Top-right: EXPLORING, gently inspecting a small gold magnifying glass held beside the chest below the face, attentive eyes; no object covering the eyes. Bottom-left: PROTECTING, reassuring friendly pose holding a small gold-edged shield in front of the lower chest, face fully visible, curved happy eyes; no threatening stance. Bottom-right: CELEBRATING, modest cheerful celebration, one small fist lifted beside the shoulder and the other hand relaxed, happy curved eyes, feet planted, no jump, no confetti. All four should be emotionally warm, relaxed and believable. Each character centered in its own cell, crown and feet fully visible with transparent margin, same camera and floor baseline. Genuine alpha transparency around and between all character parts. NO floor, shadow, scene, background, gradient, circle, box, border, labels, captions, watermark or text. Keep clean cutout edges suitable for both white and black UI. Do not change the established character design. This is a sprite asset, not a poster.


## Exact original art prompt

Use case: identity-preserve / background-extraction. Asset type: a production PNG sprite atlas for the Zarvis OpenZcash web chat. Use the supplied character sheet as the exact character identity reference. Create ONE square transparent sprite atlas with EXACTLY FOUR evenly sized cells in a precise 2 by 2 grid, no drawn grid. Preserve Zarvis Ironwood: small friendly robot, aged ivory/silver metal panels, warm gold trims, a black glass face with simple glowing gold eyes, leafy twisting wood crown, small Zcash Z emblem on forehead and chest. The proportions, materials and botanical identity must match the original, not a redesign. Each cell shows ONE COMPLETE FULL-BODY Zarvis from crown to feet, without cropping. Keep identical camera, scale, lighting, and ground baseline across all four cells, with comfortable transparent padding. Top-left: idle, standing relaxed, both arms down, happy curved gold eyes. Top-right: greeting, one raised hand in a friendly wave, happy eyes. Bottom-left: thinking, one hand under chin, curious focused gold eyes. Bottom-right: explaining, open palm presenting gently, friendly attentive eyes. Front three-quarter view, large head and compact body like the reference. Background: genuine alpha transparency everywhere outside each character, including between leaves and fingers. NO black or white backdrop, no floor, rock, landscape, circle, badge, box, halo, framing, background shadow, labels, text, decorative elements or extra characters. This must be a clean reusable sprite atlas with four independent transparent full-body poses, not a poster or mockup. Crisp cutout edges suitable for both light and dark UI.

## Live gallery — 2026-09-26

The local preview now opens with all eight pose examples, using the same `ZarvisFigure` component as the chat. Each card describes when it appears; actual conversations still display one pose at a time. Pause/resume controls all eight examples. The previous avatar comparison is collapsed initially to keep the gallery in view.

Verified in Chrome: eight distinct selected pose layers; one pause sets all eight figures to paused; selecting the ZIP 316 example fills and focuses the composer with zero conversation messages (no automatic send). Mobile viewport 390 × 844 has equal body client/scroll widths of 375 px, accounting for the scrollbar. TypeScript, scoped ESLint and `git diff --check` passed. No model or API behavior changed.
