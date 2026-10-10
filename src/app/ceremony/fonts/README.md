# Ceremony font

Cormorant Garamond, regular variable face, from [Google Fonts](https://github.com/google/fonts/tree/3dd78844021e948ceb633d1dcee3f7885561b5d9/ofl/cormorantgaramond). Distributed under the included SIL Open Font License.

- Upstream file: `CormorantGaramond[wght].ttf`
- Upstream SHA-256: `b20b7d9626dd956b2c5e558692ad328b1f19e3275e2782db4fa07670d83f35e0`
- Bundled WOFF2 SHA-256: `976ea61ab3f027b2403437f0f0e1c824fc8e206899c19aed67913773a2aa36a8`
- Weight axis: 300–700; the Ceremony layout uses 500–600.

The font was re-encoded as WOFF2 with FontTools, retaining the complete glyph set and variable axis. To reproduce the conversion from the pinned upstream TTF:

```python
from fontTools.ttLib import TTFont

font = TTFont("CormorantGaramond[wght].ttf")
font.flavor = "woff2"
font.save("cormorant-garamond.woff2")
```

This avoids the Google Fonts URL parsing failure tracked in [Next.js #99114](https://github.com/vercel/next.js/issues/99114), which blocked the production release even on a clean rebuild. The font remains scoped to Ceremony and is served from the application origin.
