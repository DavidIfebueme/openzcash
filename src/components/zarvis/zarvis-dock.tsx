"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ZarvisChat } from "./zarvis-chat";
import { ZarvisMark } from "./zarvis-mark";

export function ZarvisDock() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  // Keep the launcher above the treasury bar at every responsive size.
  useEffect(() => {
    const footer = document.querySelector(".rd-treasury-bar");
    if (!footer) return;
    const update = () => launcher.current?.style.setProperty("--zarvis-footer-height", `${footer.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update); observer.observe(footer); update();
    return () => observer.disconnect();
  }, [pathname]);
  if (pathname === "/zarvis" || /^\/(login|onboarding|invites|projects|viewing-keys)(\/|$)/.test(pathname)) return null;
  return <><button ref={launcher} type="button" className="zarvis-launcher" aria-label="Ask Zarvis" aria-haspopup="dialog" onClick={() => { setOpened(true); dialog.current?.showModal(); }}><ZarvisMark/><span>Ask Zarvis</span></button>
    <dialog className="zarvis-dock" ref={dialog} aria-label="Zarvis, your Zcash guide" onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
      <header className="zarvis-dock-heading"><div><ZarvisMark/><span><strong>Zarvis</strong><small>Your Zcash guide</small></span></div><nav aria-label="Chat controls"><Link href="/zarvis" onClick={() => dialog.current?.close()} aria-label="Open full Zarvis page">↗</Link><button type="button" aria-label="Close Zarvis" onClick={() => dialog.current?.close()}>×</button></nav></header>
      {opened ? <ZarvisChat compact/> : null}
    </dialog>
  </>;
}
