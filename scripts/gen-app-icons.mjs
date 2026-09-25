// Rasterises the menu marks so every image in the shell is a PNG: app badges for
// apps without an official logo, inner-page glyphs, and the ZF and brand vectors.
// Run from the repository root: node scripts/gen-app-icons.mjs
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { siClaude, siCursor, siGithub, siGithubcopilot, siGooglesheets, siOpencode, siWindsurf } from "simple-icons";
const src = readFileSync("src/components/icons.tsx", "utf8");
function shape(name) {
  const head = `export const ${name} = svg(`;
  const start = src.indexOf(head);
  if (start < 0) throw new Error("icon not found: " + name);
  // The body runs to the next export (single-line icons close on the same line).
  const next = src.indexOf("\nexport const", start + head.length);
  let body = src.slice(start + head.length, next < 0 ? src.length : next).trim();
  body = body.replace(/\);\s*$/, "").trim();
  body = body.replace(/^<>/, "").replace(/<\/>\s*,?\s*$/, "").trim();
  // JSX to plain SVG: drop comments and expressions, kebab-case the attributes.
  return body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/=\{([^}]*)\}/g, '="$1"')
    .replace(/strokeWidth/g, "stroke-width")
    .replace(/strokeLinecap/g, "stroke-linecap")
    .replace(/strokeLinejoin/g, "stroke-linejoin")
    .replace(/fillRule/g, "fill-rule")
    .replace(/clipRule/g, "clip-rule")
    .replace(/\s+className="[^"]*"/g, "")
    .replace(/\s+/g, " ");
}
const GOLD = "#f4b728", INK = "#1c1917";
// App marks for apps without an official logo: the ink glyph alone on a
// transparent square; the sidebar and the launcher put every app mark, official
// or generated, on the same white rounded tile, so the glyph carries no tile.
const APPS = { calculator: "IconCalculator", monthly: "IconBook", news: "IconNews", lockbox: "IconShield", defi: "IconSwap", z3: "IconTerminal", wallets: "IconWallet", ecosystem: "IconGlobe", manage: "IconGrid", "block-zero": "IconCoins", governance: "IconBalance", ceremony: "IconKey" };
for (const [id, icon] of Object.entries(APPS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g transform="translate(16 16) scale(4)" fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${shape(icon)}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/logos/marks/${id}.png`);
}
// Inner-page glyphs: brand gold on transparent, legible on both sidebar themes.
const PAGES = { grants: "IconGrant", proposals: "IconVote", disbursements: "IconReceipt", recipients: "IconUsers", schedule: "IconList", totals: "IconChart", insights: "IconArrowUp", investments: "IconTrend", reconciliation: "IconCheck", committee: "IconUsers", meetings: "IconBook", stipends: "IconCoins", budget: "IconBalance", office: "IconDashboard", methodology: "IconBook", copilot: "IconTerminal", coinholder: "IconCoins", development: "IconTerminal", wallets: "IconWallet", defi: "IconSwap", z3: "IconTerminal", "viewing-keys": "IconKey", invites: "IconMail", onboarding: "IconPencil", login: "IconShield", overview: "IconDashboard", home: "IconGrid", decisions: "IconBalance", calculator: "IconCalculator", road: "IconBook", people: "IconUsers", watch: "IconPlay", record: "IconList", "ten-years": "IconTrend" };
for (const [id, icon] of Object.entries(PAGES)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#b7791f" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${shape(icon)}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/logos/glyphs/${id}.png`);
}
// Official vector marks rasterised once, so every menu image is a PNG.
// ZF: the padlock-shield emblem alone (the wordmark is unreadable at 18px);
// it is the first six paths of the official file.
const zf = readFileSync("public/logos/zf.svg", "utf8");
const zfPaths = zf.match(/<path\b[\s\S]*?<\/path>|<path\b[^>]*?\/>/g) ?? [];
const zfEmblem = zf.slice(0, zf.indexOf("<path")) + zfPaths.slice(0, 6).join("") + "</g></svg>";
await sharp(Buffer.from(zfEmblem)).resize(400, 400, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).trim().resize(232, 232, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("public/logos/marks/zf.png");
await sharp("public/zcash-mark.svg").resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile("public/logos/marks/openzcash.png");

// Agent marks for the copilot pages: brand glyphs from simple-icons, in ink on
// transparent (the dark theme inverts them). Codex has no published mark and
// keeps a plain hexagon.
const AGENTS = { "claude-code": siClaude.path, cursor: siCursor.path, opencode: siOpencode.path, windsurf: siWindsurf.path, "github-copilot": siGithubcopilot.path };
mkdirSync("public/logos/agents", { recursive: true });
for (const [id, d] of Object.entries(AGENTS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><path fill="${INK}" d="${d}"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/logos/agents/${id}.png`);
}
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l7.8 4.5v9L12 21 4.2 16.5v-9z"/><circle cx="12" cy="12" r="2.6" fill="${INK}" stroke="none"/></svg>`)).png().toFile("public/logos/agents/codex.png");

// News source marks (GitHub, Google Sheets): brand glyphs in ink, inverted in
// the dark theme like the other generated glyphs.
for (const [id, d] of Object.entries({ github: siGithub.path, sheets: siGooglesheets.path })) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><path fill="${INK}" d="${d}"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/logos/marks/${id}.png`);
}
