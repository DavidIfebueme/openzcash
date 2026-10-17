// Rebuild install icons from the editable vector. No font or remote asset dependencies.
// node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../public/icons/openzcash-app.svg", import.meta.url));
for (const [name, size] of [
  ["openzcash-v2-192.png", 192],
  ["openzcash-v2-512.png", 512],
  ["openzcash-v2-maskable-512.png", 512],
  ["apple-touch-icon-v2.png", 180],
]) {
  await sharp(source, { density: 384 }).resize(size, size).removeAlpha().png().toFile(
    new URL(`../public/icons/${name}`, import.meta.url).pathname,
  );
}
