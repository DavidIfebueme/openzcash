"use client";
import Link from "next/link";
import { type AppDef, type Place, childAppsOf, overviewEntry } from "@/lib/design-routes";
import { AppMark, GLYPH, Glyph, PageMark } from "./app-marks";
import { IconOrganizations } from "./icons";

type Props = {
  apps: AppDef[];
  place?: Place;
  counts: Record<string, string>;
  openApps: Record<string, boolean>;
  compact: boolean;
  onToggle: (id: string, fallbackOpen: boolean) => void;
  onOpen: (id: string) => void;
};

/** The desktop sidebar and phone Apps drawer share one hierarchy. */
export function AppNavigation({ apps, place, counts, openApps, compact, onToggle, onOpen }: Props) {
  function renderApp(app: AppDef, nested = false) {
    const isZcg = app.id === "zcg";
    const isPrivateChat = app.id === "private-chat";
    // The chat opens its own document, outside the portal's session and scripts.
    const HeaderLink = isPrivateChat ? "a" : Link;
    const children = childAppsOf(app, apps);
    const showCounts = app.id !== "zcg" && app.id !== "ecosystem" && app.parentId !== "ecosystem";
    const directChildren = children.filter((child) => child.parentGroup === "pages");
    const destinations = [
      ...app.pages.filter((page) => !page.hidden).map((page) => ({ kind: "page" as const, href: page.href, page })),
      ...directChildren.map((child) => ({ kind: "app" as const, href: child.href, app: child })),
    ];
    if (app.navigationOrder) {
      const order = new Map(app.navigationOrder.map((href, index) => [href, index]));
      destinations.sort((a, b) => (order.get(a.href) ?? Infinity) - (order.get(b.href) ?? Infinity));
    }
    const organizations = children.filter((child) => child.parentGroup !== "pages");
    const containsCurrentOrganization = organizations.some((child) => child.id === place?.app.id);
    const isCurrentApp = place?.app.id === app.id;
    const containsCurrent = children.some((child) => child.id === place?.app.id);
    const hasPages = app.pages.some((page) => !page.hidden);
    const expandable = hasPages || children.length > 0;
    const fallbackOpen = !isZcg && (isCurrentApp || containsCurrent || app.open === true);
    const open = expandable && (openApps[app.id] ?? fallbackOpen);
    const appActive = isCurrentApp && !place?.page;
    const overview = overviewEntry(app);
    const headerActive = isZcg
      ? place?.page?.href === "/zcg/participate" && !open
      : appActive && !(overview && open);
    const groupId = `${app.id}:organizations`;
    const groupOpen = openApps[groupId] ?? containsCurrentOrganization;
    return (
      <div key={app.id} className="rd-side-app" data-open={open} data-nested={nested || undefined} data-separated={isPrivateChat || undefined}>
        <div className="rd-side-app-row">
          <HeaderLink
            href={isZcg ? "/zcg/participate" : app.href}
            rel={isPrivateChat ? "noreferrer" : undefined}
            className="rd-side-item"
            aria-current={headerActive ? "page" : undefined}
            title={app.sub}
            aria-expanded={isZcg ? open : undefined}
            aria-controls={isZcg && open ? `nav-${app.id}` : undefined}
            onClick={isZcg ? (event) => {
              onOpen(app.id);
              // Keep the phone drawer visible so its newly opened pages can be used.
              if (compact && !open) event.preventDefault();
            } : () => onOpen(app.id)}
            data-long={app.label.length > 18 || undefined}
          >
            <AppMark app={app} />
            <span className="rd-side-label">{app.label}</span>
            {app.share ? (
              <small className="rd-side-share tnum" title={app.share.label}>
                <span aria-hidden>{app.share.value}</span>
                <span className="sr-only">, {app.share.label}</span>
              </small>
            ) : null}
            {showCounts && counts[app.href] ? <small className="tnum">{counts[app.href]}</small> : null}
          </HeaderLink>
          {expandable ? (
            <button
              type="button"
              className="rd-side-toggle"
              aria-expanded={open}
              aria-controls={open ? `nav-${app.id}` : undefined}
              aria-label={`${open ? "Collapse" : "Expand"} ${app.label}`}
              onClick={() => onToggle(app.id, fallbackOpen)}
            >
              <Glyph d={GLYPH.chevron} size={12} />
            </button>
          ) : null}
        </div>
        {open ? (
          <div id={`nav-${app.id}`} className="rd-side-pages">
            {organizations.length ? (
              <div className="rd-side-org-group">
                <button
                  type="button"
                  className="rd-side-org-heading"
                  aria-expanded={groupOpen}
                  aria-controls={groupOpen ? `nav-${app.id}-organizations` : undefined}
                  onClick={() => onToggle(groupId, containsCurrentOrganization)}
                >
                  <IconOrganizations className="rd-side-org-icon" />
                  <span>Organizations</span>
                  <Glyph d={GLYPH.chevron} size={12} />
                </button>
                {groupOpen ? (
                  <div id={`nav-${app.id}-organizations`} className="rd-side-org-list" role="group" aria-label="Organizations">
                    {organizations.map((child) => renderApp(child, true))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {overview ? (
              <Link href={overview.href} className="rd-side-item rd-side-page" aria-current={appActive ? "page" : undefined}>
                <PageMark mark={overview.mark} href={overview.href} />
                <span className="rd-side-label">{overview.label}</span>
              </Link>
            ) : null}
            {destinations.map((destination) => {
              if (destination.kind === "app") return renderApp(destination.app, true);
              const page = destination.page;
              return <Link
                key={page.href}
                href={page.href}
                className="rd-side-item rd-side-page"
                aria-current={place?.page?.href === page.href || place?.detail?.parent.href === page.href || (appActive && page.href === app.href) ? "page" : undefined}
              >
                <PageMark mark={page.mark} href={page.href} />
                <span className="rd-side-label">{page.label}</span>
                {showCounts && counts[page.href] ? <small className="tnum">{counts[page.href]}</small> : null}
              </Link>;
            })}
          </div>
        ) : null}
      </div>
    );
  }
  return <>{apps.filter((app) => !app.parentId).map((app) => renderApp(app))}</>;
}
