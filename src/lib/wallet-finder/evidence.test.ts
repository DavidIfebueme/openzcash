import { describe, expect, it } from "vitest";
import { SOFTWARE, HARDWARE } from "@/app/wallets/catalog-data";
import { GET } from "@/app/api/wallets/capabilities/route";
import { WALLET_EVIDENCE } from "./evidence";
import { DEFAULT_REQUIREMENTS, matchWallets, validateWalletEvidence } from "./matching";
import type { WalletRequirements } from "./types";

const result = (name: string, requirements: Partial<WalletRequirements>) =>
  matchWallets(WALLET_EVIDENCE, { ...DEFAULT_REQUIREMENTS, ...requirements }).find(w => w.walletName === name);

describe("published wallet capability records", () => {
  it("covers the complete catalog exactly once with valid dated primary evidence", () => {
    expect(validateWalletEvidence(WALLET_EVIDENCE)).toEqual([]);
    expect(WALLET_EVIDENCE.map(w => w.walletName).sort()).toEqual([...SOFTWARE, ...HARDWARE].map(w => w.name).sort());
    expect(WALLET_EVIDENCE.length).toBeGreaterThanOrEqual(10);
  });
  it("does not transfer Brave desktop shielding to its mobile apps", () => {
    expect(result("Brave Wallet", { platform: "desktop", shielded: "both" })?.status).toBe("match");
    expect(result("Brave Wallet", { platform: "android", shielded: "both" })?.status).toBe("excluded");
    expect(result("Brave Wallet", { platform: "ios", shielded: "both" })?.status).toBe("excluded");
  });
  it("does not recommend an unreleased wallet or a Snap with unresolved current compatibility", () => {
    expect(result("zSTASH", {})?.status).toBe("excluded");
    expect(result("MetaMask Snap", { platform: "browser", shielded: "both" })?.status).toBe("unknown");
  });
  it("keeps a broken legacy hardware integration separate from working software capabilities", () => {
    expect(result("zkool", { platform: "android", shielded: "both" })?.status).toBe("match");
    expect(result("zkool", { platform: "android", shielded: "both", hardware: "required" })?.status).toBe("unknown");
  });
  it("does not equate cross-chain swaps with managing native assets", () => {
    expect(result("Zodl", { platform: "ios", multichain: "required" })?.status).toBe("unknown");
    expect(result("Cake Wallet", { platform: "ios", multichain: "required", shielded: "both" })?.status).toBe("match");
  });
  it("requires hardware firmware and companion scope without granting generic Ledger shielding", () => {
    const keystone = result("Keystone", { platform: "hardware", hardware: "required", shielded: "both" });
    expect(keystone?.status).toBe("match");
    expect(keystone?.reasons.map(r => r.evidence.scope).join(" ")).toMatch(/Cypherpunk/);
    expect(result("Ledger", { platform: "hardware", shielded: "both" })?.status).toBe("unknown");
  });
  it("exports the same public evidence and methodology without personal search data", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.profiles).toEqual(WALLET_EVIDENCE);
    expect(body.license).toBe("MIT");
    expect(body).not.toHaveProperty("answers");
    expect(response.headers.get("Cache-Control")).toMatch(/public/);
  });
});
