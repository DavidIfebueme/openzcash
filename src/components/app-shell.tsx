"use client";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ZarvisDock } from "./zarvis/zarvis-dock";
import { ZarvisMark } from "./zarvis/zarvis-mark";
import { LogoutButton } from "./logout-button";
import { ScrollHints } from "./scroll-hints";
import { APPS, backOf, placeOf, type AppDef } from "@/lib/design-routes";
import {
  IconArrowUp,
  IconBalance,
  IconBook,
  IconChart,
  IconCalculator,
  IconCheck,
  IconCoins,
  IconDashboard,
  IconGlobe,
  IconGrant,
  IconGrid,
  IconKey,
  IconList,
  IconMail,
  IconNews,
  IconPencil,
  IconReceipt,
  IconShield,
  IconSigma,
  IconSwap,
  IconTerminal,
  IconUsers,
  IconVote,
  IconWallet,
} from "./icons";

type IconType = ComponentType<{ className?: string }>;

/** Line icons by key (apps without a logo) and by route (inner pages). */
const ICON_BY_KEY: Record<string, IconType> = {
  zarvis: ZarvisMark,
  book: IconBook,
  calculator: IconCalculator,
  news: IconNews,
  shield: IconShield,
  grant: IconGrant,
  balance: IconBalance,
  wallet: IconWallet,
  swap: IconSwap,
  chart: IconChart,
  terminal: IconTerminal,
  globe: IconGlobe,
  sigma: IconSigma,
  users: IconUsers,
  grid: IconGrid,
  key: IconKey,
};
const PAGE_ICON: Record<string, IconType> = {
  "/zcg/grants": IconGrant,
  "/zcg/proposals": IconVote,
  "/zcg/disbursements": IconReceipt,
  "/zcg/recipients": IconUsers,
  "/zcg/schedule": IconList,
  "/zcg/totals": IconChart,
  "/zcg/analytics": IconArrowUp,
  "/zcg/reconciliation": IconCheck,
  "/zcg/committee": IconUsers,
  "/zcg/meetings": IconBook,
  "/zcg/stipends": IconCoins,
  "/zcg/budget": IconBalance,
  "/zcg/office": IconDashboard,
  "/zcg/methodology": IconBook,
  "/zcg/copilot": IconTerminal,
  "/zcg/coinholder": IconCoins,
  "/zcg/coinholder/copilot": IconTerminal,
  "/zechub/copilot": IconTerminal,
  "/development": IconTerminal,
  "/viewing-keys": IconKey,
  "/invites": IconMail,
  "/onboarding": IconPencil,
  "/login": IconShield,
};

type Theme = "light" | "dark";
const THEME_KEY = "oz-theme";
const OPEN_KEY = "oz-nav-open";
// The light workspace is the default everywhere; dark is a per-browser choice.
const THEME_ORDER: Theme[] = ["light", "dark"];
const THEME_LABEL: Record<Theme, string> = {
  light: "Light theme (switch to dark)",
  dark: "Dark theme (switch to light)",
};

function Glyph({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d}></path>
    </svg>
  );
}
const GLYPH = {
  menu: "M2.5 4h11M2.5 8h11M2.5 12h11",
  search: "M11 11l3 3M3 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0z",
  home: "M2.5 7.5L8 3l5.5 4.5V13H9.5V9.5h-3V13H2.5z",
  sun: "M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1",
  moon: "M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z",
  close: "M4 4l8 8M12 4l-8 8",
  chevron: "M6 4l4 4-4 4",
};

function AppMark({ app, size = 18 }: { app: AppDef; size?: number }) {
  if (app.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={app.logo}
        alt=""
        width={size}
        height={size}
        className={
          app.logo.startsWith("/logos/marks/")
            ? "rd-side-logo rd-side-logo-glyph"
            : "rd-side-logo"
        }
      />
    );
  }
  const Icon = ICON_BY_KEY[app.icon] ?? IconGrid;
  return <Icon className="rd-side-icon" />;
}

function PageMark({ mark, href }: { mark?: string; href: string }) {
  if (mark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={mark} alt="" width={15} height={15} className="rd-side-page-icon" />
    );
  }
  const Icon = PAGE_ICON[href];
  return Icon ? <Icon className="rd-side-icon" /> : <span className="rd-side-icon" aria-hidden />;
}

export function AppShell({
  children,
  isAdmin = false,
  isPreview = false,
  footer,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  isPreview?: boolean;
  /** Server-rendered treasury bar, pinned to the bottom of every page. */
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const rawPlace = placeOf(pathname);
  // Data-management pages exist for administrators only; an anonymous visitor
  // on the public /onboarding route gets no trail into them.
  const place = rawPlace?.app.admin && !isAdmin ? undefined : rawPlace;
  // Hidden apps (Lockbox) open only from the treasury bar.
  const apps = APPS.filter((a) => (!a.admin || isAdmin) && !a.hidden);
  const back = backOf(pathname);
  const isHome = pathname === "/zcg" || pathname === "/";

  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [openApps, setOpenApps] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Record<string, string>>({});
  const close = () => dialog.current?.close();
  const openDialog = () => dialog.current?.showModal();

  // Per-browser conveniences: the theme and which apps stay expanded.
  // Read after mount (reading storage during render breaks hydration).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const t = window.localStorage.getItem(THEME_KEY) as Theme | null;
      if (t && THEME_ORDER.includes(t)) setTheme(t);
      const o = window.localStorage.getItem(OPEN_KEY);
      if (o) setOpenApps(JSON.parse(o) as Record<string, boolean>);
    } catch {
      /* private mode or blocked storage: defaults apply */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Record counts beside the sidebar items, read after the page paints.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/nav-counts", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, string>) => setCounts(d ?? {}))
      .catch(() => {
        /* counts are a convenience; the navigation works without them */
      });
    return () => ctrl.abort();
  }, []);

  // The drawer closes on navigation; ⌘K / Ctrl+K opens the record search.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNavOpen(false);
  }, [pathname]);
  // The page behind an open drawer stays put.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) close();
        else openDialog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }
  function toggleApp(id: string, fallbackOpen: boolean) {
    const next = { ...openApps, [id]: !(openApps[id] ?? fallbackOpen) };
    setOpenApps(next);
    try {
      window.localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn("rd-shell", isPreview && "rd-shell-preview")}
      data-theme={theme}
      data-nav={navOpen ? "open" : undefined}
      data-section={place?.app.label ?? "Explore"}
    >
      <a href="#main-content" className="rd-skip">
        Skip to content
      </a>

      <aside className="rd-side" aria-label="OpenZcash">
        <div className="rd-side-banner">
          <button
            type="button"
            className="rd-side-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <Glyph d={GLYPH.close} />
          </button>
          <Link href="/zcg" className="rd-brand" aria-label="OpenZcash home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/marks/openzcash.png" width="68" height="68" alt="" />
            <span className="rd-brand-text">
              <strong>OpenZcash</strong>
            </span>
          </Link>
        </div>
        <nav className="rd-side-nav" aria-label="Apps">
          {apps.map((app) => {
            const isCurrentApp = place?.app.id === app.id;
            const open = app.pages.length
              ? (openApps[app.id] ?? (isCurrentApp || app.open === true))
              : false;
            const appActive = isCurrentApp && !place?.page;
            return (
              <div key={app.id} className="rd-side-app" data-open={open}>
                <div className="rd-side-app-row">
                  <Link
                    href={app.href}
                    className="rd-side-item"
                    aria-current={appActive ? "page" : undefined}
                    title={app.sub}
                  >
                    <AppMark app={app} />
                    <span className="rd-side-label">{app.label}</span>
                    {counts[app.href] ? (
                      <small className="tnum">{counts[app.href]}</small>
                    ) : null}
                  </Link>
                  {app.pages.length ? (
                    <button
                      type="button"
                      className="rd-side-toggle"
                      aria-expanded={open}
                      aria-label={`${open ? "Collapse" : "Expand"} ${app.label}`}
                      onClick={() => toggleApp(app.id, isCurrentApp || app.open === true)}
                    >
                      <Glyph d={GLYPH.chevron} size={12} />
                    </button>
                  ) : null}
                </div>
                {open ? (
                  <div className="rd-side-pages">
                    {app.pages.filter((p) => !p.hidden).map((p) => {
                      const active =
                        place?.page?.href === p.href ||
                        place?.detail?.parent.href === p.href;
                      return (
                        <Link
                          key={p.href}
                          href={p.href}
                          className="rd-side-item rd-side-page"
                          aria-current={active ? "page" : undefined}
                        >
                          <PageMark mark={p.mark} href={p.href} />
                          <span className="rd-side-label">{p.label}</span>
                          {counts[p.href] ? (
                            <small className="tnum">{counts[p.href]}</small>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="rd-side-foot">
          <Link href="/zcg/methodology">Sources &amp; methodology</Link>
          {isPreview ? (
            <a href="https://openzcash.org" target="_blank" rel="noreferrer">
              Current website ↗
            </a>
          ) : null}
          {isAdmin ? <LogoutButton /> : null}
        </div>
      </aside>
      <div
        className="rd-backdrop"
        aria-hidden="true"
        onClick={() => setNavOpen(false)}
      />

      <div className="rd-body">
        <header className="rd-topbar">
          <button
            type="button"
            className="rd-icon-button rd-menu"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Glyph d={GLYPH.menu} size={17} />
          </button>
          {!isHome ? (
            <Link
              href={back.href}
              className="rd-back"
              aria-label={`Back to ${back.label}`}
              title={`Back to ${back.label}`}
            >
              ‹
            </Link>
          ) : null}
          <nav className="rd-breadcrumb" aria-label="Breadcrumb">
            {place ? (
              <>
                {place.page ? (
                  <Link href={place.app.href}>{place.app.label}</Link>
                ) : (
                  <span>{place.app.label}</span>
                )}
                {place.page ? (
                  <>
                    <span aria-hidden>›</span>
                    {place.detail ? (
                      <Link href={place.page.href}>{place.page.label}</Link>
                    ) : (
                      <span>{place.page.label}</span>
                    )}
                  </>
                ) : null}
                {place.detail ? (
                  <>
                    <span aria-hidden>›</span>
                    <span>{place.detail.label}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </nav>
          <button
            type="button"
            className="rd-search"
            onClick={openDialog}
            aria-label="Search records and apps"
          >
            <Glyph d={GLYPH.search} size={14} />
            <span>Search records, grants, apps…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="rd-topbar-actions">
            <Link href="/zarvis" className="rd-button rd-button-primary">
              Ask Zarvis
            </Link>
            <button
              type="button"
              className="rd-icon-button"
              onClick={cycleTheme}
              aria-label={THEME_LABEL[theme]}
              title={THEME_LABEL[theme]}
            >
              <Glyph d={theme === "dark" ? GLYPH.moon : GLYPH.sun} size={16} />
            </button>
          </div>
        </header>

        <main id="main-content" className="rd-main">
          <ScrollHints />
          <div className="rd-content">{children}</div>
        </main>

        {footer ? (
          <footer className="rd-treasury-bar" aria-label="Treasury at a glance">
            {footer}
          </footer>
        ) : null}
      </div>

      <ZarvisDock />
      <dialog
        aria-labelledby="app-directory-title"
        className="ws-app-dialog"
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="ws-dialog-heading">
          <div>
            <span className="ws-eyebrow">THE OPENZCASH WORKSPACE</span>
            <h2 id="app-directory-title">Where would you like to go?</h2>
          </div>
          <button
            type="button"
            aria-label="Close app directory"
            onClick={close}
          >
            ×
          </button>
        </div>
        <input
          aria-label="Find an app"
          placeholder="Find an app, record or source…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="ws-app-directory">
          {apps.map((app) => {
            const q = query.toLowerCase();
            const entries = [
              { href: app.href, label: app.pages.length ? "Overview" : app.label },
              ...app.pages.filter((p) => !p.hidden),
            ].filter((p) => (p.label + " " + app.label + " " + app.sub).toLowerCase().includes(q));
            return entries.length ? (
              <section key={app.id}>
                <h3>
                  <AppMark app={app} size={16} />
                  {app.label}
                </h3>
                {entries.map((p) => (
                  <Link key={p.href} href={p.href} onClick={close}>
                    {p.label}
                    <span aria-hidden>→</span>
                  </Link>
                ))}
              </section>
            ) : null;
          })}
        </div>
      </dialog>
    </div>
  );
}
