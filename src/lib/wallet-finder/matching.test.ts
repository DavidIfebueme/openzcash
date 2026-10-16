import { describe, expect, it } from "vitest";
import { DEFAULT_REQUIREMENTS, matchWallets, parseWalletRequirements, validateWalletEvidence, walletRequirementsQuery } from "./matching";
import type { CapabilityEvidence, SupportState, WalletEvidenceProfile, WalletPlatformEvidence, WalletRequirements } from "./types";

function fact(status: SupportState = "supported", overrides: Partial<CapabilityEvidence> = {}): CapabilityEvidence {
  return { status, sources: [{ url: "https://wallet.example/docs/release-1", title: "Official release 1 documentation" }], checkedAt: "2026-10-15", scope: "Test wallet v1 on the specified platform", note: status === "supported" ? "Explicitly documented in the official release." : status === "unsupported" ? "Official documentation excludes this capability." : "Documentation does not confirm this capability.", ...overrides };
}
function platform(overrides: Partial<WalletPlatformEvidence> = {}): WalletPlatformEvidence {
  return { availability: fact(), shieldedSend: fact(), shieldedReceive: fact(), hardwareSigning: fact(), multichain: fact(), ...overrides };
}
function wallet(name = "Example", platforms: WalletEvidenceProfile["platforms"] = { android: platform() }, availability = fact()): WalletEvidenceProfile {
  return { walletName: name, availability, platforms };
}
const requirements = (overrides: Partial<WalletRequirements> = {}): WalletRequirements => ({ ...DEFAULT_REQUIREMENTS, ...overrides });
const result = (profile: WalletEvidenceProfile, needs: Partial<WalletRequirements> = {}) => matchWallets([profile], requirements(needs))[0];

describe("wallet selection: documented, platform-specific requirements", () => {
  it("matches Android with shielded sending and receiving", () => {
    expect(result(wallet(), { platform: "android", shielded: "both" })).toMatchObject({ status: "match", platforms: ["android"] });
  });
  it("does not assume an unreviewed platform is available", () => {
    expect(result(wallet(), { platform: "ios" }).status).toBe("unknown");
  });
  it("excludes explicitly unsupported shielded sending", () => {
    expect(result(wallet("Transparent", { android: platform({ shieldedSend: fact("unsupported") }) }), { shielded: "send" }).status).toBe("excluded");
  });
  it("keeps unknown receive support out of confirmed matches", () => {
    expect(result(wallet("Unreviewed", { android: platform({ shieldedReceive: fact("unknown") }) }), { shielded: "receive" }).status).toBe("unknown");
  });
  it("requires both directions when the user requests both", () => {
    expect(result(wallet("One direction", { android: platform({ shieldedReceive: fact("unknown") }) }), { shielded: "both" }).status).toBe("unknown");
  });
  it("does not assume hardware integration", () => {
    expect(result(wallet("Software", { android: platform({ hardwareSigning: fact("unknown") }) }), { hardware: "required" }).status).toBe("unknown");
  });
  it("excludes a documented single-chain wallet for multichain requirements", () => {
    expect(result(wallet("ZEC only", { android: platform({ multichain: fact("unsupported") }) }), { multichain: "required" }).status).toBe("excluded");
  });
  it("never combines Android send and iOS receive into a false match", () => {
    const split = wallet("Split", { android: platform({ shieldedReceive: fact("unsupported") }), ios: platform({ shieldedSend: fact("unsupported") }) });
    expect(result(split, { shielded: "both" })).toMatchObject({ status: "excluded", platforms: [] });
  });
  it("with no platform preference uses a single fully compatible platform", () => {
    const mixed = wallet("Mixed", { ios: platform({ shieldedSend: fact("unsupported") }), desktop: platform() });
    expect(result(mixed, { shielded: "both" })).toMatchObject({ status: "match", platforms: ["desktop"] });
  });
  it("does not recommend an unreleased wallet despite announced capabilities", () => {
    expect(result(wallet("Announced", { android: platform() }, fact("unsupported"))).status).toBe("excluded");
  });
  it("requires a usable release on the selected platform", () => {
    expect(result(wallet("Other release", { android: platform({ availability: fact("unsupported") }) }), { platform: "android" }).status).toBe("excluded");
  });
  it("requires verified wallet availability even without other requirements", () => {
    expect(result(wallet("Not verified", { android: platform() }, fact("unknown"))).status).toBe("unknown");
  });
  it("keeps an empty platform record unknown", () => {
    expect(result(wallet("Missing", {}))).toMatchObject({ status: "unknown", platforms: [] });
  });
  it("supports the full Android + private + hardware + multichain combination only when all facts agree", () => {
    const needs = requirements({ platform: "android", shielded: "both", hardware: "required", multichain: "required" });
    const results = matchWallets([wallet("Complete"), wallet("Missing hardware", { android: platform({ hardwareSigning: fact("unknown") }) })], needs);
    expect(results.filter(item => item.status === "match").map(item => item.walletName)).toEqual(["Complete"]);
  });
  it("does not infer receive support from send support", () => {
    const outgoing = wallet("Send only", { android: platform({ shieldedReceive: fact("unsupported") }) });
    expect(result(outgoing, { shielded: "send" }).status).toBe("match");
    expect(result(outgoing, { shielded: "receive" }).status).toBe("excluded");
  });
  it("does not require unused optional features", () => {
    expect(result(wallet("Simple", { android: platform({ hardwareSigning: fact("unknown"), multichain: fact("unknown") }) }), { shielded: "both" }).status).toBe("match");
  });
  it("cannot turn an unsupported platform into a match with no privacy requirement", () => {
    expect(result(wallet("Unavailable", { android: platform({ availability: fact("unsupported") }) }))).toMatchObject({ status: "excluded", platforms: [] });
  });
  it("keeps an unknown candidate when another platform is explicitly incompatible", () => {
    const mixed = wallet("Mixed", { android: platform({ shieldedSend: fact("unsupported") }), ios: platform({ shieldedSend: fact("unknown") }) });
    expect(result(mixed, { shielded: "send" }).status).toBe("unknown");
  });
  it("lists every independently compatible platform without a vendor preference", () => {
    expect(result(wallet("Portable", { android: platform(), ios: platform() }), { shielded: "both" }).platforms).toEqual(["android", "ios"]);
  });
  it("keeps distinct scopes and sources for every independently compatible platform", () => {
    const android = fact("supported", { scope: "Android stable 2.0", sources: [{ url: "https://wallet.example/android", title: "Android release" }] });
    const ios = fact("supported", { scope: "iOS TestFlight 2.1", sources: [{ url: "https://wallet.example/ios", title: "iOS beta" }] });
    const matched = result(wallet("Two channels", {
      android: platform({ shieldedSend: android }),
      ios: platform({ shieldedSend: ios }),
    }), { shielded: "send" });
    expect(matched.platformReasons.map(group => group.platform)).toEqual(["android", "ios"]);
    expect(matched.platformReasons[0].reasons.find(reason => reason.requirement === "Send shielded ZEC")?.evidence).toEqual(android);
    expect(matched.platformReasons[1].reasons.find(reason => reason.requirement === "Send shielded ZEC")?.evidence).toEqual(ios);
  });
  it("does not label a source-less positive fact as a match", () => {
    expect(result(wallet("Unsubstantiated", { android: platform({ shieldedSend: fact("supported", { sources: [] }) }) }), { shielded: "send" }).status).toBe("unknown");
  });
  it("does not label an undated positive fact as a match", () => {
    expect(result(wallet("Undated", { android: platform({ shieldedReceive: fact("supported", { checkedAt: null }) }) }), { shielded: "receive" }).status).toBe("unknown");
  });
  it("retains the source, date and limitation next to the result reason", () => {
    const evidence = fact("supported", { scope: "Android v1.7, Keystone-only signing", note: "Requires the companion app and Keystone firmware 2.8." });
    const match = result(wallet("Pairing", { android: platform({ hardwareSigning: evidence }) }), { hardware: "required" });
    expect(match.reasons.find(item => item.requirement === "Sign with a hardware device")?.evidence).toEqual(evidence);
  });
  it("sorts equally qualified wallets alphabetically instead of by paid or catalog placement", () => {
    expect(matchWallets([wallet("Zulu"), wallet("Alpha")], requirements()).map(item => item.walletName)).toEqual(["Alpha", "Zulu"]);
  });
  it("does not mutate source evidence while evaluating a choice", () => {
    const data = [wallet()]; const before = JSON.stringify(data);
    matchWallets(data, requirements({ platform: "web", hardware: "required" }));
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe("shareable answers", () => {
  it("round-trips all requirements", () => {
    const selected = requirements({ platform: "ios", shielded: "both", hardware: "required", multichain: "required" });
    expect(parseWalletRequirements(Object.fromEntries(new URLSearchParams(walletRequirementsQuery(selected))))).toEqual(selected);
  });
  it("ignores invalid and repeated URL values without enabling a requirement", () => {
    expect(parseWalletRequirements({ platform: "__proto__", privacy: ["send", "receive"], hardware: "yes", multichain: "false" })).toEqual(DEFAULT_REQUIREMENTS);
  });
  it("omits default answers from the URL", () => expect(walletRequirementsQuery(DEFAULT_REQUIREMENTS)).toBe(""));
  it("preserves directional privacy requirements", () => expect(parseWalletRequirements({ platform: "android", privacy: "receive" })).toEqual(requirements({ platform: "android", shielded: "receive" })));
});

describe("evidence schema validation", () => {
  it("accepts a complete record", () => expect(validateWalletEvidence([wallet()], "2026-10-15")).toEqual([]));
  it.each([
    ["missing source", { sources: [] }], ["missing date", { checkedAt: null }],
    ["impossible date", { checkedAt: "2026-02-30" }], ["future date", { checkedAt: "2027-01-01" }],
    ["missing scope", { scope: "" }], ["missing explanation", { note: "" }],
    ["unsafe source", { sources: [{ url: "javascript:alert(1)", title: "Bad link" }] }],
    ["credentials in source", { sources: [{ url: "https://name:password@wallet.example", title: "Private" }] }],
  ])("rejects %s", (_name, change) => {
    expect(validateWalletEvidence([wallet("Invalid", { android: platform({ shieldedSend: fact("supported", change as Partial<CapabilityEvidence>) }) })], "2026-10-15").length).toBeGreaterThan(0);
  });
  it("allows explicitly unknown fields without inventing a source or checked date", () => {
    expect(validateWalletEvidence([wallet("Unknown", { android: platform({ multichain: fact("unknown", { sources: [], checkedAt: null }) }) })], "2026-10-15")).toEqual([]);
  });
  it("rejects duplicate wallet identities", () => expect(validateWalletEvidence([wallet(), wallet()], "2026-10-15")).toContain("Example: missing or duplicate wallet name"));
});
