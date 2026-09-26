# Zarvis Ironwood artwork

Source: user-provided `Zarvis_OpenZcash_Starter.zip` and accompanying character sheet, received 2026-09-25. The original `assets/zarvis-reference.png` is preserved byte for byte as `public/zarvis/ironwood-reference.png`.

The chat uses the original character in the welcome avatar, message labels, navigation and floating launcher. Expressions come from selected viewports in the reference sheet, delivered through Next's image optimizer. The source is raster reference artwork with a black background, not separate transparent assets or a supplied animation rig. The interface now layers the original eyes and greeting hand in SVG so they can move independently. The source PNG is still unchanged.

## Behavior

- Opening / tapping the welcome mascot: a full-body greeting with an independently waving hand.
- Idle: smiling portrait, breathing and blinking. Pointer movement over the welcome mascot changes its gaze.
- Draft entered: curious portrait.
- Request / source lookup in progress: thinking portrait.
- Actual answer text streaming: focused portrait.
- Request failure or incomplete response: thoughtful portrait; the error remains explicit in text.
- A completed answer triggers a brief hop and wink, then returns to the default portrait. This acknowledges completion, not independent verification of its claims.

Thinking and answering have distinct head movements driven by actual request and streaming events. A visible control pauses/resumes the mascot before and during a conversation. Animations stop when the tab is hidden and are disabled by `prefers-reduced-motion`. No sound, simulated network progress, extra AI calls or new telemetry are added. Interface labels remain English; answers follow the question language.

The starter's standalone demo, simulated timers, global scripts and proposed story panels are not loaded into the application. Character identity is a short factual/fictional distinction in the existing prompt; the main chat keeps its minimal layout.

For final illustration assets, replace the viewport rendering in `ZarvisMark` with separately exported images sharing the same framing. Transparent portraits or an authored animation require a separate art deliverable. No 3D/Rive file is claimed here.

## Local checks — 2026-09-26

- Original artwork, independently moving greeting hand and blinking eyes rendered on desktop and at 390 × 844.
- Light/dark themes, pause/resume and reduced-motion preference verified in the browser. Computed animation changes from `zarvis-breathe` to `none` with reduced motion.
- Real GPT-5 mini responses streamed through the local route. A basic explanation completed in 5.12 seconds; an official ZIP 316 web search completed in 8.45 seconds with its source link.
- Official public ZCG sheets imported into the isolated local test database; treasury answers use those records and distinguish the Lockbox block-accrual estimate from the source report date.
- The local process receives the existing Railway credential in memory; it is not written into the checkout. This does not enable production or resolve the previously reported credential-rotation follow-up.
