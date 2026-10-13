"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { navigateAfterSignIn, safeAuthNext } from "@/lib/participate/workspace/auth/redirect";
import { emailErrorMessage, emailFetch } from "@/lib/participate/workspace/auth/email-client";
import { passkeyErrorMessage, signInWithPasskey, passkeyBrowserAvailable } from "@/lib/participate/workspace/auth/passkey-client";
import { useParticipateHost } from "@/components/participate/workspace/participate-bridge";

const noSubscription = () => () => {};

export function WorkspaceSignInForm({ next = "/zcg/participate", errorCode, onSuccess }: { next?: string; errorCode?: string; onSuccess?: () => void }) {
  const openHostView = useParticipateHost();
  const id = useId();
  const [options, setOptions] = useState<{ emailAvailable: boolean; demoAvailable: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const passkeyAvailable = useSyncExternalStore(noSubscription, passkeyBrowserAvailable, () => false);
  const [error, setError] = useState(errorCode ? "Sign in with a code sent to your email." : "");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const navigating = useRef(false);
  const destination = safeAuthNext(next, "/zcg/participate");
  useEffect(() => {
    let current = true;
    emailFetch<{ emailAvailable: boolean; demoAvailable: boolean }>("/api/auth/email/options")
      .then(data => { if (current) setOptions({ ...data, demoAvailable: false }); }) // The portal never proxies the shared demo persona.
      .catch(() => { if (current) setError("Sign-in options are unavailable. Reload the page to try again."); });
    return () => { current = false; };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (sent && !pending && !error) codeRef.current?.focus(); }, [sent, pending, error]);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [retryAt]);
  function finish(result: { redirectTo: string }) {
    navigateAfterSignIn(result.redirectTo, destination);
    navigating.current = true;
  }
  async function enterDemo() {
    const persona = "participant";
    const next = destination.startsWith("/zcg/participate/committee") ? "/zcg/participate" : destination;
    const result = await emailFetch<{ redirectTo: string }>("/api/auth/demo", { next, persona });
    if (openHostView) { onSuccess?.(); openHostView("proposals"); }
    else finish(result);
  }
  async function run(action: () => Promise<void>, passkey = false) {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError("");
    try { await action(); }
    catch (cause) { setError(passkey ? passkeyErrorMessage(cause) : emailErrorMessage(cause)); }
    finally { if (!navigating.current) { submitting.current = false; setPending(false); } }
  }
  async function sendCode() {
    const result = await emailFetch<{ retryAfter: number }>("/api/auth/email/request", { email: email.trim() });
    setSent(true); setSeconds(result.retryAfter); setRetryAt(Date.now() + result.retryAfter * 1000);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sent) { if (options?.emailAvailable) void run(sendCode); return; }
    const code = codeRef.current?.value ?? "";
    if (codeRef.current) codeRef.current.value = "";
    void run(async () => finish(await emailFetch("/api/auth/email/verify", { code, next: destination })));
  }
  return <form className="dao-auth-form" onSubmit={submit} aria-busy={pending}>
    {!sent ? <div className="dao-auth-field"><label htmlFor={`${id}-email`}>Email</label><input id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} spellCheck={false} required disabled={pending} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div> : <>
      <p className="dao-auth-code-destination" role="status">Code sent to <strong>{email}</strong></p>
      <div className="dao-auth-field"><label htmlFor={`${id}-code`}>Verification code</label><input ref={codeRef} id={`${id}-code`} name="code" className="dao-auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} aria-describedby={`${id}-expiry`} /><small id={`${id}-expiry`}>Valid for 10 minutes in this browser.</small></div>
    </>}
    {error ? <p ref={errorRef} className="dao-auth-error" role="alert" tabIndex={-1}>{error}</p> : null}
    <button type="submit" className="dao-auth-submit" disabled={pending || !options?.emailAvailable}>{!options ? "Loading…" : pending ? "Please wait…" : sent ? "Verify and continue" : "Continue with email"}</button>
    {sent ? <div className="dao-auth-code-actions"><button type="button" className="dao-text-button" disabled={pending || seconds > 0} onClick={() => void run(sendCode)}>{seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}</button><button type="button" className="dao-text-button" disabled={pending} onClick={() => { setSent(false); setError(""); }}>Change email</button></div> : options && !options.emailAvailable ? <p className="dao-auth-note">{options.demoAvailable ? "Email sign-in is being set up. You can explore the participant demo." : "Email sign-in is not available yet. You can still browse proposals."}</p> : options ? <p className="dao-auth-note">New here? Your first code creates your account.</p> : null}
    {options?.demoAvailable ? <><div className="dao-auth-divider"><span>Try it first</span></div><button type="button" className="dao-auth-submit dao-auth-submit--secondary" disabled={pending} onClick={() => void run(() => enterDemo())}>Participant demo</button><p className="dao-auth-note">Propose, comment and like with free demo Zcred.</p><button type="button" className="dao-text-button" disabled title="Admin access only">Committee demo</button></> : null}
    {passkeyAvailable ? <button type="button" className="dao-auth-submit dao-auth-submit--secondary" disabled={pending} onClick={() => void run(async () => finish(await signInWithPasskey(destination)), true)}>Continue with passkey</button> : null}
    <details className="dao-auth-help"><summary>Have a voting invitation?</summary><p>Open your one-time invite link to access your proposal.</p></details>
  </form>;
}

export function WorkspaceSignInButton({ next, label = "Sign in", className = "dao-sign-in" }: {
  next?: string;
  label?: string;
  className?: string;
}) {
  const [destination, setDestination] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setDestination(null), []);
  const restoreFocus = useCallback(() => trigger.current?.focus(), []);
  return <>
    <button ref={trigger} type="button" className={className} aria-haspopup="dialog" onClick={() => {
      setDestination(safeAuthNext(next ?? `${window.location.pathname}${window.location.search}${window.location.hash}`));
    }}>{label}</button>
    {destination ? <WorkspaceSignInDialog next={destination} onClose={close} restoreFocus={restoreFocus} /> : null}
  </>;
}

function WorkspaceSignInDialog({ next, onClose, restoreFocus }: {
  next: string;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; restoreFocus(); };
  }, [restoreFocus]);

  return <dialog ref={dialog} className="dao-auth-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), summary, [tabindex="0"]')).filter(element => !element.closest("[hidden]"));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <button className="dao-auth-close" type="button" aria-label="Close sign in" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    <span className="dao-zcash-mark dao-auth-mark" aria-hidden="true" />
    <h2 id={`${id}-title`}>Welcome back</h2>
    <p id={`${id}-description`} className="dao-auth-description">Use your email or a passkey you’ve already added.</p>
    <WorkspaceSignInForm next={next} onSuccess={onClose} />
  </dialog>;
}
