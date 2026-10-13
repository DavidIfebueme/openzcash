"use client";

import { emailFetch, emailErrorMessage } from "@/lib/participate/workspace/auth/email-client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { passkeyErrorMessage, passkeyFetch, registerPasskey, rememberSavedPasskey, requirePasskeyBrowser, type PasskeySummary } from "@/lib/participate/workspace/auth/passkey-client";

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
  const id = useId();
  const [keys, setKeys] = useState<PasskeySummary[]>([]);
  const [access, setAccess] = useState({ canManage: false, emailAvailable: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"add" | PasskeySummary | null>(null);
  const [label, setLabel] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const embedded = useSyncExternalStore(noLocationSubscription, () => window.self !== window.top, () => false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    passkeyFetch<{ passkeys: PasskeySummary[]; canManage: boolean; emailAvailable: boolean }>("/api/account/passkeys", undefined, "GET")
      .then(data => { if (current) { setKeys(data.passkeys); setAccess(data); setLoadError(""); } })
      .catch(cause => { if (current) setLoadError(passkeyErrorMessage(cause)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reload]);
  useEffect(() => { if (codeSent && !pending) codeRef.current?.focus(); }, [codeSent, pending]);

  function begin(next: "add" | PasskeySummary) {
    formRef.current?.reset(); setMode(next); setLabel(""); setCodeSent(false); setError(""); setNotice("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || submitting.current) return;
    submitting.current = true; setPending(true); onSavingChange(true); setError(""); setNotice("");
    const code = codeRef.current?.value ?? "";
    if (codeRef.current) codeRef.current.value = "";
    try {
      if (!codeSent) {
        if (mode === "add") requirePasskeyBrowser();
        await emailFetch("/api/account/email-code", mode === "add" ? { action: "add", label: label.trim() } : { action: "remove", passkeyId: mode.id });
        setCodeSent(true);
        return;
      }
      if (mode === "add") {
        const result = await registerPasskey(label.trim(), code);
        setKeys(current => [result.passkey, ...current]); rememberSavedPasskey(true);
        setNotice("Passkey added. You can use it next time you sign in.");
      } else {
        await passkeyFetch(`/api/account/passkeys/${encodeURIComponent(mode.id)}`, { code }, "DELETE");
        setKeys(current => current.filter(key => key.id !== mode.id));
        if (keys.length <= 1) rememberSavedPasskey(false);
        setNotice("Passkey removed.");
      }
      setMode(null); setCodeSent(false);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("EMAIL_") ? emailErrorMessage(cause) : passkeyErrorMessage(cause));
      // WebAuthn cancellation may already have consumed email confirmation.
      if (codeSent && !(cause instanceof Error && cause.message === "EMAIL_CODE_INVALID")) setCodeSent(false);
    } finally { submitting.current = false; setPending(false); onSavingChange(false); }
  }

  return <section className="dao-settings-content dao-passkeys" aria-label="Passkey settings">
    {compact ? null : <h3 className="dao-settings-section-title">Optional passkey</h3>}
    <p className="dao-settings-description">Sign in with your fingerprint, face or device PIN. Verify your email once to add a passkey; email stays available for account recovery.</p>
    {loading ? <p role="status">Loading passkeys…</p> : loadError ? <><p className="dao-form-error" role="alert">{loadError}</p><PasskeyLocalhostLink /><button type="button" className="dao-button" onClick={() => { setLoading(true); setReload(value => value + 1); }}>Try again</button></> : !access.canManage ? <p className="dao-settings-privacy-note">Passkeys are off for the demo profile. Add one later in your own verified account.</p> : <>
      <ul className="dao-passkey-list">{keys.map(key => <li key={key.id}><PasskeyIcon /><div><strong>{key.label}</strong><small>{key.lastUsedAt ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}` : "Ready to use"}</small></div><button type="button" className="dao-text-button" disabled={pending || !access.emailAvailable} aria-label={`Remove ${key.label}`} onClick={() => begin(key)}>Remove</button></li>)}</ul>
      {!keys.length && !mode ? <p className="dao-passkey-empty">No passkeys yet.</p> : null}
      {!access.emailAvailable ? <p className="dao-settings-privacy-note">Passkey setup will be available when email delivery is connected.</p> : embedded ? <p className="dao-settings-privacy-note">Passkey setup is not available in this embedded pilot.</p> : !mode ? <button type="button" className="dao-button dao-button--primary" onClick={() => begin("add")} disabled={keys.length >= 10}><PasskeyIcon />Add passkey</button> : <form ref={formRef} className="dao-passkey-form" onSubmit={submit} aria-busy={pending}>
        {mode === "add" ? <div className="dao-field"><label htmlFor={`${id}-label`}>Passkey name</label><input id={`${id}-label`} name="label" maxLength={60} required placeholder="My phone or laptop" autoComplete="off" disabled={pending || codeSent} value={label} onChange={event => setLabel(event.target.value)} /></div> : <p>Remove <strong>{mode.label}</strong>? Email sign-in stays available.</p>}
        {codeSent ? <div className="dao-field"><label htmlFor={`${id}-code`}>Email confirmation code</label><input ref={codeRef} id={`${id}-code`} name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} minLength={6} required disabled={pending} /><p className="dao-field-hint">Sent to your verified email. Valid for 10 minutes.</p><button type="button" className="dao-text-button" disabled={pending} onClick={() => setCodeSent(false)}>Request another code</button></div> : <p className="dao-field-hint">We’ll email a code to confirm this change.</p>}
        {error ? <><p className="dao-form-error" role="alert">{error}</p><PasskeyLocalhostLink /></> : null}
        <div className="dao-passkey-actions"><button className="dao-button" type="button" disabled={pending} onClick={() => { setMode(null); setCodeSent(false); setError(""); }}>Cancel</button><button className="dao-button dao-button--primary" type="submit" disabled={pending}>{pending ? "Please wait…" : !codeSent ? "Send confirmation code" : mode === "add" ? "Create passkey" : "Remove passkey"}</button></div>
      </form>}
      {notice ? <p className="dao-passkey-notice" role="status">{notice}</p> : null}
      <p className="dao-settings-privacy-note">Your device keeps your fingerprint, face and PIN private.</p>
    </>}
  </section>;
}
