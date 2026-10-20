"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppMark, GLYPH, Glyph, PageMark } from "./app-marks";
import { ZarvisMark } from "./zarvis/zarvis-mark";
import { useZarvisOptional } from "./zarvis/zarvis-provider";
import type { AppDef } from "@/lib/design-routes";
import {
  buildPalette,
  paletteRows,
  stepActive,
  type PaletteRow,
  type PaletteStep,
} from "@/lib/palette";
import type { searchNarratives as NarrativeSearch } from "@/lib/narratives/search";
import styles from "./command-palette.module.css";

const STEP_KEYS: readonly string[] = ["ArrowDown", "ArrowUp", "Home", "End"];
const PLACEHOLDER = "Search pages, grants, apps…";
/** Read by the scroll lock in the stylesheet. */
const GUTTER_VAR = "--palette-gutter";

function RowMark({ row }: { row: PaletteRow }) {
  if (row.ask) return <ZarvisMark className="rd-side-icon" />;
  if (row.app) return <AppMark app={row.app} size={16} />;
  return <PageMark mark={row.mark} href={row.href} />;
}

/**
 * The ⌘K palette: one thin search row over one list, grouped by app. Focus
 * stays in the input; the arrow keys move a highlight through the rows
 * (combobox pattern), Enter opens the highlighted one.
 */
export function CommandPalette({
  apps,
  open,
  onOpenChange,
}: {
  /** The apps this visitor may see, in sidebar order. */
  apps: AppDef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const chat = useZarvisOptional();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const uid = useId();
  const titleId = `${uid}-title`;
  const listId = `${uid}-list`;
  const optionId = (index: number) => `${uid}-option-${index}`;

  const [searchNarratives, setSearchNarratives] = useState<typeof NarrativeSearch | null>(null);
  useEffect(() => {
    if (!open || searchNarratives) return;
    let active = true;
    import('@/lib/narratives/search').then(module => {
      if (active) setSearchNarratives(() => module.searchNarratives);
    }).catch(() => { /* Page search remains available if the optional catalog fails to load. */ });
    return () => { active = false; };
  }, [open, searchNarratives]);

  const canAsk = chat !== null;
  const { groups, noMatch } = useMemo(
    () => buildPalette(apps, query, canAsk, searchNarratives?.(query) ?? []),
    [apps, query, canAsk, searchNarratives],
  );
  const rows = paletteRows(groups);
  const current = Math.min(active, Math.max(rows.length - 1, 0));

  // The native dialog follows the state the shell holds, and every opening
  // starts at the top of the list.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      // The page is locked while the palette is open. Where its scrollbar
      // takes room, that room stays reserved, so nothing behind shifts.
      const root = document.documentElement;
      const hasScrollbar = window.innerWidth > root.clientWidth;
      root.style.setProperty(GUTTER_VAR, hasScrollbar ? "stable" : "auto");
      el.showModal();
      if (results.current) results.current.scrollTop = 0;
    }
    if (!open && el.open) el.close();
  }, [open]);

  // The list is sized to the part of the screen an on-screen keyboard leaves
  // visible, so its last rows stay reachable on a phone.
  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    const viewport = window.visualViewport;
    const fit = () =>
      el?.style.setProperty(
        "--palette-vh",
        `${viewport?.height ?? window.innerHeight}px`,
      );
    fit();
    viewport?.addEventListener("resize", fit);
    return () => viewport?.removeEventListener("resize", fit);
  }, [open]);

  const close = () => dialog.current?.close();

  function reveal(index: number) {
    const box = results.current;
    if (!box) return;
    // The first row brings its group label back into view with it.
    if (index === 0) box.scrollTop = 0;
    else
      document
        .getElementById(optionId(index))
        ?.scrollIntoView({ block: "nearest" });
  }

  function choose(row: PaletteRow) {
    // The palette text becomes the draft; nothing is sent until the visitor presses send.
    if (row.ask) chat?.setDraft(row.ask);
    close();
  }

  // Keys are handled for the whole palette: wherever focus sits (a click on
  // the list can move it), the arrows move the highlight, Enter opens it and
  // typing continues in the search box.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.target instanceof Element && e.target.closest("button")) return;
    const away = e.target !== input.current;
    const plain = !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (plain && STEP_KEYS.includes(e.key)) {
      e.preventDefault();
      if (away) input.current?.focus();
      const next = stepActive(current, rows.length, e.key as PaletteStep);
      setActive(next);
      reveal(next);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[current];
      if (!row) return;
      choose(row);
      if (row.href === "/private-chat") window.location.assign(row.href);
      else router.push(row.href);
      return;
    }
    const typing =
      (e.key.length === 1 || e.key === "Backspace") &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey;
    if (away && typing) input.current?.focus();
  }

  const offsets = groups.map((_, g) =>
    groups.slice(0, g).reduce((count, group) => count + group.rows.length, 0),
  );

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={() => {
        document.documentElement.style.removeProperty(GUTTER_VAR);
        setQuery("");
        setActive(0);
        onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className={styles.panel} onKeyDown={onKeyDown}>
        <h2 id={titleId} className="sr-only">
          Search OpenZcash
        </h2>
        <div className={styles.search}>
          <span className={styles.searchGlyph}>
            <Glyph d={GLYPH.search} size={15} />
          </span>
          <input
            ref={input}
            className={styles.input}
            type="text"
            role="combobox"
            aria-label="Search pages, grants and apps"
            aria-autocomplete="list"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-activedescendant={rows.length ? optionId(current) : undefined}
            placeholder={PLACEHOLDER}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              reveal(0);
            }}
          />
          {/* Esc already closes from the keyboard: the keycap is for pointers, and focus stays in the search box. */}
          <button
            type="button"
            className={styles.esc}
            aria-label="Close search"
            tabIndex={-1}
            onClick={close}
          >
            <kbd>esc</kbd>
          </button>
        </div>
        {/* Not a Tab stop: a scrolling box would otherwise take focus and the arrow keys with it. */}
        <div className={styles.results} ref={results} tabIndex={-1}>
          {noMatch ? (
            <p className={styles.empty} role="status">
              No page matches
            </p>
          ) : null}
          <div id={listId} role="listbox" aria-labelledby={titleId}>
            {groups.map((group, g) => (
              <div
                key={group.id}
                role="group"
                aria-label={group.label}
                className={styles.group}
              >
                <div className={styles.groupLabel} aria-hidden="true">
                  {group.app ? <AppMark app={group.app} size={14} /> : null}
                  <span>{group.label}</span>
                </div>
                {group.rows.map((row, r) => {
                  const index = offsets[g] + r;
                  const RowLink = row.href === "/private-chat" ? "a" : Link;
                  return (
                    <RowLink
                      key={row.href}
                      id={optionId(index)}
                      href={row.href}
                      role="option"
                      aria-selected={index === current}
                      tabIndex={-1}
                      className={styles.row}
                      onClick={() => choose(row)}
                      onMouseMove={() => {
                        if (index !== current) setActive(index);
                      }}
                    >
                      <span className={styles.rowMark} aria-hidden="true">
                        <RowMark row={row} />
                      </span>
                      <span className={styles.rowLabel}>{row.label}</span>
                    </RowLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p className={styles.foot} aria-hidden="true">
          <span>↑↓</span> navigate · <span>↵</span> open · <span>esc</span>{" "}
          close
        </p>
      </div>
    </dialog>
  );
}
