// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WalletCatalog from "./catalog";
import { HARDWARE, SOFTWARE, walletPrivacy } from "./catalog-data";

afterEach(cleanup);

describe("Evidence-aligned wallet catalog", () => {
  it("retains all 18 entries, including unknown and announced wallets", () => {
    render(<WalletCatalog />);
    expect(screen.getByText("18 wallets match this view")).toBeInTheDocument();
    expect([...SOFTWARE, ...HARDWARE]).toHaveLength(18);
    expect(screen.getByRole("link", { name: "MetaMask Snap website" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "zSTASH website" })).toBeInTheDocument();
    expect(screen.getAllByText("Not verified").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(1);
  });

  it("requires documented sending and receiving on the selected platform", () => {
    render(<WalletCatalog />);
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "Android" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Shielded support" }), { target: { value: "full" } });
    expect(screen.getByRole("link", { name: "Zodl website" })).toBeInTheDocument();
    for (const name of ["Brave Wallet", "MetaMask Snap", "Zipher", "zSTASH", "Gem Wallet"]) {
      expect(screen.queryByRole("link", { name: `${name} website` })).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "Desktop" } });
    expect(screen.getByRole("link", { name: "Brave Wallet website" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cake Wallet website" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Zingo! website" })).not.toBeInTheDocument();
  });

  it("shows only a scoped public audit report, not a legacy report as a current safety badge", () => {
    render(<WalletCatalog />);
    const wallet = (name: string) => within(screen.getByRole("link", { name: `${name} website` }).closest(".ws-wallet-card") as HTMLElement);
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "Android" } });
    expect(wallet("Ywallet").getByRole("link", { name: "🛡️ Audit report" })).toHaveAttribute("href", expect.stringContaining("YWalletAuditReport"));
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "Desktop" } });
    expect(wallet("Ywallet").queryByRole("link", { name: "🛡️ Audit report" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "" } });
    expect(wallet("Ledger").queryByRole("link", { name: "🛡️ Audit report" })).not.toBeInTheDocument();
  });

  it("keeps unknown and unavailable support separate from explicit transparent-only support", () => {
    expect(walletPrivacy("Ledger").level).toBe("unknown");
    expect(walletPrivacy("MetaMask Snap").level).toBe("unknown");
    expect(walletPrivacy("Zipher").level).toBe("unknown");
    expect(walletPrivacy("zSTASH").level).toBe("unavailable");
    expect(walletPrivacy("Cake Wallet", "Desktop").level).toBe("unknown");
    expect(walletPrivacy("Brave Wallet", "Android").level).toBe("unavailable");
    render(<WalletCatalog />);
    fireEvent.change(screen.getByRole("combobox", { name: "Shielded support" }), { target: { value: "transparent" } });
    expect(screen.getByText("2 wallets match this view")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gem Wallet website" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trezor website" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ledger website" })).not.toBeInTheDocument();
  });
});
