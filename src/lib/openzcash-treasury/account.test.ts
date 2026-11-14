import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { TREASURY_ACCOUNT } from "./account";
import { TREASURY_KEY_SHA256 } from "./ledger";

// Tripwire for the donation address, the viewing key and the QR code.
//
// The values below were announced publicly on 2026-11-12 (the open letter on
// X and the Zcash Community Forum) and are written here a second time on
// purpose. The address does not change. If this test fails, someone changed
// what donors are shown: that is only ever done by the owner, and announced in
// the same public places first. Do not "fix" this file to make a change pass.
const ANNOUNCED_ADDRESS =
  "u16cutsu3pwvgl4cdf024ss83wxv5pe792gsvmsjaaxqq6j0m4denlv9lflfmfunfeescdke4x76shru8ggmufksxduka6xf8yxq9pw3t2";
const ANNOUNCED_KEY_SHA256 =
  "d11c16ff8152d67188ddead5705e10f63cb74e05a089280ffaba122569f672c9";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const UNIFIED_ADDRESS = /\bu1[0-9a-z]{60,}\b/g;
const VIEWING_KEY = /\buview1[0-9a-z]{100,}\b/g;
const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** Source files that decide what the treasury screens and the API show. Tests are left out: they hold made-up values. */
async function treasurySources(): Promise<string[]> {
  const files: string[] = [];
  for (const dir of [
    "src/lib/openzcash-treasury",
    "src/app/openzcash-treasury",
    "src/app/api/openzcash-treasury",
  ]) {
    for (const name of await readdir(path.join(root, dir), {
      recursive: true,
    })) {
      if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name))
        files.push(path.join(dir, name));
    }
  }
  return files.sort();
}

describe("the published treasury account", () => {
  it("is the address that was announced, on mainnet", () => {
    expect(TREASURY_ACCOUNT.address).toBe(ANNOUNCED_ADDRESS);
    expect(TREASURY_ACCOUNT.network).toBe("mainnet");
  });

  it("is the viewing key that was announced, by its fingerprint", () => {
    expect(sha256(TREASURY_ACCOUNT.viewingKey)).toBe(ANNOUNCED_KEY_SHA256);
    expect(TREASURY_KEY_SHA256).toBe(ANNOUNCED_KEY_SHA256);
    expect(TREASURY_ACCOUNT.viewingKey.startsWith("uview1")).toBe(true);
  });

  it("puts exactly the announced address in the QR code", async () => {
    // What the library encodes for the configured address, read back from the QR segments.
    const { segments } = QRCode.create(TREASURY_ACCOUNT.address);
    const encoded = segments
      .map(({ data }) =>
        typeof data === "string" ? data : new TextDecoder().decode(data),
      )
      .join("");
    expect(encoded).toBe(ANNOUNCED_ADDRESS);

    // The page builds its one QR code from that configured address and from nothing else.
    const page = await readFile(
      path.join(root, "src/app/openzcash-treasury/page.tsx"),
      "utf8",
    );
    expect(page.match(/QRCode\.\w+\(/g)).toEqual(["QRCode.toDataURL("]);
    expect(page).toContain("QRCode.toDataURL(TREASURY_ACCOUNT.address)");
  });

  it("has no other address or viewing key anywhere in the treasury screens, API or modules", async () => {
    const found: string[] = [];
    for (const file of await treasurySources()) {
      const source = await readFile(path.join(root, file), "utf8");
      for (const address of source.match(UNIFIED_ADDRESS) ?? [])
        found.push(
          `${file}: address ${address === ANNOUNCED_ADDRESS ? "announced" : address}`,
        );
      for (const key of source.match(VIEWING_KEY) ?? [])
        found.push(
          `${file}: key ${sha256(key) === ANNOUNCED_KEY_SHA256 ? "announced" : key}`,
        );
    }
    expect(found).toEqual([
      "src/lib/openzcash-treasury/account.ts: address announced",
      "src/lib/openzcash-treasury/account.ts: key announced",
    ]);
  });

  it("matches the published snapshot", async () => {
    const { snapshot } = JSON.parse(
      await readFile(
        path.join(root, "data/openzcash-treasury/snapshot.json"),
        "utf8",
      ),
    );
    expect(snapshot.address).toBe(ANNOUNCED_ADDRESS);
    expect(snapshot.viewingKeySha256).toBe(ANNOUNCED_KEY_SHA256);
  });
});
