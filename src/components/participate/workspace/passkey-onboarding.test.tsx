// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import { PasskeySettings } from "@/components/participate/workspace/passkey-settings";
import { PasskeyConfirmationForm } from "@/components/participate/workspace/passkey-confirmation-form";

const navigation = vi.hoisted(() => ({ navigateAfterSignIn: vi.fn() }));
const webauthn = vi.hoisted(() => ({ browserSupportsWebAuthn: vi.fn(), startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock("@/lib/participate/workspace/auth/redirect", async importOriginal => ({ ...await importOriginal<object>(), navigateAfterSignIn: navigation.navigateAfterSignIn }));
vi.mock("@/components/participate/workspace/participate-bridge", () => ({ useParticipateHost: () => null }));
vi.mock("@simplewebauthn/browser", () => webauthn);
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
const destination = "/zcg/participate?record=zcg-github-479#comments";
const savedKey = { id: "key-1", label: "OpenZcash", createdAt: "2026-10-12", lastUsedAt: null };
const access = { passkeys: [], canManage: true, emailAvailable: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal("isSecureContext", true);
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function submit(name: string) { fireEvent.submit(screen.getByRole("button", { name }).closest("form")!); }
async function emailLogin(offer = true) {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ emailAvailable: true, demoAvailable: false }))
    .mockResolvedValueOnce(response({ retryAfter: 60 }))
    .mockResolvedValueOnce(response({ redirectTo: destination, offerPasskeySetup: offer }));
  vi.stubGlobal("fetch", fetchMock);
  render(<WorkspaceSignInButton next={destination} />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.test" } }); submit("Continue with email");
  fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } }); submit("Verify and continue");
  if (offer && webauthn.browserSupportsWebAuthn()) await screen.findByRole("button", { name: "Create passkey" });
  else await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalled());
  return fetchMock;
}
async function profile(recentEmail = false) {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ ...access, canEnrollWithRecentEmail: recentEmail }));
  vi.stubGlobal("fetch", fetchMock);
  render(<PasskeySettings onSavingChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Add passkey" }));
  fireEvent.change(screen.getByLabelText("Passkey name"), { target: { value: "My phone" } });
  return fetchMock;
}

it("offers an explicit passkey after email verification, using the same session without a second email", async () => {
  const fetchMock = await emailLogin();
  expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
  expect(webauthn.startRegistration).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Add a passkey" })).toBeInTheDocument();
  // Focus moves in a passive effect, which React flushes in a task after the commit that findByRole resolves on.
  await waitFor(() => expect(screen.getByRole("button", { name: "Create passkey" })).toHaveFocus());
  webauthn.startRegistration.mockResolvedValueOnce({ id: "new-credential" });
  fetchMock.mockResolvedValueOnce(response({ options: { challenge: "challenge" } })).mockResolvedValueOnce(response({ passkey: savedKey }));
  submit("Create passkey");
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination));
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/email/options", "/api/auth/email/request", "/api/auth/email/verify", "/api/account/passkeys", "/api/account/passkeys/verify"]);
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ label: "OpenZcash" });
  expect(webauthn.startRegistration).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
});
it.each(["Not now", "Continue without a passkey", "Escape"])("finishes the successful email session with %s", async control => {
  const fetchMock = await emailLogin();
  if (control === "Escape") fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: control }));
  expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(webauthn.startRegistration).not.toHaveBeenCalled();
});
it("does not interrupt login when the server reports an existing passkey", async () => {
  await emailLogin(false);
  expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination);
  expect(webauthn.startRegistration).not.toHaveBeenCalled();
});
it("does not offer enrollment to unsupported browsers", async () => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(false);
  await emailLogin();
  expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination);
  expect(screen.queryByRole("button", { name: "Create passkey" })).not.toBeInTheDocument();
});
it.each(["PASSKEY_EMAIL_CONFIRMATION_REQUIRED", "cancel"])("requires fresh confirmation after %s without losing email login", async failure => {
  const fetchMock = await emailLogin();
  if (failure === "cancel") {
    fetchMock.mockResolvedValueOnce(response({ options: { challenge: "challenge" } }));
    webauthn.startRegistration.mockRejectedValueOnce(new DOMException("Cancelled", "NotAllowedError"));
  } else fetchMock.mockResolvedValueOnce(response({ error: failure }, false));
  submit("Create passkey");
  expect(await screen.findByRole("alert")).toHaveTextContent(failure === "cancel" ? "Request a new confirmation code" : "Your confirmation expired. Request a new code.");
  expect(screen.queryByText("We’ll email a code to confirm this change.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send confirmation code" })).toBeEnabled();
  expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination);
});
it("blocks duplicate enrollment and closing during the device ceremony", async () => {
  const fetchMock = await emailLogin();
  let finishDevice!: (credential: object) => void;
  webauthn.startRegistration.mockImplementation(() => new Promise(resolve => { finishDevice = resolve; }));
  fetchMock.mockResolvedValueOnce(response({ options: { challenge: "challenge" } })).mockResolvedValueOnce(response({ passkey: savedKey }));
  submit("Create passkey");
  await waitFor(() => expect(webauthn.startRegistration).toHaveBeenCalledOnce());
  submit("Please wait…");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("button", { name: "Continue without a passkey" })).toBeDisabled();
  expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(4);
  await act(async () => finishDevice({ id: "new-credential" }));
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledOnce());
});
it("uses the recent server grant when adding the first passkey from profile", async () => {
  const fetchMock = await profile(true);
  webauthn.startRegistration.mockResolvedValueOnce({ id: "new-credential" });
  fetchMock.mockResolvedValueOnce(response({ options: { challenge: "challenge" } })).mockResolvedValueOnce(response({ passkey: { ...savedKey, label: "My phone" } }));
  submit("Create passkey");
  expect(await screen.findByRole("status")).toHaveTextContent("Passkey added");
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/account/passkeys", "/api/account/passkeys", "/api/account/passkeys/verify"]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ label: "My phone" });
});
it("shows a cooldown without falsely offering the earlier login code on an initial management limit", async () => {
  const fetchMock = await profile();
  fetchMock.mockResolvedValueOnce(response({ error: "EMAIL_RATE_LIMITED", retryAfter: 17 }, false));
  submit("Send confirmation code");
  expect(await screen.findByRole("button", { name: "Send code in 17s" })).toBeDisabled();
  expect(screen.queryByLabelText("Email confirmation code")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).not.toHaveTextContent("latest code");
  expect(webauthn.startRegistration).not.toHaveBeenCalled();
});
it("counts down the server wait and restores the send action", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "EMAIL_RATE_LIMITED", retryAfter: 3 }, false)));
  render(<PasskeyConfirmationForm onComplete={vi.fn()} onCancel={vi.fn()} onPendingChange={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Passkey name"), { target: { value: "Phone" } });
  await act(async () => submit("Send confirmation code"));
  expect(screen.getByRole("button", { name: "Send code in 3s" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByRole("button", { name: "Send code in 2s" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(2000); });
  expect(screen.getByRole("button", { name: "Send confirmation code" })).toBeEnabled();
});
it("keeps code entry and pending confirmation usable when resending is rate limited", async () => {
  const fetchMock = await profile();
  fetchMock.mockResolvedValueOnce(response({ retryAfter: 0 })).mockResolvedValueOnce(response({ error: "EMAIL_RATE_LIMITED", retryAfter: 21 }, false));
  submit("Send confirmation code");
  await screen.findByLabelText("Email confirmation code");
  fireEvent.click(screen.getByRole("button", { name: "Resend confirmation code" }));
  expect(await screen.findByRole("button", { name: "Resend in 21s" })).toBeDisabled();
  expect(screen.getByLabelText("Email confirmation code")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Create passkey" })).toBeEnabled();
  webauthn.startRegistration.mockResolvedValueOnce({ id: "new-credential" });
  fetchMock.mockResolvedValueOnce(response({ options: { challenge: "challenge" } })).mockResolvedValueOnce(response({ passkey: savedKey }));
  fireEvent.change(screen.getByLabelText("Email confirmation code"), { target: { value: "654321" } }); submit("Create passkey");
  expect(await screen.findByRole("status")).toHaveTextContent("Passkey added");
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ label: "My phone", code: "654321" });
});
it("keeps removal protected by a dedicated key-scoped email code despite recent sign-in", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ ...access, passkeys: [savedKey], canEnrollWithRecentEmail: true })).mockResolvedValueOnce(response({ retryAfter: 60 })).mockResolvedValueOnce(response({ removed: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<PasskeySettings onSavingChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Remove OpenZcash" })); submit("Send confirmation code");
  fireEvent.change(await screen.findByLabelText("Email confirmation code"), { target: { value: "654321" } }); submit("Remove passkey");
  expect(await screen.findByRole("status")).toHaveTextContent("Passkey removed");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: "remove", passkeyId: "key-1" });
  expect(fetchMock.mock.calls[2][0]).toBe("/api/account/passkeys/key-1");
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ code: "654321" });
  expect(webauthn.startRegistration).not.toHaveBeenCalled();
});
