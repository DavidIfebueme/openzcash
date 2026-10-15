import { copyFileSync, mkdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/@nymproject/nym-client-wasm");
const destination = join(root, "public/private-chat-nym");

mkdirSync(destination, { recursive: true });
for (const file of ["nym_client_wasm.js", "nym_client_wasm_bg.wasm"]) {
  const from = join(source, file);
  statSync(from);
  copyFileSync(from, join(destination, file));
}
copyFileSync(
  join(root, "scripts/private-chat-nym-worker.js"),
  join(destination, "worker.js"),
);

const pkg = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
if (pkg.version !== "1.4.1") throw new Error("Review the Nym SDK upgrade before staging");
const manifest = { sdk: pkg.version, files: {} };
for (const file of ["nym_client_wasm.js", "nym_client_wasm_bg.wasm", "worker.js"]) {
  manifest.files[file] = createHash("sha256").update(readFileSync(join(destination, file))).digest("hex");
}
writeFileSync(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
