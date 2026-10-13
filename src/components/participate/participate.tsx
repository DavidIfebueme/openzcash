"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PARTICIPATE_ABOUT_EVENT } from "@/components/participate/workspace/participate-bridge";
import { PARTICIPATE_PATH } from "@/lib/participate/config";
import styles from "./participate.module.css";

const INTRO_KEY = "openzcash-participate-intro-v1";

/**
 * The portal's frame around the native workspace: the first-visit
 * introduction, the "About Participate" entry and the pilot footnote. Without a
 * configured service the frame keeps its own tabs and the public history.
 */
export function Participate({
  view,
  configured,
  children,
}: {
  view: "proposals" | "history" | "committee";
  configured: boolean;
  children?: ReactNode;
}) {
  const [entered, setEntered] = useState(false);
  const [intro, setIntro] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const about = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(INTRO_KEY) === "entered";
    } catch {
      /* Fall back to the current tab. */
    }
    try {
      seen ||= sessionStorage.getItem(INTRO_KEY) === "entered";
    } catch {
      /* Entry remains usable without browser storage. */
    }
    // Show the single introduction on a first visit, over the actual workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntered(seen);
    setIntro(!seen && view === "proposals" && configured);
  }, [view, configured]);

  useEffect(() => {
    const element = dialog.current;
    if (intro && !element?.open) element?.showModal();
    if (!intro && element?.open) element.close();
    return () => {
      if (element?.open) element.close();
    };
  }, [intro]);

  useEffect(() => {
    const open = () => {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setIntro(true);
    };
    window.addEventListener(PARTICIPATE_ABOUT_EVENT, open);
    return () => window.removeEventListener(PARTICIPATE_ABOUT_EVENT, open);
  }, []);

  function enter() {
    try {
      localStorage.setItem(INTRO_KEY, "entered");
    } catch {
      /* Fall back to the current tab. */
    }
    try {
      sessionStorage.setItem(INTRO_KEY, "entered");
    } catch {
      /* A later visit can show the introduction again. */
    }
    setEntered(true);
    setIntro(false);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Participate</h1>
      <div className={configured ? undefined : styles.inset}>
      {!configured ? (
        <header className={styles.header}>
          <nav className={styles.tabs} aria-label="Participation views">
            <Link
              href={PARTICIPATE_PATH}
              aria-current={view === "proposals" ? "page" : undefined}
            >
              Proposals
            </Link>
            <Link
              href={`${PARTICIPATE_PATH}?view=history`}
              aria-current={view === "history" ? "page" : undefined}
            >
              Decision history
            </Link>
          </nav>
          <button
            type="button"
            ref={about}
            className={styles.about}
            onClick={() => setIntro(true)}
          >
            About Participate
          </button>
        </header>
      ) : null}
      {children}
      </div>
      <p className={styles.footnote}>
        Community participation on OpenZcash. Official ZCG submissions and committee decisions
        follow the existing ZCG process.
      </p>
      <dialog
        ref={dialog}
        className={styles.intro}
        aria-labelledby="participate-intro-title"
        onCancel={(event) => {
          event.preventDefault();
          enter();
        }}
        onClose={() => {
          setIntro(false);
          (opener.current?.isConnected ? opener.current : about.current)?.focus(
            { preventScroll: true },
          );
          opener.current = null;
        }}
      >
        <div className={styles.introHero}>
          <Image
            src="/participate/participation-records.png"
            alt=""
            fill
            sizes="(max-width: 800px) 100vw, 780px"
            priority
            className={styles.heroImage}
          />
          <button
            className={styles.close}
            type="button"
            aria-label="Close Participate introduction"
            onClick={enter}
          >
            ×
          </button>
          <div className={styles.heroCopy}>
            <span className={styles.goldLabel}>
              {entered ? "About Participate" : "OpenZcash · Participate"}
            </span>
            <h2 id="participate-intro-title">
              Participation,
              <br />
              with a record.
            </h2>
            <p>Explore proposals. Join the conversation.</p>
          </div>
        </div>
        <div className={styles.introBody}>
          <a
            className={styles.proofLink}
            href="https://mainnet.zcashexplorer.app/transactions/1bb7383043cab4d72b7129b5e5bdc7441ac7c073af59679bb91403216b795bf1"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.proofSummary}>
              <i aria-hidden="true" />
              <span>
                <strong>25 proposals anchored</strong>
                <span>Zcash mainnet</span>
              </span>
            </span>
            <span className={styles.proofAction}>
              View proof <span aria-hidden="true">↗</span>
            </span>
          </a>
          <footer className={styles.introFooter}>
            <div>
              <strong>25 free demo Zcred</strong>
              <span>No payment required.</span>
            </div>
            {configured ? (
              <button type="button" className={styles.primary} onClick={enter}>
                {entered ? "Back to workspace" : "Enter Participate"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link
                href={`${PARTICIPATE_PATH}?view=history`}
                className={styles.primary}
                onClick={enter}
              >
                View decision history →
              </Link>
            )}
          </footer>
          <details className={styles.pilotDetails}>
            <summary>
              How it works <span aria-hidden="true">+</span>
            </summary>
            <dl>
              <div>
                <dt>Participate</dt>
                <dd>
                  Sign in with an email code. Use free demo Zcred to comment,
                  like or publish a community proposal for 20 Zcred.
                </dd>
              </div>
              <div>
                <dt>Verify</dt>
                <dd>
                  Open Read &amp; verify to download preserved files and
                  available receipts. Community proposals are published on OpenZcash;
                  eligible applications from the official ZCG GitHub source
                  are automatically anchored on Zcash.
                </dd>
              </div>
              <div>
                <dt>Next</dt>
                <dd>
                  Starting with ZCG, with a vision for Coinholders, DAOs and
                  sub-DAOs.
                </dd>
              </div>
            </dl>
          </details>
          <p className={styles.disclosure}>
            Community proposals and discussions · Free demo Zcred.
          </p>
        </div>
      </dialog>
    </div>
  );
}
