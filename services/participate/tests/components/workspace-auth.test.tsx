import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { WorkspaceSignInButton } from "@/components/workspace-auth";
const navigation = vi.hoisted(() => ({ navigateAfterSignIn: vi.fn() }));
vi.mock("@/lib/auth/redirect", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/auth/redirect")>(),
  navigateAfterSignIn: navigation.navigateAfterSignIn
}));
const webauthn = vi.hoisted(() => ({ browserSupportsWebAuthn: vi.fn(), startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock("@simplewebauthn/browser", () => webauthn);
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
const available = { emailAvailable: true, demoAvailable: true };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal("isSecureContext", true);
  webauthn.browserSupportsWebAuthn.mockReturnValue(false);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });
async function open(next?: string) {
  render(<WorkspaceSignInButton next={next} />);
  const trigger = screen.getByRole("button", { name: "Sign in" }); fireEvent.click(trigger);
  await screen.findByRole("button", { name: "Participant demo" });
  return { trigger, dialog: screen.getByRole("dialog") };
}
function send() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "member@example.test" } });
  fireEvent.submit(screen.getByRole("button", { name: "Continue with email" }).closest("form")!);
}
function verify() {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.submit(screen.getByRole("button", { name: "Verify and continue" }).closest("form")!);
}
it("offers passkey sign-in on supported browsers without saved site storage or starting a ceremony", async () => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
  const fetchMock = vi.fn().mockResolvedValue(response(available)); vi.stubGlobal("fetch", fetchMock);
  await open();
  expect(screen.getByLabelText("Email")).toHaveFocus();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeEnabled();
  expect(screen.getByText("Use your email or a saved passkey.")).toBeInTheDocument();
  expect(localStorage.getItem).not.toHaveBeenCalled();
  expect(webauthn.startAuthentication).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledOnce(); expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/email/options");
});
it("keeps email sign-in available and hides passkeys when WebAuthn is unsupported", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(available)));
  await open();
  expect(screen.queryByRole("button", { name: "Continue with passkey" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  expect(webauthn.startAuthentication).not.toHaveBeenCalled();
});
it("starts passkey authentication only on click and preserves the proposal route after verification", async () => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
  const destination = "/participate?record=zcg-github-479#comments";
  const options = { challenge: "challenge", rpId: "localhost" };
  const credential = { id: "saved-key", response: { signature: "signed" } };
  webauthn.startAuthentication.mockResolvedValueOnce(credential);
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available))
    .mockResolvedValueOnce(response({ options })).mockResolvedValueOnce(response({ redirectTo: destination }));
  vi.stubGlobal("fetch", fetchMock); await open(destination);
  expect(webauthn.startAuthentication).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with passkey" }));
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination));
  expect(webauthn.startAuthentication).toHaveBeenCalledWith({ optionsJSON: options });
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/email/options", "/api/auth/passkeys/options", "/api/auth/passkeys/verify"]);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ credential, next: destination });
  expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeDisabled();
});
it("keeps email usable after a cancelled passkey request without verifying or navigating", async () => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
  webauthn.startAuthentication.mockRejectedValueOnce(new DOMException("User cancelled", "NotAllowedError"));
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available))
    .mockResolvedValueOnce(response({ options: { challenge: "challenge" } }))
    .mockResolvedValueOnce(response({ sent: true, retryAfter: 60 }));
  vi.stubGlobal("fetch", fetchMock); await open();
  fireEvent.click(screen.getByRole("button", { name: "Continue with passkey" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Passkey request cancelled or unavailable");
  expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Continue with email" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeEnabled();
  send(); await screen.findByLabelText("Verification code");
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/email/options", "/api/auth/passkeys/options", "/api/auth/email/request"]);
});
it("authenticates with an existing passkey when email delivery is unavailable", async () => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
  webauthn.startAuthentication.mockResolvedValueOnce({ id: "saved-key" });
  const destination = "/participate?record=zcg-github-479";
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ emailAvailable: false, demoAvailable: true }))
    .mockResolvedValueOnce(response({ options: { challenge: "challenge" } }))
    .mockResolvedValueOnce(response({ redirectTo: destination }));
  vi.stubGlobal("fetch", fetchMock); await open(destination);
  expect(screen.getByRole("button", { name: "Continue with email" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with passkey" }));
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination));
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/email/options", "/api/auth/passkeys/options", "/api/auth/passkeys/verify"]);
});
it("requests a code, verifies it, and preserves the current proposal route", async () => {
  const destination = "/participate?view=discussion#comments"; window.history.replaceState({}, "", destination);
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available)).mockResolvedValueOnce(response({ sent: true, retryAfter: 60 })).mockResolvedValueOnce(response({ redirectTo: destination }));
  vi.stubGlobal("fetch", fetchMock); await open(); send();
  // Focus moves in a passive effect, which React flushes in a task after the commit that findBy resolves on.
  await screen.findByLabelText("Verification code"); await waitFor(() => expect(screen.getByLabelText("Verification code")).toHaveFocus());
  expect(screen.getByRole("status")).toHaveTextContent("member@example.test");
  expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  verify(); await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith(destination, destination));
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/auth/email/options", "/api/auth/email/request", "/api/auth/email/verify"]);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ code: "123456", next: destination });
  expect(screen.getByRole("button", { name: "Please wait…" })).toBeDisabled();
});
it("shows errors inline and never creates a fake successful sign-in", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available)).mockResolvedValueOnce(response({ retryAfter: 60 })).mockResolvedValueOnce(response({ error: "EMAIL_CODE_INVALID" }, false));
  vi.stubGlobal("fetch", fetchMock); await open(); send(); await screen.findByLabelText("Verification code"); verify();
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired");
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus()); expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Verification code")).toHaveValue("");
});
it("keeps the demo available when email delivery is unconfigured", async () => {
  window.history.replaceState({}, "", "/participate");
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ emailAvailable: false, demoAvailable: true })).mockResolvedValueOnce(response({ redirectTo: "/participate" }));
  vi.stubGlobal("fetch", fetchMock); await open();
  expect(screen.getByRole("button", { name: "Continue with email" })).toBeDisabled();
  expect(screen.getByText(/Email sign-in is being set up/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Participant demo" }));
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith("/participate", "/participate"));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/demo");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).persona).toBe("participant");
});
it("prevents duplicate submissions while waiting", async () => {
  let complete!: (value: unknown) => void;
  const fetchMock = vi.fn().mockResolvedValueOnce(response(available)).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  vi.stubGlobal("fetch", fetchMock); await open(); send();
  const form = screen.getByRole("button", { name: "Please wait…" }).closest("form")!;
  fireEvent.submit(form); expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => complete(response({ error: "EMAIL_DELIVERY_FAILED" }, false)));
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t send your code");
  expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
});
it("keeps the committee demo disabled without a request or navigation", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(available));
  vi.stubGlobal("fetch", fetchMock); await open();
  const button = screen.getByRole("button", { name: "Committee demo" });
  expect(button).toBeDisabled(); fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledOnce(); expect(navigation.navigateAfterSignIn).not.toHaveBeenCalled();
});
it("traps dialog focus and restores the trigger on Escape", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(available)));
  const { trigger, dialog } = await open();
  const first = within(dialog).getByRole("button", { name: "Close sign in" });
  const last = within(dialog).getByText("Voting invitation");
  last.focus(); fireEvent.keyDown(last, { key: "Tab" }); expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true }); expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Escape" }); expect(trigger).toHaveFocus();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("ignores unsafe returned navigation targets", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(available)).mockResolvedValueOnce(response({ redirectTo: "//evil.example" })));
  await open("/participate#comments"); fireEvent.click(screen.getByRole("button", { name: "Participant demo" }));
  await waitFor(() => expect(navigation.navigateAfterSignIn).toHaveBeenCalledWith("//evil.example", "/participate#comments"));
});
