"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { transactionExplorers } from "@/lib/network/explorers";
import { treasuryCopy } from "@/lib/openzcash-treasury/content";
import styles from "./treasury.module.css";

/**
 * A transaction id that opens a menu of block explorers, so the reader chooses
 * where to look the transaction up. The choices are the explorers of the
 * Zcash Network page.
 */
export function TransactionLink({ txid }: { txid: string }) {
  const t = treasuryCopy;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();
  const explorers = transactionExplorers(txid);
  const short = `${txid.slice(0, 6)}…${txid.slice(-4)}`;

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (explorers.length === 0) {
    return (
      <span className={styles.txLink}>
        <code title={txid}>{short}</code>
      </span>
    );
  }

  function focusItem(index: number) {
    const count = explorers.length;
    items.current[(index + count) % count]?.focus({ preventScroll: true });
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = items.current.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusItem(event.key === "Home" ? 0 : explorers.length - 1);
    }
  }

  return (
    <span className={styles.txLink} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={styles.txTrigger}
        title={txid}
        aria-label={`${t.viewTransaction} ${short} ${t.inExplorer}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <code>{short}</code>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t.chooseExplorer}
          className={styles.txMenu}
          onKeyDown={onMenuKeyDown}
        >
          {explorers.map((explorer, index) => (
            <a
              key={explorer.id}
              ref={(element) => {
                items.current[index] = element;
              }}
              role="menuitem"
              href={explorer.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${explorer.name}, ${explorer.domain}, ${t.opensInNewTab}`}
              title={explorer.domain}
              onClick={() => setOpen(false)}
            >
              <Image src={explorer.logo} alt="" width={18} height={18} />
              <span>{explorer.name}</span>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 3h7v7M13 3 4 12" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </span>
  );
}
