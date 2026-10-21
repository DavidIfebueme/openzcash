# Private Chat sidebar artwork — 2026-10-20

The isolated chat entry had a hand-written partial copy of the portal's icons. New and changed icon keys fell through to a generic ecosystem symbol; several copied icons also used different stroke widths.

The portal's line icon mapping is now a shared component. Development startup and production builds compile that same component to static SVG for the isolated entry document. The entry still has no portal client runtime or network permission, and its iframe privacy boundary is unchanged. Existing logos and Zarvis artwork remain in place. Theme accent variables match the portal.

Seven actual navigation icon comparisons failed before the fix and pass afterward. The targeted navigation suite passed 48 tests, including menu expansion, route visibility and the iframe exit handshake. Targeted lint and the production build passed. The integrated desktop browser preview displayed the corrected symbols while connected through Nym.
