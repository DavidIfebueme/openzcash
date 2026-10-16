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
vi.mock("../catalog-data", () => ({ SOFTWARE: [], HARDWARE: [], EDITORIAL_HIGHLIGHTS: new Set(["Matched wallet"]) }));
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
  it("guides five labeled questions, retains answers in the URL and focuses each new question", () => {
    open("");
    expect(screen.getByRole("group", { name: /Where do you want to use Zcash/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Android / }));
    expect(new URLSearchParams(window.location.search).get("platform")).toBe("android");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const privacy = screen.getByRole("group", { name: /What do you want to do privately/ });
    expect(privacy.querySelector("legend")).toHaveFocus();
    fireEvent.click(screen.getByRole("radio", { name: /^Send and receive privately/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("group", { name: /Do you need a hardware signer/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("group", { name: /Do you also need to manage other coins/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("group", { name: /Need a public audit report/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See matching wallets" }));
    expect(screen.getByRole("heading", { name: "1 wallet matches your choices" })).toHaveFocus();
    expect(window.location.search).toBe("?platform=android&privacy=both&view=results");
    const matches = screen.getByRole("region", { name: "1 wallet matches your choices" });
    expect(within(matches).getByRole("heading", { name: "Matched wallet" })).toBeInTheDocument();
    expect(within(matches).queryByText("Unknown wallet")).not.toBeInTheDocument();
    expect(within(matches).queryByText("Excluded wallet")).not.toBeInTheDocument();
  });

  it("restores shared answers, allows editing and resets all requirements", () => {
    open("?platform=android&privacy=both&view=results");
    fireEvent.click(screen.getByRole("button", { name: "Edit privacy" }));
    expect(screen.getByRole("radio", { name: /^Send and receive privately/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /^Receive privately/ }));
    expect(new URLSearchParams(window.location.search).get("privacy")).toBe("receive");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "See matching wallets" }));
    expect(screen.getByText("Receive privately")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(window.location.search).toBe("?view=platform");
    expect(screen.getByRole("radio", { name: /^Any platform/ })).toBeChecked();
  });

  it("restores the previous question and answers through browser history", async () => {
    open("?platform=android&view=platform");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("radio", { name: /^Receive privately/ }));
    act(() => window.history.back());
    await waitFor(() => expect(screen.getByRole("radio", { name: /^No privacy requirement/ })).toBeChecked());
    expect(new URLSearchParams(window.location.search).get("platform")).toBe("android");
    expect(new URLSearchParams(window.location.search).get("view")).toBe("privacy");
  });

  it("keeps unknown and unsupported wallets separate, with source date and scope available", () => {
    open("?platform=android&privacy=both&view=results");
    expect(screen.getByText("1 wallet needs more verification")).toBeInTheDocument();
    expect(screen.getByText("1 wallet does not meet these choices")).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "0 wallets match your choices" })).toBeInTheDocument();
    expect(screen.getByText("2 wallets need more verification")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit audit" }));
    expect(screen.getByRole("radio", { name: /^Public report required/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /^No audit requirement/ }));
    expect(new URLSearchParams(window.location.search).get("audit")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See matching wallets" }));
    expect(screen.getByRole("heading", { name: "1 wallet matches your choices" })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "0 wallets match your choices" })).toBeInTheDocument();
    expect(screen.getByText("3 wallets need more verification")).toBeInTheDocument();
    expect(screen.getByText("0 wallets do not meet these choices")).toBeInTheDocument();
  });

  it("does not promote an undocumented positive fact into a confirmed result", () => {
    const fact = fixtures[0].platforms.android.shieldedReceive;
    fixtures[0].platforms.android.shieldedReceive = { ...fact, sources: [], checkedAt: null };
    try {
      open("?platform=android&privacy=both&view=results");
      expect(screen.getByRole("heading", { name: "0 wallets match your choices" })).toBeInTheDocument();
      expect(screen.getByText("2 wallets need more verification")).toBeInTheDocument();
    } finally {
      fixtures[0].platforms.android.shieldedReceive = fact;
    }
  });

  it("explains an empty result without promoting unknown support", () => {
    open("?platform=android&privacy=both&hardware=required&view=results");
    expect(screen.getByRole("heading", { name: "0 wallets match your choices" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No confirmed matches for this combination" })).toBeInTheDocument();
    expect(screen.getByText(/unknown support never counts as a match/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit your choices" })).toBeInTheDocument();
  });

  it("makes a completed no-preference search shareable and reports clipboard success", async () => {
    open("?view=results");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Copy result link" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied."));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
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
    ["platform question", "?view=platform"],
    ["privacy question", "?platform=android&view=privacy"],
    ["hardware question", "?platform=android&privacy=both&view=hardware"],
    ["multichain question", "?platform=android&privacy=both&view=multichain"],
    ["audit question", "?platform=android&privacy=both&view=audit"],
    ["matching results", "?platform=android&privacy=both&view=results"],
    ["empty results", "?platform=android&privacy=both&hardware=required&view=results"],
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
