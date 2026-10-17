"use client";
import Link from "next/link";
import type { Place } from "@/lib/design-routes";
import { PHONE_MARK_SIZE, phoneHeaderOf } from "@/lib/phone-header";
import { AppMark } from "./app-marks";
import { TopBarTitle } from "./top-bar-title";

/**
 * The phone top bar's identity block: the app's mark beside one or two lines
 * that say where the visitor is (see phoneHeaderOf for the rules). It is the
 * breadcrumb folded for a phone, with the same links, so only one of the two
 * is ever shown: this one at tab-bar width, the breadcrumb above it
 * (mobile-shell.css). Routes the navigation model does not know show the
 * page's own name and no mark.
 */
export function TopBarPlace({ place }: { place: Place | undefined }) {
  const header = phoneHeaderOf(place);
  if (!header) {
    return (
      <nav className="rd-place" aria-label="Breadcrumb">
        <TopBarTitle />
      </nav>
    );
  }
  const { level, app, over, title } = header;
  const mark = <AppMark app={app} size={PHONE_MARK_SIZE} />;
  const overContent = <>
    {level === "page" ? <span className="rd-place-mark">{mark}</span> : null}
    <span className="rd-place-over-label">{over?.label}</span>
  </>;
  return (
    // The level sizes the touch targets, the app singles out a mark (mobile-shell.css).
    <nav
      className="rd-place"
      aria-label="Breadcrumb"
      data-level={level}
      data-app={app.id}
    >
      {/* A record's first line leads to its list, so the mark alone leads to the app. */}
      {level === "detail" ? (
        <Link href={app.href} className="rd-place-mark" aria-label={app.label}>
          {mark}
        </Link>
      ) : null}
      {level === "app" ? <span className="rd-place-mark">{mark}</span> : null}
      {over ? (over.href ? (
        <Link href={over.href} className="rd-place-over">{overContent}</Link>
      ) : (
        <span className="rd-place-over">{overContent}</span>
      )) : null}
      <span className="rd-place-name">{title}</span>
    </nav>
  );
}
