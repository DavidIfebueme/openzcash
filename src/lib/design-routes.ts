/**
 * The navigation model of the workspace: one entry per app, in the order the
 * production launcher established, with the official logo where one exists
 * and the app's inner pages beneath it. Every trail (breadcrumb, back control,
 * related pages) derives from this list, so a route's place in the hierarchy
 * is defined once.
 */
import { CEREMONY_HREF, PARTS } from "@/lib/ceremony/parts";

export type AppPage = {
  /** Read-only public beta, shown beside its navigation label. */
  beta?: boolean;
  href: string;
  label: string;
  /** PNG glyph shown beside the page in the sidebar. */
  mark?: string;
  /** Organization logo shown after the page label. */
  brandLogo?: string;
  /** Kept in the model (breadcrumb, back) but not listed in the sidebar or ⌘K. */
  hidden?: boolean;
  /** A hidden page that ⌘K still finds (it stays out of the sidebar). */
  palette?: boolean;
};

export type AppDef = {
  /** Kept in the model (breadcrumb, back) but not listed in the sidebar or ⌘K. */
  hidden?: boolean;
  id: string;
  /** App that groups this app in the navigation, without changing its routes. */
  parentId?: string;
  /** Direct destination under the parent, rather than its organization group. */
  parentGroup?: "pages";
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
  /** Reading order for inner pages and grouped child apps. */
  navigationOrder?: string[];
  /** Grouping without a standalone overview; only its project pages are listed. */
  navigationOnly?: boolean;
  /** Expanded in the sidebar by default (the visitor can still collapse it). */
  open?: boolean;
  /** Share of every block reward that funds the app, shown beside its name. */
  share?: { value: string; label: string };
  /** Data-management apps, shown to administrators only. */
  admin?: boolean;
};

export const APPS: AppDef[] = [
  { id: "zarvis", label: "Zarvis", href: "/zarvis", sub: "Your Zcash AI guide", icon: "zarvis", pages: [] },
  { id: "news", label: "News", href: "/news", sub: "What's new", logo: "/logos/marks/news.png", icon: "news", pages: [] },
  {
    id: "ceremony",
    label: "Zcash Ceremony",
    href: CEREMONY_HREF,
    sub: "The 2016 ceremony, its people and ten years",
    logo: "/logos/marks/ceremony.png",
    icon: "key",
    pages: PARTS.map((p) => ({ href: p.href, label: p.short, mark: p.mark })),
  },
  {
    id: "block-zero",
    label: "Zcash's Since block zero",
    href: "/funding-history",
    sub: "Every ZEC outside mining since genesis",
    logo: "/logos/marks/block-zero.png",
    icon: "chart",
    pages: [],
  },
  {
    id: "governance",
    label: "Zcash governance",
    href: "/governance",
    sub: "Upgrades, polls and open questions",
    logo: "/logos/marks/governance.png",
    icon: "balance",
    pages: [],
  },
  {
    // Its own program, decided by coinholder vote; FPF only administers it.
    id: "coinholders",
    label: "Coinholder Grants",
    href: "/coinholders",
    sub: "Coinholder-Directed Retroactive Grants Program",
    logo: "/logos/marks/coinholders.png",
    share: { value: "12%", label: "12% of every block reward (ZIP 1016)" },
    icon: "grant",
    pages: [
      { href: "/coinholders", label: "Program overview", mark: "/logos/glyphs/overview.png" },
      { href: "/coinholders/proposals", label: "Proposals", mark: "/logos/glyphs/proposals.png" },
      { href: "/coinholders/results", label: "Results", mark: "/logos/glyphs/decisions.png" },
      { href: "/coinholders/activity", label: "Voting activity", mark: "/logos/glyphs/insights.png" },
      // Keep verification beside the results and activity it checks.
      { href: "/coinholders/verify", label: "Verify it yourself", mark: "/logos/glyphs/reconciliation.png" },
      { href: "/coinholders/fund", label: "The fund", mark: "/logos/glyphs/coinholder.png" },
      { href: "/zcg/coinholder/copilot", label: "Coinholder Copilot", mark: "/logos/glyphs/copilot.png" },
    ],
  },
  {
    id: "zcg",
    label: "ZCG",
    href: "/zcg",
    sub: "Dev Fund",
    logo: "/logos/zcg.png",
    share: { value: "8%", label: "8% of every block reward (ZIP 1015)" },
    icon: "grant",
    pages: [
      { href: "/zcg/proposals", label: "Proposals", mark: "/logos/glyphs/proposals.png" },
      { href: "/zcg/participate", label: "Participate", mark: "/logos/glyphs/decisions.png" },
      { href: "/zcg/grants", label: "Grants", mark: "/logos/glyphs/grants.png" },
      { href: "/zcg/recipients", label: "Recipients", mark: "/logos/glyphs/recipients.png" },
      { href: "/zcg/schedule", label: "Payment schedule", mark: "/logos/glyphs/schedule.png" },
      { href: "/zcg/disbursements", label: "Disbursements", mark: "/logos/glyphs/disbursements.png" },
      { href: "/zcg/investments", label: "Investments", mark: "/logos/glyphs/investments.png" },
      { href: "/zcg/totals", label: "Totals", mark: "/logos/glyphs/totals.png" },
      { href: "/zcg/analytics", label: "Insights", mark: "/logos/glyphs/insights.png" },
      { href: "/zcg/treasury-calculator", label: "Treasury calculator", mark: "/logos/glyphs/calculator.png" },
      { href: "/zcg/committee", label: "Committee", mark: "/logos/glyphs/committee.png" },
      { href: "/zcg/meetings", label: "Meetings", mark: "/logos/glyphs/meetings.png" },
      { href: "/zcg/office", label: "ZCG Office", mark: "/logos/glyphs/office.png" },
      { href: "/zcg/copilot", label: "ZCG Copilot", mark: "/logos/glyphs/copilot.png" },
      { href: "/zcg/reconciliation", label: "Reconciliation", mark: "/logos/glyphs/reconciliation.png" },
      { href: "/zcg/methodology", label: "Sources & API", mark: "/logos/glyphs/methodology.png" },
      { href: "/zcg/stipends", label: "Stipends", mark: "/logos/glyphs/stipends.png", hidden: true },
      { href: "/zcg/budget", label: "Budget", mark: "/logos/glyphs/budget.png", hidden: true },
    ],
  },
  {
    id: "zcash-network",
    label: "Zcash Network",
    href: "/zcash-network",
    sub: "Blocks, mining and shielded network activity",
    icon: "network",
    pages: [],
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    href: "/ecosystem",
    sub: "Projects, teams & organizations",
    icon: "ecosystem",
    navigationOrder: [
      "/opportunities", "/wallets/find", "/ecosystem/history", "/communities", "/development", "/arborist",
      "/zcg/fpf", "/shielded-labs", "/tachyon", "/zf", "/zakura", "/zechub", "/zodl",
    ],
    pages: [
      { href: "/wallets/find", label: "Wallets", mark: "/logos/glyphs/wallets.png" },
      { href: "/opportunities", label: "Opportunities", beta: true },
      { href: "/ecosystem/history", label: "Project histories", mark: "/logos/glyphs/grants.png" },
      { href: "/development", label: "Development", mark: "/logos/glyphs/development.png" },
      { href: "/ecosystem/history/z3", label: "Z3 stack", mark: "/logos/glyphs/z3.png", hidden: true, palette: true },
    ],
  },
  { id: "zec-observatory", label: "ZEC Observatory", href: "/zec-observatory", sub: "Markets, DeFi liquidity & holdings", icon: "chart", pages: [] },
  { id: "legal", label: "Privacy & Policy", href: "/legal", sub: "Rights, regulation & public debate", icon: "balance", pages: [{ href: "/legal", label: "Updates" }] },
  { id: "narratives", label: "Zcash Pitches & Narratives", href: "/narratives", sub: "Zcash pitches and explanations · EN / PT / ES", icon: "narratives", pages: [] },
  { id: "monthly", label: "Monthly", href: "/monthly", sub: "Ecosystem reports", logo: "/logos/marks/monthly.png", icon: "book", pages: [] },
  { id: "ongoing-test", label: "Ongoing Test", href: "/ongoing-test", sub: "Hands-on ecosystem tests and incentives", icon: "experiment", hidden: true, navigationOnly: true, pages: [{ href: "/ongoing-test/crosslink", label: "Crosslink", brandLogo: "/logos/shielded-labs.png" }] },
  { id: "private-chat", label: "Private Chat", href: "/private-chat", sub: "Private conversations via Nym · Experimental pilot", icon: "private-chat", pages: [] },
  { id: "openzcash-treasury", label: "OpenZcash Treasury", href: "/openzcash-treasury", sub: "Support the work · Follow the treasury", icon: "wallet", pages: [{ href: "/openzcash-treasury/letter", label: "An open letter", hidden: true, palette: true }] },
  { id: "lockbox", label: "Lockbox", href: "/lockbox", sub: "Live funding", logo: "/logos/marks/lockbox.png", icon: "shield", pages: [], hidden: true },
  { id: "nsm", label: "NSM", href: "/nsm", sub: "Sustainability balance", icon: "balance", pages: [], hidden: true },
  { id: "arborist", parentId: "ecosystem", parentGroup: "pages", label: "Arborist Calls", href: "/arborist", sub: "Protocol call archive", logo: "/logos/arborist.png", icon: "sigma", pages: [] },
  { id: "communities", parentId: "ecosystem", parentGroup: "pages", label: "Communities", href: "/communities", sub: "Global groups · live", logo: "/logos/communities.png", icon: "users", pages: [] },
  {
    id: "fpf",
    parentId: "ecosystem",
    label: "FPF",
    href: "/zcg/fpf",
    sub: "Program administrator",
    logo: "/logos/fpf.png",
    icon: "wallet",
    pages: [],
  },
  { id: "zf", parentId: "ecosystem", label: "Zcash Foundation", href: "/zf", sub: "Reports & Zcon", logo: "/logos/ecosystem/zcash-foundation.png", icon: "balance", pages: [] },
  {
    id: "zodl",
    parentId: "ecosystem",
    label: "ZODL",
    href: "/zodl",
    sub: "Zcash Open Development Lab",
    logo: "/logos/ecosystem/zodl-lab.png",
    icon: "terminal",
    pages: [],
  },
  { id: "shielded-labs", parentId: "ecosystem", label: "Shielded Labs", href: "/shielded-labs", sub: "Crosslink · NSM", logo: "/logos/shielded-labs.png", icon: "shield", pages: [] },
  {
    id: "zakura",
    parentId: "ecosystem",
    label: "Zakura",
    href: "/zakura",
    sub: "Full node · Valar & Tachyon",
    logo: "/logos/ecosystem/zakura.png",
    icon: "terminal",
    pages: [],
  },
  {
    id: "tachyon",
    parentId: "ecosystem",
    label: "Tachyon",
    href: "/tachyon",
    sub: "Protocol research",
    logo: "/logos/ecosystem/tachyon.png",
    icon: "terminal",
    pages: [],
  },
  {
    id: "zechub",
    parentId: "ecosystem",
    label: "ZecHub DAO",
    href: "/zechub",
    sub: "Latest proposals",
    logo: "/logos/zechub.png",
    icon: "globe",
    pages: [{ href: "/zechub/copilot", label: "ZecHub Copilot", mark: "/logos/glyphs/copilot.png" }],
  },
];

/** The app one level above this app in the navigation. */
export function parentAppOf(app: AppDef): AppDef | undefined {
  return app.parentId ? APPS.find((candidate) => candidate.id === app.parentId) : undefined;
}

/** Apps grouped beneath this app, in navigation order. */
export function childAppsOf(app: AppDef, apps: AppDef[] = APPS): AppDef[] {
  const children = apps.filter((candidate) => candidate.parentId === app.id);
  if (app.id !== "ecosystem") return children;
  const order = new Map(app.navigationOrder?.map((href, index) => [href, index]));
  return children.sort((a, b) => {
    const aDirect = a.parentGroup === "pages", bDirect = b.parentGroup === "pages";
    if (aDirect !== bDirect) return aDirect ? -1 : 1;
    return (order.get(a.href) ?? Infinity) - (order.get(b.href) ?? Infinity)
      || a.label.localeCompare(b.label, "en", { sensitivity: "base" });
  });
}

/** Detail routes and the list page they belong to. */
const DETAILS: Record<string, { parent: string; label: string }> = {
  "/ongoing-test/crosslink": { parent: "/opportunities", label: "Crosslink" },
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
  const opportunityLabel = pathname === "/opportunities/prepare" ? "Prepare an activity"
    : pathname === "/opportunities/platforms" ? "Platforms"
    : pathname === "/opportunities/art" ? "Art library"
    : pathname === "/opportunities/new" ? "Prepare an activity"
    : /^\/opportunities\/(campaigns|communities)\/new$/.test(pathname) ? (pathname.includes('/campaigns/') ? "Create campaign" : "Create community")
    : /^\/opportunities\/(tasks|campaigns|communities)\/[a-z0-9-]+$/.test(pathname) ? (pathname.includes('/tasks/') ? "Opportunity" : pathname.includes('/campaigns/') ? "Campaign" : "Organizer")
    : undefined;
  const detail = DETAILS[pathname] ?? (opportunityLabel ? {parent:"/opportunities",label:opportunityLabel} : undefined) ?? (/^\/ecosystem\/history\/[a-z0-9-]+$/.test(pathname)
    ? { parent: "/ecosystem/history", label: "Project history" }
    : /^\/legal\/read\/[a-z0-9-]+$/.test(pathname)
    ? { parent: "/legal", label: "Policy reading" }
    : /^\/coinholders\/proposals\/[1-9]\d*$/.test(pathname)
    ? { parent: "/coinholders/proposals", label: "Proposal detail" }
    : /^\/coinholders\/verify\/[a-z0-9-]+\/[^/]+$/.test(pathname)
    ? { parent: "/coinholders/verify", label: "Proposal detail" }
    : undefined);
  const target = detail ? detail.parent : pathname;
  for (const app of APPS) {
    // An app that opens a record by query (Zakura, ZODL, Tachyon) never
    // claims the plain path: /ecosystem belongs to the Ecosystem app.
    if (app.href.includes("?")) continue;
    const page = app.pages.find((p) => pathOf(p.href) === target);
    if (pathOf(app.href) === target && !detail) return { app };
    if (page) {
      const round = pathname.match(/^\/coinholders\/verify\/([a-z0-9-]+)\/[^/]+$/)?.[1];
      const parent = round ? { ...page, href: `${page.href}?round=${round}` } : page;
      return detail
        ? { app, page, detail: { parent, label: detail.label } }
        : { app, page };
    }
  }
  return undefined;
}

/** Back control: a detail returns to its list, a page to its app, an app to its parent or ZCG. */
export function backOf(pathname: string): { href: string; label: string } {
  const place = placeOf(pathname);
  if (!place) return { href: "/zcg", label: "ZCG" };
  if (place.detail) return { href: place.detail.parent.href, label: place.detail.parent.label };
  if (place.page && !place.app.navigationOnly) return { href: place.app.href, label: place.app.label };
  const parent = parentAppOf(place.app);
  if (parent) return { href: parent.href, label: parent.label };
  return { href: "/zcg", label: "ZCG" };
}

/** What ⌘K lists for an app: its overview unless that is one of its pages, then every page that is not hidden or opts in. */
/**
 * The app's own landing page as a listed "Overview" entry: apps with inner
 * pages get one, so the page behind the app's name is visible in the list
 * (unless one of the pages already is the landing page).
 */
export function overviewEntry(app: AppDef): AppPage | null {
  if (app.navigationOnly || !app.pages.length || app.pages.some((p) => p.href === app.href)) return null;
  return { href: app.href, label: "Overview", mark: "/logos/glyphs/overview.png" };
}

export function paletteEntries(app: AppDef): { href: string; label: string }[] {
  const landingIsPage = app.pages.some((p) => p.href === app.href);
  return [
    ...(landingIsPage || app.navigationOnly ? [] : [{ href: app.href, label: app.pages.length ? "Overview" : app.label }]),
    ...app.pages.filter((p) => !p.hidden || p.palette),
  ];
}

/** Grouped view of the same model, for directories and the design-review page. */
export const DESIGN_GROUPS = APPS.map((app) => ({
  name: app.label,
  description: app.sub,
  admin: app.admin ?? false,
  routes: [
    ...(app.navigationOnly || app.pages.some((p) => p.href === app.href) ? [] : [[app.href, app.pages.length ? "Overview" : app.label] as [string, string]]),
    ...app.pages.map((p) => [p.href, p.label] as [string, string]),
  ],
}));

export function designGroup(pathname: string) {
  const place = placeOf(pathname);
  return place ? DESIGN_GROUPS.find((g) => g.name === place.app.label) : undefined;
}
