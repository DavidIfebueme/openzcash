// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapabilityEvidence, WalletPlatformEvidence } from "@/lib/wallet-finder/types";

const fixtures = vi.hoisted(() => {
  const fact = (status: CapabilityEvidence["status"], note = "Applies to the documented Android release."): CapabilityEvidence => ({
    status, sources: status === "unknown" ? [] : [{ url: "https://example.org/primary-documentation", title: "Primary capability documentation" }],
    checkedAt: status === "unknown" ? null : "2026-10-15", scope: "Android · reviewed public release", note,
  });
  const platform = (privacy: CapabilityEvidence["status"]): WalletPlatformEvidence => ({
    availability: fact("supported"), shieldedSend: fact(privacy), shieldedReceive: fact(privacy),
    hardwareSigning: fact("unsupported", "A hardware signing integration is not supported."),
    multichain: fact("unknown", "Native asset management on other chains has not been verified."),
    securityAudit: fact("unknown", "No independent report has been verified for this wallet release."),
  });
  return [
    { walletName: "Matched wallet", availability: fact("supported"), platforms: { android: platform("supported") } },
    { walletName: "Unknown wallet", availability: fact("supported"), platforms: { android: platform("unknown") } },
    { walletName: "Excluded wallet", availability: fact("supported"), platforms: { android: platform("unsupported") } },
  ];
});

vi.mock("@/lib/wallet-finder/evidence", () => ({ WALLET_EVIDENCE: fixtures }));
vi.mock("../catalog-data", () => ({
  SOFTWARE: ["Matched wallet", "Unknown wallet"].map(name => ({ name, maker: "Fixture publisher", url: "https://example.org/wallet" })),
  HARDWARE: [{ name: "Excluded wallet", maker: "Fixture publisher", url: "https://example.org/hardware" }],
  EDITORIAL_HIGHLIGHTS: new Set(["Matched wallet"]),
}));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useSearchParams: () => {
      const query = useSyncExternalStore(
        callback => { window.addEventListener("popstate", callback); return () => window.removeEventListener("popstate", callback); },
        () => window.location.search,
        () => "",
      );
      return new URLSearchParams(query);
    },
  };
});
import { WalletFinder } from "./finder";

const nativePush = window.history.pushState.bind(window.history);
beforeEach(() => {
  window.history.replaceState(null, "", "/wallets/find");
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    nativePush(data, unused, url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function open(query: string) {
  window.history.replaceState(null, "", `/wallets/find${query}`);
  render(<WalletFinder />);
}

describe("Wallet Finder interactions", () => {
  it("preserves catalog order on any platform, while filtering and after reset", () => {
    open("");
    const expected = ["Matched wallet", "Unknown wallet", "Excluded wallet"];
    const names = () => within(screen.getByRole("region", { name: /wallets? match/ }))
      .queryAllByRole("heading", { level: 3 }).map(heading => heading.textContent);
    expect(names()).toEqual(expected);
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "android" } });
    expect(names()).toEqual(expected);
    fireEvent.click(screen.getByRole("checkbox", { name: "Send ZEC privately" }));
    expect(names()).toEqual(["Matched wallet"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "any" } });
    expect(names()).toEqual(["Matched wallet"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveValue("any");
    expect(names()).toEqual(expected);
  });

  it("shows one compact filter panel and updates results as filters change", () => {
    open("");
    const filters = screen.getByRole("region", { name: "Filters" });
    expect(within(filters).getByRole("combobox", { name: "Platform" })).toHaveValue("any");
    expect(within(filters).getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.queryByRole("navigation", { name: /Wallet Finder steps/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3 wallets match your filters" })).toBeInTheDocument();

    fireEvent.change(within(filters).getByRole("combobox", { name: "Platform" }), { target: { value: "android" } });
    expect(new URLSearchParams(window.location.search).get("platform")).toBe("android");
    const send = within(filters).getByRole("checkbox", { name: "Send ZEC privately" });
    send.focus();
    fireEvent.click(send);
    expect(send).toHaveFocus();
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("send");
    fireEvent.click(within(filters).getByRole("checkbox", { name: "Receive ZEC privately" }));
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("both");
    expect(screen.getByRole("heading", { name: "1 wallet matches your filters" })).toBeInTheDocument();
    const matches = screen.getByRole("region", { name: "1 wallet matches your filters" });
    expect(within(matches).getByRole("heading", { name: "Matched wallet" })).toBeInTheDocument();
    expect(within(matches).queryByText("Unknown wallet")).not.toBeInTheDocument();
    expect(within(matches).queryByText("Excluded wallet")).not.toBeInTheDocument();

    fireEvent.click(send);
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("receive");
  });

  it("restores a shared filter set, ignores legacy step views and clears everything", () => {
    open("?platform=android&privacy=both&hardware=required&multichain=required&audit=required&view=audit");
    const filters = screen.getByRole("region", { name: "Filters" });
    expect(within(filters).getByRole("combobox", { name: "Platform" })).toHaveValue("android");
    for (const label of ["Send ZEC privately", "Receive ZEC privately", "Hardware signer", "Other blockchains", "Public audit report"]) {
      expect(within(filters).getByRole("checkbox", { name: label })).toBeChecked();
    }
    expect(screen.getByRole("heading", { name: "0 wallets match your filters" })).toBeInTheDocument();
    fireEvent.click(within(filters).getByRole("button", { name: "Clear filters" }));
    expect(window.location.pathname + window.location.search).toBe("/wallets/find");
    expect(within(filters).getByRole("combobox", { name: "Platform" })).toHaveValue("any");
    expect(within(filters).getAllByRole("checkbox").every(control => !(control as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole("heading", { name: "3 wallets match your filters" })).toBeInTheDocument();
  });

  it("restores prior filters through browser back and forward", async () => {
    open("");
    fireEvent.change(screen.getByRole("combobox", { name: "Platform" }), { target: { value: "android" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Send ZEC privately" }));
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("send");
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Send ZEC privately" })).not.toBeChecked());
    expect(screen.getByRole("combobox", { name: "Platform" })).toHaveValue("android");
    act(() => window.history.forward());
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Send ZEC privately" })).toBeChecked());
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("send");
  });

  it("keeps unknown and unsupported wallets separate, with source date and scope available", () => {
    open("?platform=android&privacy=both&view=results");
    expect(screen.getByText("1 wallet needs more verification")).toBeInTheDocument();
    expect(screen.getByText("1 wallet does not meet these filters")).toBeInTheDocument();
    const wallet = screen.getByRole("article", { name: "Matched wallet" });
    fireEvent.click(within(wallet).getByText("Sources, dates & limits"));
    expect(within(wallet).getAllByText("Oct 15, 2026").length).toBeGreaterThan(0);
    expect(within(wallet).getAllByText("Android · reviewed public release").length).toBeGreaterThan(0);
    const source = within(wallet).getAllByRole("link", { name: /Primary capability documentation/ })[0];
    expect(source).toHaveAttribute("href", "https://example.org/primary-documentation");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps editorial stars distinct from linked, version-scoped audit reports", () => {
    const original = fixtures[0].platforms.android.securityAudit;
    fixtures[0].platforms.android.securityAudit = {
      ...original,
      status: "supported",
      scope: "Android 2.1 public release; older code reviewed",
      checkedAt: "2026-10-15",
      sources: [{ url: "https://example.org/audit-report.pdf", title: "Independent audit report" }],
    };
    try {
      open("?platform=android&privacy=both&view=results");
      const wallet = screen.getByRole("article", { name: "Matched wallet" });
      expect(within(wallet).getByRole("img", { name: "Editorial highlight" })).toHaveTextContent("⭐");
      const report = within(wallet).getByRole("link", { name: "Audit report for Matched wallet on Android" });
      expect(report).toHaveAttribute("href", "https://example.org/audit-report.pdf");
      expect(wallet).toHaveTextContent("Android 2.1 public release; older code reviewed");
      expect(wallet).toHaveTextContent("Past reports do not guarantee current safety.");
      expect(within(screen.getByRole("article", { name: "Unknown wallet" })).queryByRole("link", { name: /Audit report/ })).not.toBeInTheDocument();
    } finally {
      fixtures[0].platforms.android.securityAudit = original;
    }
  });

  it("requires documented audit evidence on the same platform and shares the choice", () => {
    open("?platform=android&privacy=both&audit=required&view=results");
    expect(screen.getByRole("heading", { name: "0 wallets match your filters" })).toBeInTheDocument();
    expect(screen.getByText("2 wallets need more verification")).toBeInTheDocument();
    const audit = screen.getByRole("checkbox", { name: "Public audit report" });
    expect(audit).toBeChecked();
    fireEvent.click(audit);
    expect(new URLSearchParams(window.location.search).get("audit")).toBeNull();
    expect(screen.getByRole("heading", { name: "1 wallet matches your filters" })).toBeInTheDocument();
  });

  it("shows platform, version and channel scope without opening source details", () => {
    const availability = fixtures[0].platforms.android.availability;
    const scope = "Android public beta 2.1; Keystone 3 Pro firmware 3.0.4 required";
    fixtures[0].platforms.android.availability = { ...availability, scope };
    try {
      open("?platform=android&privacy=both&view=results");
      const wallet = screen.getByRole("article", { name: "Matched wallet" });
      expect(within(wallet).getByText("Android reviewed scope")).toBeVisible();
      const visibleScope = within(wallet).getAllByText(scope).find(element => !element.closest("details"));
      expect(visibleScope).toBeVisible();
      expect(wallet.querySelector("details")).not.toHaveAttribute("open");
    } finally {
      fixtures[0].platforms.android.availability = availability;
    }
  });

  it("shows each claimed platform's own visible scope and source links", () => {
    const iosSources = [{ url: "https://example.org/ios-beta", title: "Official iOS beta documentation" }];
    const iosFacts = Object.fromEntries(Object.entries(fixtures[0].platforms.android).map(([key, fact]) => [key, {
      ...fact,
      scope: "iOS TestFlight 2.1; separate beta channel",
      sources: iosSources,
    }])) as WalletPlatformEvidence;
    Object.assign(fixtures[0].platforms, { ios: iosFacts });
    try {
      open("?privacy=both&view=results");
      const wallet = screen.getByRole("article", { name: "Matched wallet" });
      expect(within(wallet).getByText("Matches on Android, iPhone / iPad.")).toBeVisible();
      expect(within(wallet).getByText("Android reviewed scope")).toBeVisible();
      expect(within(wallet).getByText("iPhone / iPad reviewed scope")).toBeVisible();
      const visibleIosScope = within(wallet).getAllByText("iOS TestFlight 2.1; separate beta channel").find(element => !element.closest("details"));
      expect(visibleIosScope).toBeVisible();
      fireEvent.click(within(wallet).getByText("Sources, dates & limits"));
      expect(within(wallet).getByRole("heading", { name: "Send shielded ZEC · Android" })).toBeVisible();
      expect(within(wallet).getByRole("heading", { name: "Send shielded ZEC · iPhone / iPad" })).toBeVisible();
      expect(within(wallet).getAllByRole("link", { name: /Primary capability documentation/ }).length).toBeGreaterThan(0);
      expect(within(wallet).getAllByRole("link", { name: /Official iOS beta documentation/ }).length).toBeGreaterThan(0);
    } finally {
      delete (fixtures[0].platforms as Record<string, WalletPlatformEvidence>).ios;
    }
  });

  it("does not substitute a verified platform for an unreviewed requested platform", () => {
    open("?platform=web&privacy=both&view=results");
    expect(screen.getByRole("heading", { name: "0 wallets match your filters" })).toBeInTheDocument();
    expect(screen.getByText("3 wallets need more verification")).toBeInTheDocument();
    expect(screen.getByText("0 wallets do not meet these filters")).toBeInTheDocument();
  });

  it("does not promote an undocumented positive fact into a confirmed result", () => {
    const fact = fixtures[0].platforms.android.shieldedReceive;
    fixtures[0].platforms.android.shieldedReceive = { ...fact, sources: [], checkedAt: null };
    try {
      open("?platform=android&privacy=both&view=results");
      expect(screen.getByRole("heading", { name: "0 wallets match your filters" })).toBeInTheDocument();
      expect(screen.getByText("2 wallets need more verification")).toBeInTheDocument();
    } finally {
      fixtures[0].platforms.android.shieldedReceive = fact;
    }
  });

  it("explains an empty result without promoting unknown support", () => {
    open("?platform=android&privacy=both&hardware=required&view=results");
    expect(screen.getByRole("heading", { name: "0 wallets match your filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No confirmed matches for this combination" })).toBeInTheDocument();
    expect(screen.getByText(/unknown support never counts as a match/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Platform" })).toBeVisible();
  });

  it("shares a canonical filter link and reports clipboard success", async () => {
    open("?view=results");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Copy result link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied."));
    expect(writeText).toHaveBeenCalledWith(new URL("/wallets/find", window.location.origin).href);
    expect(new URLSearchParams(window.location.search).get("view")).toBe("results");
  });

  it("exposes all capability fields for a directly linked wallet, including unverified facts", () => {
    open("?view=evidence&wallet=Unknown%20wallet");
    expect(screen.getByRole("combobox", { name: "Wallet evidence" })).toHaveValue("Unknown wallet");
    expect(screen.getByRole("heading", { name: "Unknown wallet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send shielded ZEC · Android" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Receive shielded ZEC · Android" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign with a hardware device · Android" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manage native assets on multiple blockchains · Android" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public independent security audit · Android" })).toBeInTheDocument();
    expect(screen.getAllByText("Not yet verified").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No primary source recorded for this capability.").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("combobox", { name: "Wallet evidence" }), { target: { value: "Excluded wallet" } });
    expect(new URLSearchParams(window.location.search).get("wallet")).toBe("Excluded wallet");
    expect(screen.getByRole("heading", { name: "Excluded wallet" })).toBeInTheDocument();
  });

  it("labels incomplete positive evidence unknown in the full capability view too", () => {
    const fact = fixtures[0].platforms.android.shieldedReceive;
    fixtures[0].platforms.android.shieldedReceive = { ...fact, sources: [], checkedAt: null };
    try {
      open("?view=evidence&wallet=Matched%20wallet");
      const field = screen.getByRole("heading", { name: "Receive shielded ZEC · Android" }).closest("li");
      expect(field).not.toBeNull();
      expect(within(field!).getByText("Unknown")).toBeVisible();
      expect(within(field!).queryByText("Supported")).not.toBeInTheDocument();
      expect(within(field!).getByText("The evidence record is incomplete; support cannot be confirmed.")).toBeVisible();
    } finally {
      fixtures[0].platforms.android.shieldedReceive = fact;
    }
  });

  it("keeps the community requirements credit in the footer with its source", () => {
    open("");
    const footer = screen.getByRole("contentinfo", { name: "Community contribution" });
    expect(within(footer).getByRole("link", { name: "@Foreveranka" })).toHaveAttribute("href", "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/495");
    expect(footer).toHaveTextContent("Requirements informed by");
    expect(footer).toHaveTextContent("Designed and built by OpenZcash");
  });
});


describe("Wallet Finder automated accessibility", () => {
  it.each([
    ["unfiltered live results", ""],
    ["privacy filters", "?platform=android&privacy=both"],
    ["hardware and audit filters", "?platform=android&hardware=required&audit=required"],
    ["legacy step link", "?platform=android&view=privacy"],
    ["empty results", "?platform=android&privacy=both&hardware=required"],
    ["all capability evidence", "?view=evidence&wallet=Unknown%20wallet"],
  ])("has no WCAG A/AA violations in %s", async (_name, query) => {
    window.history.replaceState(null, "", `/wallets/find${query}`);
    const { container } = render(<main><WalletFinder /></main>);
    // Expand disclosures too: accessible names and evidence semantics must work
    // when the user opens unknown/excluded groups and their source records.
    container.querySelectorAll("details").forEach(details => { details.open = true; });
    const report = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      // jsdom has no rendered color/layout; both themes receive browser QA.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(report.violations.map(violation => ({
      rule: violation.id,
      impact: violation.impact,
      elements: violation.nodes.map(node => node.target),
    }))).toEqual([]);
  });
});
