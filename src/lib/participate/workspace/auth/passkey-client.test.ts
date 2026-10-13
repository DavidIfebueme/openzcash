import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { passkeyBrowserAvailable, registerPasskey, signInWithPasskey } from "./passkey-client";

const webauthn = vi.hoisted(() => ({ browserSupportsWebAuthn: vi.fn(), startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock("@simplewebauthn/browser", () => webauthn);

beforeEach(() => {
  vi.resetAllMocks();
  const page = {};
  vi.stubGlobal("window", { self: page, top: page, isSecureContext: true, location: { hostname: "openzcash.org" } });
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => { throw new Error("Storage unavailable"); }) });
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
});
afterEach(() => vi.unstubAllGlobals());

describe("passkey access on the public origin", () => {
  it("offers login without a local hint or a readable storage area", () => {
    expect(passkeyBrowserAvailable()).toBe(true);
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
  });
  it("does not offer device authentication in an embedded page", () => {
    vi.stubGlobal("window", { self: {}, top: {}, isSecureContext: true });
    expect(passkeyBrowserAvailable()).toBe(false);
  });
  it("does not offer unavailable browser capabilities", () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    expect(passkeyBrowserAvailable()).toBe(false);
  });
  it("does not offer authentication over an insecure origin", () => {
    const page = {};
    vi.stubGlobal("window", { self: page, top: page, isSecureContext: false, location: { hostname: "openzcash.org" } });
    expect(passkeyBrowserAvailable()).toBe(false);
  });
  it("gets an account-independent challenge and verifies the explicit device response", async () => {
    const options = { challenge: "test-challenge", rpId: "openzcash.org", userVerification: "required" };
    const credential = { id: "test-credential" };
    const next = "/zcg/participate?record=zcg-github-479";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ options }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ redirectTo: next }) });
    vi.stubGlobal("fetch", fetchMock);
    webauthn.startAuthentication.mockResolvedValue(credential);
    expect(await signInWithPasskey(next)).toEqual({ redirectTo: next });
    expect(webauthn.startAuthentication).toHaveBeenCalledWith({ optionsJSON: options });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/passkeys/options", "/api/auth/passkeys/verify"]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ credential, next });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: "same-origin", cache: "no-store" });
  });
  it("never submits a verification or invents a session after device cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ options: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    webauthn.startAuthentication.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
    await expect(signInWithPasskey("/zcg/participate")).rejects.toThrow("Cancelled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("requests first-key options without a code and verifies only the device response", async () => {
    const options = { challenge: "recent-email", rp: { id: "openzcash.org" } };
    const credential = { id: "created-key" };
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ options }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ passkey: { id: "created-key" } }) });
    vi.stubGlobal("fetch", fetchMock); webauthn.startRegistration.mockResolvedValue(credential);
    await registerPasskey("OpenZcash");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ label: "OpenZcash" });
    expect(webauthn.startRegistration).toHaveBeenCalledWith({ optionsJSON: options });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(credential);
  });
  it("never opens the authenticator when recent email authorization has expired", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "PASSKEY_EMAIL_CONFIRMATION_REQUIRED" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(registerPasskey("OpenZcash")).rejects.toThrow("PASSKEY_EMAIL_CONFIRMATION_REQUIRED");
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
