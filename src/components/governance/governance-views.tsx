"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  VIEWS,
  isViewId,
  resolveView,
  viewQuery,
  type ViewId,
} from "@/lib/governance/views";
import styles from "./views.module.css";

interface GovernanceViewsProps {
  /** One panel per view, rendered on the server. */
  panels: Record<ViewId, ReactNode>;
  /** How many records a view lists, shown beside its name. */
  counts?: Partial<Record<ViewId, number>>;
  /** The view that carries the decision open today. */
  live?: ViewId;
}

const tabId = (view: ViewId) => `governance-tab-${view}`;
const panelId = (view: ViewId) => `governance-panel-${view}`;

function showView(params: { toString(): string }, view: ViewId) {
  const query = viewQuery(new URLSearchParams(params.toString()), view);
  window.history.replaceState(null, "", query);
}

/**
 * The governance page as tabs. Every panel is in the document, so nothing
 * loads on a click and the address keeps the open view (`?view=`).
 */
export function GovernanceViews({
  panels,
  counts = {},
  live,
}: GovernanceViewsProps) {
  const params = useSearchParams();
  const active = resolveView(params);
  const tabs = useRef<Partial<Record<ViewId, HTMLButtonElement | null>>>({});

  // A link to an anchor inside another view opens that view, then goes to
  // the anchor: the browser cannot scroll to an element in a hidden panel.
  const anchor = useRef<string | null>(null);
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!target) return;
    const view = document
      .getElementById(target)
      ?.closest<HTMLElement>("[data-view]")?.dataset.view;
    if (!isViewId(view) || view === resolveView(params)) return;
    anchor.current = target;
    window.history.replaceState(
      null,
      "",
      `${viewQuery(params, view)}#${target}`,
    );
    // Read once, on arrival: later hash changes come from the page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!anchor.current) return;
    const element = document.getElementById(anchor.current);
    const view = element?.closest<HTMLElement>("[data-view]")?.dataset.view;
    if (!element || view !== active) return;
    anchor.current = null;
    element.scrollIntoView();
  }, [active]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = VIEWS.findIndex((view) => view.id === active);
    const last = VIEWS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const view = VIEWS[next].id;
    showView(params, view);
    tabs.current[view]?.focus();
  }

  return (
    <>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Governance views"
        onKeyDown={onKeyDown}
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            ref={(element) => {
              tabs.current[view.id] = element;
            }}
            type="button"
            role="tab"
            id={tabId(view.id)}
            className={styles.tab}
            aria-selected={view.id === active}
            aria-label={
              counts[view.id] != null
                ? `${view.label}, ${counts[view.id]} on record`
                : undefined
            }
            aria-controls={panelId(view.id)}
            tabIndex={view.id === active ? 0 : -1}
            onClick={() => showView(params, view.id)}
          >
            {view.id === live ? (
              <span className={styles.live} aria-hidden="true" />
            ) : null}
            {view.label}
            {counts[view.id] != null ? (
              <span className={styles.count}>{counts[view.id]}</span>
            ) : null}
          </button>
        ))}
      </div>
      {VIEWS.map((view) => (
        <div
          key={view.id}
          role="tabpanel"
          id={panelId(view.id)}
          className={styles.panel}
          aria-labelledby={tabId(view.id)}
          data-view={view.id}
          hidden={view.id !== active}
          tabIndex={view.id === active ? 0 : undefined}
        >
          {panels[view.id]}
        </div>
      ))}
    </>
  );
}

interface ViewLinkProps {
  view: ViewId;
  children: ReactNode;
}

/** A link from one view to another: it swaps the view without navigating. */
export function ViewLink({ view, children }: ViewLinkProps) {
  const params = useSearchParams();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    showView(params, view);
  }

  return (
    <a className={styles.link} href={viewQuery(params, view)} onClick={onClick}>
      {children}
    </a>
  );
}
