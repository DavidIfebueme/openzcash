import { emailErrorMessage } from "@/lib/participate/workspace/auth/email-client";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

const messages: Record<string, string> = {
  PASSKEY_UNSUPPORTED: "This browser does not support passkeys. Use email sign-in or a supported browser.",
  PASSKEY_LOCALHOST: "Open this preview on localhost to use passkeys.",
  PASSKEY_UNAVAILABLE: "Passkeys are temporarily unavailable. You can still sign in by email.",
  PASSKEY_EXPIRED: "This request expired. Please try again.",
  PASSKEY_INVALID: "This passkey could not be verified. Try again or sign in by email.",
  PASSKEY_EXISTS: "This passkey is already registered. Choose another device or key.",
  PASSKEY_LIMIT: "You can keep up to 10 passkeys. Remove one before adding another.",
  PASSKEY_NOT_FOUND: "This passkey is no longer available. Reload your settings.",
  PASSKEY_RATE_LIMITED: "Too many attempts. Please wait before trying again.",
  PASSKEY_ACCOUNT_REQUIRED: "Sign in to your account to manage passkeys.",
  PASSKEY_EMBEDDED: "Passkeys are not available in this embedded pilot. You can still sign in by email.",
  forbidden_origin: "Open the original site address and try again.",
  unauthorized: "Sign in again to manage passkeys."
};

export function passkeyErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const cause = "cause" in error ? error.cause : null;
    const name = cause && typeof cause === "object" && "name" in cause ? cause.name : "name" in error ? error.name : "";
    if (name === "NotAllowedError" || name === "AbortError") return "Passkey request cancelled or unavailable. You can try again.";
    if (name === "InvalidStateError") return messages.PASSKEY_EXISTS;
    if ("message" in error && typeof error.message === "string" && messages[error.message]) return messages[error.message];
  }
  if (error instanceof Error && error.message.startsWith("EMAIL_")) return emailErrorMessage(error);
  return "Could not complete the passkey request. Check your connection and try again.";
}

export function requirePasskeyBrowser() {
  if (window.self !== window.top) throw new Error("PASSKEY_EMBEDDED");
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "[::1]") throw new Error("PASSKEY_LOCALHOST");
  if (!window.isSecureContext || !browserSupportsWebAuthn()) throw new Error("PASSKEY_UNSUPPORTED");
}

// A synced key may exist even when this browser has never visited the site.
export function passkeyBrowserAvailable() {
  try { requirePasskeyBrowser(); return true; }
  catch { return false; }
}

export async function passkeyFetch<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, {
    method, credentials: "same-origin", cache: "no-store",
    ...(method !== "GET" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) } : {})
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "PASSKEY_UNAVAILABLE");
  return result as T;
}

export async function signInWithPasskey(next: string) {
  requirePasskeyBrowser();
  const { options } = await passkeyFetch<{ options: PublicKeyCredentialRequestOptionsJSON }>("/api/auth/passkeys/options");
  const credential = await startAuthentication({ optionsJSON: options });
  return passkeyFetch<{ redirectTo: string }>("/api/auth/passkeys/verify", { credential, next });
}

export type PasskeySummary = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

export async function registerPasskey(label: string, code: string) {
  requirePasskeyBrowser();
  const { options } = await passkeyFetch<{ options: PublicKeyCredentialCreationOptionsJSON }>("/api/account/passkeys", { label, code });
  const credential = await startRegistration({ optionsJSON: options });
  return passkeyFetch<{ passkey: PasskeySummary }>("/api/account/passkeys/verify", credential);
}

// A convenience hint, never an authorization decision. The server verifies every key.
export function hasSavedPasskey() { try { return localStorage.getItem("participate:passkey") === "1"; } catch { return false; } }
export function rememberSavedPasskey(enabled: boolean) { try { if (enabled) localStorage.setItem("participate:passkey", "1"); else localStorage.removeItem("participate:passkey"); } catch {} }
