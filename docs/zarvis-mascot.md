# Zarvis Ironwood — iterations

## Artwork and rendering

The original user-provided character sheet is preserved byte for byte at `public/zarvis/ironwood-reference.png`. Navigation and the small floating launcher still use its portrait via `ZarvisMark`.

The main welcome mascot, conversation labels and waiting indicator now use `ZarvisFigure`: full-body artwork with a genuinely transparent background, no circular frame, and padding for the animation. Four poses cover resting, waving, thinking and explaining. SVG layers animate the greeting hand and eyes; CSS adds breathing, attention, reply gestures, completion and error reactions. This is raster artwork with animated layers, not a supplied 3D model or fully articulated rig.

The new atlas is `public/zarvis/ironwood-poses-v2.png` (1254 × 1254 RGBA, 1,690,474 bytes). It was created on 2026-09-26 using the built-in image-generation tool, in edit mode, referencing the original character sheet and requesting `transparent_background: true`. The output was copied without bitmap modification; pose selection and animation happen in the component. Next's existing image optimizer delivers the asset.

## Behavior

- Opening or tapping the welcome mascot triggers a greeting with a moving hand.
- Idle: breathing and blinking. Pointer movement over the mascot adds a small gaze response.
- Draft entered: attention/leaning animation.
- Request or source lookup: thinking pose and movement.
- Answer text streaming: explaining pose and movement.
- Completion: a brief hop and wink, then idle. This acknowledges response completion, not factual verification.
- Error or interrupted response: a thoughtful pose and brief shake; the textual error stays visible.

Pause works before and during a conversation. Motion stops when the tab is hidden or `prefers-reduced-motion` is enabled. No sound, extra model calls, telemetry or fake network progress were added for animation. The interface remains English; responses follow the question language.

## Review locally

- `/zarvis`: the clean main chat.
- `/zarvis/iterations`: previous/current comparison, seven expression controls, pause/resume and the actual chat. “Follow the live conversation” binds the figures to real request events. Manual expression controls do not call the AI provider.
- The comparison route is development-only (`notFound()` in production), omitted from navigation and marked noindex.

## Verified — 2026-09-26

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

## Exact art prompt

Use case: identity-preserve / background-extraction. Asset type: a production PNG sprite atlas for the Zarvis OpenZcash web chat. Use the supplied character sheet as the exact character identity reference. Create ONE square transparent sprite atlas with EXACTLY FOUR evenly sized cells in a precise 2 by 2 grid, no drawn grid. Preserve Zarvis Ironwood: small friendly robot, aged ivory/silver metal panels, warm gold trims, a black glass face with simple glowing gold eyes, leafy twisting wood crown, small Zcash Z emblem on forehead and chest. The proportions, materials and botanical identity must match the original, not a redesign. Each cell shows ONE COMPLETE FULL-BODY Zarvis from crown to feet, without cropping. Keep identical camera, scale, lighting, and ground baseline across all four cells, with comfortable transparent padding. Top-left: idle, standing relaxed, both arms down, happy curved gold eyes. Top-right: greeting, one raised hand in a friendly wave, happy eyes. Bottom-left: thinking, one hand under chin, curious focused gold eyes. Bottom-right: explaining, open palm presenting gently, friendly attentive eyes. Front three-quarter view, large head and compact body like the reference. Background: genuine alpha transparency everywhere outside each character, including between leaves and fingers. NO black or white backdrop, no floor, rock, landscape, circle, badge, box, halo, framing, background shadow, labels, text, decorative elements or extra characters. This must be a clean reusable sprite atlas with four independent transparent full-body poses, not a poster or mockup. Crisp cutout edges suitable for both light and dark UI.
