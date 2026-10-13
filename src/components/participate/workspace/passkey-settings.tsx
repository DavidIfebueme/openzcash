"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { passkeyErrorMessage, passkeyFetch, rememberSavedPasskey, type PasskeySummary } from "@/lib/participate/workspace/auth/passkey-client";

import { PasskeyConfirmationForm } from "./passkey-confirmation-form";

export function PasskeyIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="7" r="3" /><path d="M3 20v-2a5 5 0 0 1 10 0" /><circle cx="18" cy="12" r="3" /><path d="M18 15v6m0-3h2" /></svg>;
}

const noLocationSubscription = () => () => {};
function localhostPreviewUrl() {
  if (!["127.0.0.1", "[::1]"].includes(window.location.hostname)) return null;
  const url = new URL(window.location.href); url.hostname = "localhost"; return url.href;
}

export function PasskeyLocalhostLink() {
  const href = useSyncExternalStore(noLocationSubscription, localhostPreviewUrl, () => null);
  return href ? <a className="dao-passkey-localhost" href={href}>Open on localhost →</a> : null;
}

export function PasskeySettings({ onSavingChange, compact = false }: { onSavingChange: (saving: boolean) => void; compact?: boolean }) {
  const [keys, setKeys] = useState<PasskeySummary[]>([]);
  const [access, setAccess] = useState({ canManage: false, emailAvailable: false, canEnrollWithRecentEmail: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"add" | PasskeySummary | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const embedded = useSyncExternalStore(noLocationSubscription, () => window.self !== window.top, () => false);

  useEffect(() => {
    let current = true;
    passkeyFetch<{ passkeys: PasskeySummary[]; canManage: boolean; emailAvailable: boolean; canEnrollWithRecentEmail?: boolean }>("/api/account/passkeys", undefined, "GET")
      .then(data => { if (current) { setKeys(data.passkeys); setAccess({ ...data, canEnrollWithRecentEmail: data.canEnrollWithRecentEmail === true }); setLoadError(""); } })
      .catch(cause => { if (current) setLoadError(passkeyErrorMessage(cause)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reload]);
  function begin(next: "add" | PasskeySummary) { setMode(next); setNotice(""); }
  function complete(passkey?: PasskeySummary) {
    if (passkey) {
      setKeys(current => [passkey, ...current]); rememberSavedPasskey(true);
      setNotice("Passkey added. You can use it next time you sign in.");
    } else if (mode && mode !== "add") {
      setKeys(current => current.filter(key => key.id !== mode.id));
      if (keys.length <= 1) rememberSavedPasskey(false);
      setNotice("Passkey removed.");
    }
    setAccess(current => ({ ...current, canEnrollWithRecentEmail: false })); setMode(null);
  }

  return <section className="dao-settings-content dao-passkeys" aria-label="Passkey settings">
    {compact ? null : <h3 className="dao-settings-section-title">Optional passkey</h3>}
    <p className="dao-settings-description">Use your device to sign in. Keep email as a backup.</p>
    {loading ? <p role="status">Loading passkeys…</p> : loadError ? <><p className="dao-form-error" role="alert">{loadError}</p><PasskeyLocalhostLink /><button type="button" className="dao-button" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Try again</button></> : !access.canManage ? <p className="dao-settings-privacy-note">Passkeys are off for the demo profile. Add one later in your own verified account.</p> : <>
      <ul className="dao-passkey-list">{keys.map(key => <li key={key.id}><PasskeyIcon /><div><strong>{key.label}</strong><small>{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}` : "Ready to use"}</small></div><button type="button" className="dao-text-button" disabled={pending || !access.emailAvailable} aria-label={`Remove ${key.label}`} onClick={() => begin(key)}>Remove</button></li>)}</ul>
      {!keys.length && !mode ? <p className="dao-passkey-empty">No passkeys yet.</p> : null}
      {!access.emailAvailable ? <p className="dao-settings-privacy-note">Passkey setup will be available when email delivery is connected.</p> : embedded ? <p className="dao-settings-privacy-note">Passkey setup is not available in this embedded pilot.</p> : !mode ? <button type="button" className="dao-button dao-button--primary" onClick={() => begin("add")} disabled={keys.length >= 10}><PasskeyIcon />Add passkey</button> : <PasskeyConfirmationForm key={typeof mode === "string" ? mode : mode.id} action={mode} recentEmail={access.canEnrollWithRecentEmail} onComplete={complete} onCancel={() => setMode(null)} onRecentEmailUsed={() => setAccess(current => ({ ...current, canEnrollWithRecentEmail: false }))} onPendingChange={value => { setPending(value); onSavingChange(value); }} />}
      {mode ? <PasskeyLocalhostLink /> : null}
      {notice ? <p className="dao-passkey-notice" role="status">{notice}</p> : null}
      <p className="dao-settings-privacy-note">Your biometric data stays on your device.</p>
    </>}
  </section>;
}
