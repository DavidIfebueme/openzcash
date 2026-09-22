/**
 * The navigation model of the workspace: one entry per app, in the order the
 * production launcher established, with the official logo where one exists
 * and the app's inner pages beneath it. Every trail (breadcrumb, back control,
 * related pages) derives from this list, so a route's place in the hierarchy
 * is defined once.
 */
export type AppPage = {
  href: string;
  label: string;
  /** PNG glyph shown beside the page in the sidebar. */
  mark?: string;
  /** Kept in the model (breadcrumb, back) but not listed in the sidebar or ⌘K. */
  hidden?: boolean;
};

export type AppDef = {
  /** Kept in the model (breadcrumb, back) but not listed in the sidebar or ⌘K. */
  hidden?: boolean;
  id: string;
  label: string;
  /** Landing route of the app. */
  href: string;
  /** One-line description, as on the launcher tiles. */
  sub: string;
  /** Official logo under /public, when the organisation has one. */
  logo?: string;
  /** Line icon key (see the shell) for apps without a logo. */
  icon: string;
  /** Inner pages, in reading order. */
  pages: AppPage[];
  /** Expanded in the sidebar by default (the visitor can still collapse it). */
  open?: boolean;
  /** Data-management apps, shown to administrators only. */
  admin?: boolean;
};

export const APPS: AppDef[] = [
  { id: "monthly", label: "Monthly", href: "/monthly", sub: "Ecosystem reports", logo: "/logos/marks/monthly.png", icon: "book", pages: [] },
  { id: "news", label: "News", href: "/news", sub: "What's new", logo: "/logos/marks/news.png", icon: "news", pages: [] },
  { id: "cex-zec-dex", label: "CEX < ZEC > DEX", href: "/cex-zec-dex", sub: "Trading & custody", icon: "swap", pages: [] },
  {
    id: "zcg",
    label: "ZCG",
    href: "/zcg",
    sub: "Dev Fund",
    logo: "/logos/zcg.png",
    icon: "grant",
    open: true,
    pages: [
      { href: "/zcg/grants", label: "Grants", mark: "/logos/glyphs/grants.png" },
      { href: "/zcg/proposals", label: "Proposals", mark: "/logos/glyphs/proposals.png" },
      { href: "/zcg/disbursements", label: "Disbursements", mark: "/logos/glyphs/disbursements.png" },
      { href: "/zcg/recipients", label: "Recipients", mark: "/logos/glyphs/recipients.png" },
      { href: "/zcg/schedule", label: "Scheduled", mark: "/logos/glyphs/schedule.png" },
      { href: "/zcg/investments", label: "Investments", mark: "/logos/glyphs/investments.png" },
      { href: "/zcg/committee", label: "Committee", mark: "/logos/glyphs/committee.png" },
      { href: "/zcg/meetings", label: "Meetings", mark: "/logos/glyphs/meetings.png" },
      { href: "/zcg/office", label: "ZCG Office", mark: "/logos/glyphs/office.png" },
      { href: "/zcg/totals", label: "Totals", mark: "/logos/glyphs/totals.png" },
      { href: "/zcg/analytics", label: "Insights", mark: "/logos/glyphs/insights.png" },
      { href: "/zcg/copilot", label: "ZCG Copilot", mark: "/logos/glyphs/copilot.png" },
      { href: "/zcg/methodology", label: "Sources & API", mark: "/logos/glyphs/methodology.png" },
      { href: "/zcg/reconciliation", label: "Reconciliation", mark: "/logos/glyphs/reconciliation.png" },
      { href: "/zcg/stipends", label: "Stipends", mark: "/logos/glyphs/stipends.png", hidden: true },
      { href: "/zcg/budget", label: "Budget", mark: "/logos/glyphs/budget.png", hidden: true },
    ],
  },
  { id: "lockbox", label: "Lockbox", href: "/lockbox", sub: "Live funding", logo: "/logos/marks/lockbox.png", icon: "shield", pages: [], hidden: true },
  {
    id: "fpf",
    label: "FPF",
    href: "/zcg/fpf",
    sub: "Coinholder grants",
    logo: "/logos/fpf.png",
    icon: "wallet",
    pages: [
      { href: "/zcg/coinholder", label: "Coinholder Grants", mark: "/logos/glyphs/coinholder.png" },
      { href: "/zcg/coinholder/pool", label: "Coinholder pool", mark: "/logos/glyphs/coinholder.png" },
      { href: "/zcg/coinholder/copilot", label: "Coinholder Copilot", mark: "/logos/glyphs/copilot.png" },
    ],
  },
  { id: "zf", label: "Zcash Foundation", href: "/zf", sub: "Reports & Zcon", logo: "/logos/ecosystem/zcash-foundation.png", icon: "balance", pages: [] },
  {
    id: "zodl",
    label: "ZODL",
    href: "/zodl",
    sub: "Zcash Open Development Lab",
    logo: "/logos/ecosystem/zodl-lab.png",
    icon: "terminal",
    pages: [],
  },
  { id: "shielded-labs", label: "Shielded Labs", href: "/shielded-labs", sub: "Crosslink · NSM", logo: "/logos/shielded-labs.png", icon: "shield", pages: [] },
  {
    id: "zakura",
    label: "Zakura",
    href: "/zakura",
    sub: "Full node · Valar & Tachyon",
    logo: "/logos/ecosystem/zakura.png",
    icon: "terminal",
    pages: [],
  },
  {
    id: "tachyon",
    label: "Tachyon",
    href: "/tachyon",
    sub: "Protocol research",
    logo: "/logos/ecosystem/tachyon.png",
    icon: "terminal",
    pages: [],
  },
  {
    id: "zechub",
    label: "ZecHub DAO",
    href: "/zechub",
    sub: "Latest proposals",
    logo: "/logos/zechub.png",
    icon: "globe",
    pages: [{ href: "/zechub/copilot", label: "ZecHub Copilot", mark: "/logos/glyphs/copilot.png" }],
  },
  { id: "arborist", label: "Arborist Calls", href: "/arborist", sub: "Protocol call archive", logo: "/logos/arborist.png", icon: "sigma", pages: [] },
  { id: "communities", label: "Communities", href: "/communities", sub: "Global groups · live", logo: "/logos/communities.png", icon: "users", pages: [] },
  {
    id: "ecosystem",
    label: "Ecosystem",
    href: "/ecosystem",
    sub: "Projects & maintainers",
    logo: "/logos/marks/ecosystem.png",
    icon: "globe",
    pages: [{ href: "/development", label: "Development", mark: "/logos/glyphs/development.png" },
      { href: "/defi", label: "DeFi", mark: "/logos/glyphs/defi.png" },
      { href: "/z3", label: "Z3", mark: "/logos/glyphs/z3.png" },
      { href: "/wallets", label: "Wallets", mark: "/logos/glyphs/wallets.png" },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    href: "/projects",
    sub: "Data management",
    logo: "/logos/marks/manage.png",
    icon: "grid",
    admin: true,
    pages: [
      { href: "/viewing-keys", label: "Viewing keys", mark: "/logos/glyphs/viewing-keys.png" },
      { href: "/invites", label: "Invites", mark: "/logos/glyphs/invites.png" },
      { href: "/onboarding", label: "Register treasury", mark: "/logos/glyphs/onboarding.png" },
      { href: "/login", label: "Sign in", mark: "/logos/glyphs/login.png" },
    ],
  },
];

/** Detail routes and the list page they belong to. */
const DETAILS: Record<string, { parent: string; label: string }> = {
  "/zcg/grant": { parent: "/zcg/grants", label: "Grant detail" },
  "/zcg/recipient": { parent: "/zcg/recipients", label: "Recipient detail" },
};

const pathOf = (href: string) => href.split("?")[0];

export type Place = {
  app: AppDef;
  /** The inner page, when the route is not the app's landing page. */
  page?: AppPage;
  /** The detail record, when the route is a drill-down of a page. */
  detail?: { parent: AppPage; label: string };
};

/** Where a route sits in the hierarchy. Undefined for Home and unknown routes. */
export function placeOf(pathname: string): Place | undefined {
  const detail = DETAILS[pathname];
  const target = detail ? detail.parent : pathname;
  for (const app of APPS) {
    // An app that opens a record by query (Zakura, ZODL, Tachyon) never
    // claims the plain path: /ecosystem belongs to the Ecosystem app.
    if (app.href.includes("?")) continue;
    if (pathOf(app.href) === target && !detail) return { app };
    const page = app.pages.find((p) => pathOf(p.href) === target);
    if (page) {
      return detail
        ? { app, page, detail: { parent: page, label: detail.label } }
        : { app, page };
    }
  }
  return undefined;
}

/** Back control: a detail returns to its list, a page to its app, an app to ZCG, the home. */
export function backOf(pathname: string): { href: string; label: string } {
  const place = placeOf(pathname);
  if (!place) return { href: "/zcg", label: "ZCG" };
  if (place.detail) return { href: place.detail.parent.href, label: place.detail.parent.label };
  if (place.page) return { href: place.app.href, label: place.app.label };
  return { href: "/zcg", label: "ZCG" };
}

/** Grouped view of the same model, for directories and the design-review page. */
export const DESIGN_GROUPS = APPS.map((app) => ({
  name: app.label,
  description: app.sub,
  admin: app.admin ?? false,
  routes: [
    [app.href, app.pages.length ? "Overview" : app.label] as [string, string],
    ...app.pages.map((p) => [p.href, p.label] as [string, string]),
  ],
}));

export function designGroup(pathname: string) {
  const place = placeOf(pathname);
  return place ? DESIGN_GROUPS.find((g) => g.name === place.app.label) : undefined;
}
