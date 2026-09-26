# Zarvis Ironwood artwork

Source: user-provided `Zarvis_OpenZcash_Starter.zip` and accompanying character sheet, received 2026-09-25. The original `assets/zarvis-reference.png` is preserved byte for byte as `public/zarvis/ironwood-reference.png`.

The chat uses the original character in the welcome avatar, message labels, navigation and floating launcher. Expressions come from selected viewports in the reference sheet, delivered through Next's image optimizer. This is raster reference artwork with a black background, not separate transparent assets or an articulated animation rig.

## Behavior

- Idle: smiling default portrait.
- Draft entered: curious portrait.
- Request / source lookup in progress: thinking portrait.
- Actual answer text streaming: focused portrait.
- Request failure or incomplete response: thoughtful portrait; the error remains explicit in text.
- Completed answers return to the default portrait. The expression does not mean a claim has been independently verified.

A small thinking tilt runs for 4.4 seconds, then rests. It is disabled by `prefers-reduced-motion`. No sound, simulated network progress, extra AI calls or new telemetry are added. All visible copy remains English.

The starter's standalone demo, simulated timers, global scripts and proposed story panels are not loaded into the application. Character identity is a short factual/fictional distinction in the existing prompt; the main chat keeps its minimal layout.

For final illustration assets, replace the viewport rendering in `ZarvisMark` with separately exported images sharing the same framing. Transparent portraits or an authored animation require a separate art deliverable. No 3D/Rive file is claimed here.
