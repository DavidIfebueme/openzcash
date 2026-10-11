"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isParticipationReadyMessage, participationViewMessage, participationThemeMessage, participationWorkspaceUrl, type ParticipationView } from "@/lib/participate/config";
import styles from "./participate.module.css";

const INTRO_KEY = "openzcash-participate-intro-v1";

export function Participate({ service, view = "proposals", children }: {
  service: { url: string } | null;
  view?: ParticipationView;
  children?: ReactNode;
}) {
  const router = useRouter();
  const history = view === "history";
  const directEntry = view !== "proposals";
  const [entered, setEntered] = useState(directEntry);
  const [intro, setIntro] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const about = useRef<HTMLButtonElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const workspaceTheme = useRef<"light" | "dark" | null>(null);
  const workspaceOpen = Boolean(service);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === "entered"; } catch { /* Fall back to the current tab. */ }
    try { seen ||= sessionStorage.getItem(INTRO_KEY) === "entered"; } catch { /* Entry remains usable without browser storage. */ }
    // Show the single introduction on a first visit, over the actual workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntered(seen || directEntry);
    setIntro(!seen && !directEntry);
  }, [directEntry]);

  useEffect(() => {
    const element = dialog.current;
    if (intro && !element?.open) element?.showModal();
    if (!intro && element?.open) element.close();
    return () => { if (element?.open) element.close(); };
  }, [intro]);

  useEffect(() => {
    if (!service) return;
    const origin = window.location.origin;
    const sendTheme = (hostChanged = false) => {
      const theme = page.current?.closest(".rd-shell")?.getAttribute("data-theme") === "dark" ? "dark" : "light";
      if (hostChanged || !workspaceTheme.current) workspaceTheme.current = theme;
      frame.current?.contentWindow?.postMessage({ type: "participate:theme", version: 1, theme: workspaceTheme.current }, origin);
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (isParticipationReadyMessage(event.data)) { setReady(true); setSlow(false); sendTheme(); return; }
      const theme = participationThemeMessage(event.data);
      if (theme) { workspaceTheme.current = theme; return; }
      const destination = participationViewMessage(event.data);
      if (destination === "about") { setIntro(true); return; }
      if (!destination) return;
      // Returning from an editor may target the host's current view.
      if (destination === view) { setReady(false); setSlow(false); setAttempt(value => value + 1); }
      else router.push(destination === "proposals" ? "/zcg/participate" : `/zcg/participate?view=${destination}`, { scroll: false });
    };
    window.addEventListener("message", receive);
    const observer = new MutationObserver(() => sendTheme(true));
    const shell = page.current?.closest(".rd-shell");
    if (shell) observer.observe(shell, { attributes: true, attributeFilter: ["data-theme"] });
    const timer = window.setTimeout(() => setSlow(true), 15000);
    return () => { window.removeEventListener("message", receive); observer.disconnect(); window.clearTimeout(timer); };
  }, [view, service, attempt, router]);

  function enter() {
    try { localStorage.setItem(INTRO_KEY, "entered"); } catch { /* Fall back to the current tab. */ }
    try { sessionStorage.setItem(INTRO_KEY, "entered"); } catch { /* A later visit can show the introduction again. */ }
    setEntered(true); setIntro(false);
  }

  return <div ref={page} className={styles.page}>
    <h1 className={styles.srOnly}>Participate</h1>
    {!workspaceOpen ? <header className={styles.header}>
      <nav className={styles.tabs} aria-label="Participation views">
        <Link href="/zcg/participate" aria-current={!history ? "page" : undefined}>Proposals</Link>
        <Link href="/zcg/participate?view=history" aria-current={history ? "page" : undefined}>Decision history</Link>
      </nav>
      <button type="button" ref={about} className={styles.about} onClick={() => setIntro(true)}>About the pilot</button>
    </header> : null}
    {service ? <section className={styles.workspace} aria-label="Participation workspace">
      {!ready ? <div className={styles.workspaceBar} role="status"><span><i />Opening workspace…</span></div> : null}
      {slow && !ready ? <div className={styles.connection} role="status"><p>The participation service has not responded yet.</p><button type="button" onClick={() => { setReady(false); setSlow(false); setAttempt(value => value + 1); }}>Try again</button></div> : null}
      <iframe key={`${view}-${attempt}`} ref={frame} title="ZCG proposals, comments and credits" src={participationWorkspaceUrl(service.url, view)} className={styles.frame} referrerPolicy="strict-origin-when-cross-origin" />
      <p className={styles.footnote}>An OpenZcash pilot. Official ZCG submissions and committee decisions follow the existing ZCG process.</p>
    </section> : history ? <section className={styles.history} aria-label="ZCG decision history">{children}</section> : <section className={styles.connection}>
      <p>The interactive workspace is being prepared. Decision history is available now.</p>
      <Link href="/zcg/participate?view=history" className={styles.primary}>View decision history →</Link>
    </section>}
    <dialog ref={dialog} className={styles.intro} aria-labelledby="participate-intro-title" onCancel={event => { event.preventDefault(); enter(); }} onClose={() => { setIntro(false); (about.current ?? frame.current)?.focus({ preventScroll: true }); }}>
      <div className={styles.introHero}>
        <Image src="/participate/participation-records.png" alt="" fill sizes="(max-width: 800px) 100vw, 780px" priority className={styles.heroImage} />
        <button className={styles.close} type="button" aria-label="Close pilot introduction" onClick={enter}>×</button>
        <div className={styles.heroCopy}><span className={styles.goldLabel}>{entered ? "About the pilot" : "OpenZcash · ZCG pilot"}</span><h2 id="participate-intro-title">Participation,<br />with a record.</h2><p>Explore proposals. Join the conversation.</p></div>
      </div>
      <div className={styles.introBody}>
        <a className={styles.proofLink} href="https://mainnet.zcashexplorer.app/transactions/1bb7383043cab4d72b7129b5e5bdc7441ac7c073af59679bb91403216b795bf1" target="_blank" rel="noopener noreferrer">
          <span className={styles.proofSummary}><i aria-hidden="true" /><span><strong>25 proposals anchored</strong><span>Zcash mainnet</span></span></span>
          <span className={styles.proofAction}>View proof <span aria-hidden="true">↗</span></span>
        </a>
        <footer className={styles.introFooter}>
          <div><strong>25 free demo Zcred</strong><span>No payment required.</span></div>
          {service ? <button type="button" className={styles.primary} onClick={enter}>{entered ? "Back to workspace" : "Enter the pilot"} <span aria-hidden="true">→</span></button> : <Link href="/zcg/participate?view=history" className={styles.primary} onClick={enter}>View decision history →</Link>}
        </footer>
        <details className={styles.pilotDetails}>
          <summary>How it works <span aria-hidden="true">+</span></summary>
          <dl>
            <div><dt>Participate</dt><dd>Sign in with an email code. Use free demo Zcred to comment, like or publish a public test proposal for 20 Zcred.</dd></div>
            <div><dt>Verify</dt><dd>Open Read &amp; verify to download preserved files and available receipts. Test proposals stay in the demo; eligible applications from the official ZCG GitHub source receive separate Zcash anchors.</dd></div>
            <div><dt>Next</dt><dd>Starting with ZCG, with a vision for Coinholders, DAOs and sub-DAOs.</dd></div>
          </dl>
        </details>
        <p className={styles.disclosure}>Independent pilot · Not an official ZCG application channel.</p>
      </div>
    </dialog>
  </div>;
}
