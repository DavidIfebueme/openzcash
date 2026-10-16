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
  it("matches Zucchini's documented browser shielding without inferring other integrations", () => {
    expect(result("Zucchini Wallet", { platform: "browser", shielded: "both" })?.status).toBe("match");
    expect(result("Zucchini Wallet", { platform: "android", shielded: "both" })?.status).toBe("unknown");
    for (const requirement of ["hardware", "multichain", "audit"] as const) {
      expect(result("Zucchini Wallet", { platform: "browser", shielded: "both", [requirement]: "required" })?.status).toBe("unknown");
    }
    const send = WALLET_EVIDENCE.find(w => w.walletName === "Zucchini Wallet")?.platforms.browser?.shieldedSend;
    expect(send?.note).toContain("transparent receiver");
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
  it("keeps published audit reports scoped to the product and historical platform release", () => {
    expect(result("Ywallet", { platform: "ios", audit: "required" })?.status).toBe("match");
    expect(result("Ywallet", { platform: "desktop", audit: "required" })?.status).toBe("unknown");
    expect(result("Gem Wallet", { platform: "android", audit: "required" })?.status).toBe("match");
    const keystoneAudit = result("Keystone", { platform: "hardware", audit: "required" });
    expect(keystoneAudit?.status).toBe("match");
    expect(keystoneAudit?.reasons.find(r => r.requirement.includes("audit"))?.evidence.scope).toMatch(/1\.8\.2/);
  });
  it("does not turn an old module audit or an audited unusable Snap into a current safety endorsement", () => {
    expect(result("Ledger", { platform: "hardware", audit: "required" })?.status).toBe("unknown");
    expect(result("MetaMask Snap", { platform: "browser", audit: "required" })?.status).toBe("unknown");
    const snap = WALLET_EVIDENCE.find(w => w.walletName === "MetaMask Snap")?.platforms.browser;
    expect(snap?.securityAudit.status).toBe("supported");
    expect(snap?.securityAudit.scope).toMatch(/May 2025/);
    expect(snap?.availability.status).toBe("unknown");
    expect(snap?.availability.sources.map(source => source.url)).toContain("https://github.com/ChainSafe/WebZjs/issues/168");
  });
  it("does not count audits predating the wallet's Zcash integration as matches", () => {
    expect(result("Brave Wallet", { platform: "desktop", shielded: "both", audit: "required" })?.status).toBe("unknown");
    expect(result("Unstoppable Wallet", { platform: "ios", shielded: "both", audit: "required" })?.status).toBe("unknown");
    expect(WALLET_EVIDENCE.find(w => w.walletName === "Brave Wallet")?.platforms.desktop?.securityAudit.sources[0].url).toMatch(/doyensec/);
  });
  it("leaves unverified reports unknown without equating absence of evidence with unaudited", () => {
    expect(result("Zodl", { platform: "ios", audit: "required" })?.status).toBe("unknown");
    expect(result("Edge", { platform: "ios", audit: "required" })?.status).toBe("unknown");
    for (const profile of WALLET_EVIDENCE) {
      for (const evidence of Object.values(profile.platforms)) {
        expect(evidence?.securityAudit.status).not.toBe("unsupported");
      }
    }
  });
  it("exports the same public evidence and methodology without personal search data", async () => {
    const response = GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe(2);
    expect(body.profiles).toEqual(WALLET_EVIDENCE);
    expect(body.license).toBe("MIT");
    expect(body).not.toHaveProperty("answers");
    expect(response.headers.get("Cache-Control")).toMatch(/public/);
  });
});
