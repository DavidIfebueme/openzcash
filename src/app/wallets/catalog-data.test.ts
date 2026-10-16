import { describe, expect, it } from "vitest";
import { EDITORIAL_HIGHLIGHTS, HARDWARE, SOFTWARE, walletPrivacy, walletPublicAudit } from "./catalog-data";

describe("Shared wallet catalog", () => {
  it("preserves the 19 entries, their sequence and the three editorial highlights", () => {
    const wallets = [...SOFTWARE, ...HARDWARE];
    expect(wallets).toHaveLength(19);
    expect(SOFTWARE.slice(0, 4).map(wallet => wallet.name)).toEqual(["Zodl", "Zingo!", "Ywallet", "zkool"]);
    expect(wallets.filter(wallet => EDITORIAL_HIGHLIGHTS.has(wallet.name)).map(wallet => wallet.name))
      .toEqual(["Zodl", "Zingo!", "Vizor"]);
    expect(SOFTWARE.find(wallet => wallet.name === "Zucchini Wallet")).toMatchObject({
      url: "https://zucchinifi.xyz/", platforms: ["Browser extension"], shielded: "full",
    });
  });

  it("keeps unknown and unavailable support separate from explicit transparent-only support", () => {
    expect(walletPrivacy("Ledger").level).toBe("full");
    expect(walletPrivacy("MetaMask Snap").level).toBe("unknown");
    expect(walletPrivacy("Zipher").level).toBe("unknown");
    expect(walletPrivacy("zSTASH").level).toBe("unavailable");
    expect(walletPrivacy("Cake Wallet", "Desktop").level).toBe("unknown");
    expect(walletPrivacy("Brave Wallet", "Android").level).toBe("unavailable");
    expect(walletPrivacy("Brave Wallet", "Desktop").level).toBe("full");
    expect([...SOFTWARE, ...HARDWARE].filter(wallet => wallet.shielded === "transparent").map(wallet => wallet.name))
      .toEqual(["Gem Wallet", "Trezor"]);
  });

  it("keeps public audit reports scoped to the documented wallet and platform", () => {
    expect(walletPublicAudit("Ywallet", "Android")?.source.url).toContain("YWalletAuditReport");
    expect(walletPublicAudit("Ywallet", "Desktop")).toBeNull();
    expect(walletPublicAudit("Ledger")).toBeNull();
    expect(walletPublicAudit("Zucchini Wallet")).toBeNull();
  });
});
