"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { emailFetch, emailErrorMessage, emailRetryAfter } from "@/lib/participate/workspace/auth/email-client";
import { passkeyErrorMessage, passkeyFetch, registerPasskey, requirePasskeyBrowser, type PasskeySummary } from "@/lib/participate/workspace/auth/passkey-client";

export function PasskeyConfirmationForm({ action = "add", recentEmail = false, onboarding = false, onComplete, onCancel, onPendingChange, onRecentEmailUsed }: {
  action?: "add" | PasskeySummary;
  recentEmail?: boolean;
  onboarding?: boolean;
  onComplete: (passkey?: PasskeySummary) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  onRecentEmailUsed?: () => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(onboarding ? "OpenZcash" : "");
  const [recentProof, setRecentProof] = useState(recentEmail && action === "add");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);

  useEffect(() => { if (onboarding) primaryRef.current?.focus(); }, [onboarding]);
  useEffect(() => { if (codeSent && !pending) codeRef.current?.focus(); }, [codeSent, pending]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  function cooldown(value: number) {
    const wait = Math.max(0, value);
    setSeconds(wait); setRetryAt(Date.now() + wait * 1000);
  }
  async function requestCode() {
    if (action === "add") requirePasskeyBrowser();
    const result = await emailFetch<{ retryAfter?: number }>("/api/account/email-code", action === "add" ? { action: "add", label: label.trim() } : { action: "remove", passkeyId: action.id });
    if (codeRef.current) codeRef.current.value = "";
    setCodeSent(true); cooldown(result.retryAfter ?? 60);
  }
  async function run(resend = false) {
    if (submitting.current || (resend && seconds > 0)) return;
    submitting.current = true; setPending(true); onPendingChange(true); setError("");
    const confirming = !resend && (recentProof || codeSent);
    const code = codeRef.current?.value ?? "";
    let completed = false;
    if (confirming && codeRef.current) codeRef.current.value = "";
    try {
      if (resend || !confirming) { await requestCode(); return; }
      if (action === "add") {
        if (recentProof) onRecentEmailUsed?.();
        const result = await registerPasskey(label.trim(), recentProof ? undefined : code);
        completed = true;
        onComplete(result.passkey);
      } else {
        await passkeyFetch(`/api/account/passkeys/${encodeURIComponent(action.id)}`, { code }, "DELETE");
        completed = true;
        onComplete();
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (message === "EMAIL_RATE_LIMITED") {
        cooldown(emailRetryAfter(cause) || 60);
        setError(codeSent ? "Please wait before resending. You can still enter the passkey confirmation code already sent." : "Please wait before requesting a passkey confirmation code.");
      } else {
        const detail = message.startsWith("EMAIL_") ? emailErrorMessage(cause) : passkeyErrorMessage(cause);
        const needsNewProof = confirming && message !== "EMAIL_CODE_INVALID";
        if (needsNewProof) { setRecentProof(false); setCodeSent(false); }
        setError(message === "PASSKEY_EMAIL_CONFIRMATION_REQUIRED" ? "Your confirmation expired. Request a new code." : needsNewProof ? `${detail} Request a new confirmation code to try again.` : detail);
      }
    } finally {
      if (!completed || !onboarding) { submitting.current = false; setPending(false); onPendingChange(false); }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recentProof && !codeSent && seconds > 0) return;
    void run();
  }
  const waitingForCode = !recentProof && !codeSent;
  return <form className={`dao-passkey-form${onboarding ? " dao-passkey-onboarding" : ""}`} onSubmit={submit} aria-busy={pending}>
    {action === "add" && !onboarding ? <div className="dao-field"><label htmlFor={`${id}-label`}>Passkey name</label><input id={`${id}-label`} name="label" maxLength={60} required placeholder="My phone or laptop" autoComplete="off" disabled={pending || codeSent} value={label} onChange={event => setLabel(event.target.value)} /></div> : action !== "add" ? <p>Remove <strong>{action.label}</strong>? Email sign-in stays available.</p> : null}
    {codeSent ? <div className="dao-field"><label htmlFor={`${id}-code`}>Email confirmation code</label><input ref={codeRef} id={`${id}-code`} name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} minLength={6} required disabled={pending} /><p className="dao-field-hint">Expires in 10 minutes.</p><button type="button" className="dao-text-button" disabled={pending || seconds > 0} onClick={() => void run(true)}>{seconds > 0 ? `Resend in ${seconds}s` : "Resend confirmation code"}</button></div> : recentProof ? <p className={onboarding ? "dao-passkey-verified" : "dao-field-hint"}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>Email verified</p> : !error ? <p className="dao-field-hint">We’ll email a code to confirm this change.</p> : null}
    {error ? <p className="dao-form-error" role="alert">{error}</p> : null}
    <div className="dao-passkey-actions"><button className={onboarding ? "dao-text-button dao-passkey-skip" : "dao-button"} type="button" disabled={pending} onClick={onCancel}>{onboarding ? "Not now" : "Cancel"}</button><button ref={primaryRef} className="dao-button dao-button--primary" type="submit" disabled={pending || (waitingForCode && seconds > 0)}>{pending ? "Please wait…" : waitingForCode ? seconds > 0 ? `Send code in ${seconds}s` : "Send confirmation code" : action === "add" ? "Create passkey" : "Remove passkey"}</button></div>
    {onboarding ? <p className="dao-auth-note">Email stays available for recovery.</p> : null}
  </form>;
}
