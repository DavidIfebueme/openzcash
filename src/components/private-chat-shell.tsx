"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useThemeColor } from "./use-theme-color";
import { ChatSessionProvider, useChatSession } from "./private-chat-session";
import { ChatConfirm } from "./private-chat-confirm";
import styles from "./private-chat-shell.module.css";

type Theme = "light" | "dark";
const THEME_KEY = "oz-theme";
const homeHref =
  process.env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT === "true"
    ? "https://openzcash.org/zcg"
    : "/zcg";

/** A small shell for the chat: no app navigation, treasury or Zarvis runtime. */
export function PrivateChatShell({ children }: { children: ReactNode }) {
  return <ChatSessionProvider><ChatShellContent>{children}</ChatShellContent></ChatSessionProvider>;
}

function ChatShellContent({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [exitRequested, setExitRequested] = useState(false);
  const session = useChatSession();
  const shell = useRef<HTMLDivElement>(null);
  useThemeColor(shell, theme);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(THEME_KEY) === "dark") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme("dark");
      }
    } catch {
      /* Browser storage can be unavailable. */
    }
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => shell.current?.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
    resize();
    viewport.addEventListener("resize", resize);
    return () => viewport.removeEventListener("resize", resize);
  }, []);

  function exit(event: MouseEvent<HTMLAnchorElement>) {
    if (!session?.active || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setExitRequested(true);
  }

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* The current tab still switches theme. */
    }
  }

  return (
    <div ref={shell} className={`rd-shell ${styles.shell}`} data-theme={theme} data-chat-shell="">
      <a className={styles.skip} href="#main-content">Skip to chat</a>
      <header className={styles.header}>
        <a className={styles.brand} href={homeHref} target="_top" onClick={exit} referrerPolicy="no-referrer" aria-label="Return to OpenZcash">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/marks/openzcash.png" width="29" height="29" alt="" />
          <span>OpenZcash</span>
        </a>
        <div className={styles.actions}>
          <button type="button" className={styles.themeButton} onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {theme === "light" ? <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>}
            </svg>
          </button>
          <a className={styles.exit} href={homeHref} target="_top" onClick={exit} referrerPolicy="no-referrer" aria-label="Exit chat and clear session">Exit</a>
        </div>
      </header>
      <main id="main-content" className={styles.main}>{children}</main>
      {exitRequested && <ChatConfirm title="Leave this session?" description="Your alias, invites and messages will be cleared from this tab. You cannot restore them here." action="Leave & clear" onCancel={() => setExitRequested(false)} onConfirm={() => { (window.top ?? window).location.href = new URL(homeHref, window.location.href).href; }} />}
    </div>
  );
}
