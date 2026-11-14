import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { zcgChangelog, zcgDisbursements, zcgProposals } from "@/lib/db/schema";
import { getZechubProposals } from "@/lib/dao/zechub";
import { getGrantApplications } from "@/lib/zcg/github-applications";
import { mergeNews } from "./merge";
import { NEWS_REFRESH_MS } from "./config";
import { NEWS_GITHUB_REPOSITORIES, readGitHubNews, githubNewsHealth } from "./github";
import { LATE_RECORD_MAX_MS, sheetNewsItems, type RecordedPayment } from "./sheet";
export { githubNewsHealth, githubNewsBehind } from "./github";

/**
 * Cross-source "what's new" feed: the Zcash forum (Discourse), GitHub releases
 * of the core repos, and the latest rows from the ZCG spreadsheet (already
 * mirrored in our DB by the accounting schedule). Public submissions and forum
 * topics are checked every five minutes by the server, even without visitors. No DB table — "unread" is computed per-visitor from the
 * item timestamps vs a localStorage "last seen" marker.
 */

export type NewsSource =
  "forum" | "github" | "sheet" | "proposal" | "dao" | "application";

export type NewsReference = {
  source: Exclude<NewsSource, "application">;
  url: string;
  publishedAt?: string;
};

export type NewsItem = {
  /** Source-native record identity; multiple events can share a destination URL. */
  id: string;
  source: NewsSource;
  kind: string;
  title: string;
  url: string;
  ts: string; // ISO 8601 (normalized to milliseconds for stable ordering)
  /** Forum username of the original poster, when the source exposes one.
   * Lets the UI badge an item with the community that published it. */
  author?: string;
  references?: NewsReference[];
  program?: "zcg" | "coinholder";
};

/**
 * How far back the feed goes. "News" means the last week: older ledger rows
 * and proposals still exist on their own pages, and letting them linger here
 * turned the list into a month-long archive that contradicted its own label.
 */
const NEWS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** A payment recorded this week may have been paid up to this long ago. */
const SHEET_LOOKBACK_MS = NEWS_WINDOW_MS + LATE_RECORD_MAX_MS;
/**
 * Safety bound only; the lookback holds roughly a hundred paid rows. Both
 * queries read newest first, so reaching it would drop the oldest records.
 */
const SHEET_ROW_LIMIT = 500;
type FeedStore = {
  cache: { at: number; items: NewsItem[] } | null;
  inflight: Promise<NewsItem[]> | null;
  sources: Map<string, { items: NewsItem[]; failed: boolean }>;
  attemptedAt: number;
  scheduled?: boolean;
};
// Instrumentation, page and summary API bundles must share one snapshot/job.
const globalStore = globalThis as typeof globalThis & { __openZcashNewsFeed?: FeedStore };
const store: FeedStore = globalStore.__openZcashNewsFeed ??= { cache: null, inflight: null, sources: new Map(), attemptedAt: 0 };

async function readSource(key: string, read: () => Promise<NewsItem[]>): Promise<NewsItem[]> {
  try {
    const items = await read();
    store.sources.set(key, { items, failed: false });
    return items;
  } catch {
    const items = store.sources.get(key)?.items ?? [];
    store.sources.set(key, { items, failed: true });
    console.error(`[news] ${key} refresh failed; ${items.length ? "keeping last successful response" : "no previous response"}`);
    return items;
  }
}

export function newsUnavailableSources(): string[] {
  return [...store.sources].filter(([, state]) => state.failed).map(([key]) => key);
}

const FORUM = "https://forum.zcashcommunity.com";
const FORUM_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000; // surface topics from ~4 months

function iso(s: string): string {
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

async function fetchForum(): Promise<NewsItem[]> {
  const res = await fetch(`${FORUM}/latest.json`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(7_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Forum unavailable");
  const j = (await res.json()) as {
    users?: Array<{ id: number; username: string }>;
    topic_list?: {
      topics?: Array<{
        id: number;
        title: string;
        slug: string;
        created_at: string;
        posters?: Array<{ user_id: number }>;
      }>;
    };
  };
  if (!Array.isArray(j.topic_list?.topics)) throw new Error("Invalid forum response");
  const byId = new Map((j.users ?? []).map((u) => [u.id, u.username]));
  const cutoff = Date.now() - FORUM_MAX_AGE_MS;
  return (j.topic_list?.topics ?? [])
    .filter((t) => t.created_at && Date.parse(t.created_at) > cutoff)
    .map((t) => ({
      id: `forum:${t.id}`,
      source: "forum" as const,
      kind: "Forum",
      title: t.title,
      url: `${FORUM}/t/${t.slug}/${t.id}`,
      ts: iso(t.created_at),
      author: byId.get(t.posters?.[0]?.user_id ?? -1),
    }));
}

/**
 * When the ledger recorded each payment, from the changelog. Without it the
 * feed still lists the payments, dated by their paid-out date.
 */
async function readRecordedPayments(since: Date): Promise<RecordedPayment[]> {
  try {
    return await getDb()
      .select({
        title: zcgChangelog.title,
        detail: zcgChangelog.detail,
        at: zcgChangelog.at,
      })
      .from(zcgChangelog)
      .where(and(eq(zcgChangelog.kind, "payment"), gte(zcgChangelog.at, since)))
      .orderBy(desc(zcgChangelog.at))
      .limit(SHEET_ROW_LIMIT);
  } catch {
    console.error("[news] payment record history unavailable; dating payments by paid-out date");
    return [];
  }
}

async function fetchSheet(): Promise<NewsItem[]> {
  const since = new Date(Date.now() - SHEET_LOOKBACK_MS);
  const [rows, recorded] = await Promise.all([
    getDb()
      .select({
        id: zcgDisbursements.id,
        recipient: zcgDisbursements.recipientNameRaw,
        usd: zcgDisbursements.amountUsdCents,
        paid: zcgDisbursements.paidOutDate,
        project: zcgDisbursements.project,
        isTest: zcgDisbursements.isTest,
      })
      .from(zcgDisbursements)
      .where(
        and(
          eq(zcgDisbursements.isPaid, true),
          gte(zcgDisbursements.paidOutDate, since.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(desc(zcgDisbursements.paidOutDate))
      .limit(SHEET_ROW_LIMIT),
    readRecordedPayments(since),
  ]);
  return sheetNewsItems(rows, recorded);
}

async function fetchProposals(): Promise<NewsItem[]> {
  const rows = await getDb()
    .select({
      id: zcgProposals.id,
      title: zcgProposals.title,
      program: zcgProposals.program,
      submitted: zcgProposals.submittedDate,
      forum: zcgProposals.forumLink,
      platform: zcgProposals.platformLink,
    })
    .from(zcgProposals)
    .orderBy(desc(zcgProposals.submittedDate))
    .limit(14);
  return rows
    .filter((r) => r.submitted)
    .map((r) => ({
      id: `proposal:${r.id}`,
      source: "proposal" as const,
      kind: r.program === "coinholder" ? "FPF proposal" : "ZCG proposal",
      program: r.program === "coinholder" ? "coinholder" as const : "zcg" as const,
      title: r.title,
      url: r.forum || r.platform || "/zcg/proposals",
      ts: iso(`${r.submitted}T00:00:00Z`),
      references: [r.platform, r.forum].filter((url): url is string => !!url).map(url => ({
        source: url.startsWith("https://github.com/") ? "github" as const :
          /^https:\/\/forum\.(?:zcashcommunity\.com|z\.cash)\//.test(url) ? "forum" as const : "proposal" as const,
        url,
      })),
    }));
}

/** Newest ZecHub DAO proposals (DAO DAO on Juno), surfaced as news items. */
async function fetchDao(): Promise<NewsItem[]> {
  const proposals = await getZechubProposals(12);
  return proposals
    .filter((p) => p.createdAt)
    .map((p) => ({
      id: `dao:${p.url}`,
      source: "dao" as const,
      kind: "ZecHub DAO",
      title: `${p.ref} · ${p.title}`,
      url: p.url,
      ts: iso(p.createdAt),
    }));
}

/** Newest ZCG grant applications (GitHub issues), surfaced first-hand. */
async function fetchApplications(): Promise<NewsItem[]> {
  const apps = await getGrantApplications(40, { fresh: true });
  return apps.map((a) => ({
    id: `application:${a.url}`,
    source: "application" as const,
    kind: "ZCG proposal",
    program: "zcg" as const,
    title: a.title,
    url: a.url,
    ts: iso(a.createdAt),
    author: a.applicant,
  }));
}

export async function getNews(): Promise<NewsItem[]> {
  const now = Date.now();
  if (store.cache && now - store.attemptedAt < NEWS_REFRESH_MS) return store.cache.items;
  if (store.inflight) return store.cache ? store.cache.items : store.inflight;
  store.attemptedAt = now;
  store.inflight = (async () => {
    try {
      return await refreshNews(now);
    } finally {
      store.inflight = null;
    }
  })();
  return store.cache ? store.cache.items : store.inflight;
}

async function refreshNews(now: number): Promise<NewsItem[]> {
  const [forum, sheet, proposals, dao, apps, ...repos] = await Promise.all([
    readSource("Forum", fetchForum),
    readSource("Spreadsheet", fetchSheet),
    readSource("Proposals mirror", fetchProposals),
    readSource("ZecHub DAO", fetchDao),
    readSource("GitHub proposals", fetchApplications),
    ...NEWS_GITHUB_REPOSITORIES.map(readGitHubNews),
  ]);
  // Guard against future-dated source rows (e.g. a spreadsheet typo): one item
  // dated months ahead becomes `latest`, poisons every visitor's last-seen
  // marker, and the unread badge never fires again until that date passes.
  const maxTs = new Date(now + 48 * 3600 * 1000).toISOString();
  const minTs = new Date(now - NEWS_WINDOW_MS).toISOString();
  const items = [
    ...forum,
    ...sheet,
    ...proposals,
    ...dao,
    ...apps,
    ...repos.flat(),
  ]
    .filter((i) => i.ts && i.ts <= maxTs && i.ts >= minTs)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  // Merge before limiting so both source links survive at the feed boundary.
  const merged = mergeNews(items).slice(0, 60);
  const anySuccess = [...store.sources.values()].some(source => !source.failed) ||
    githubNewsHealth().some(source => source.status === "live");
  store.cache = { at: anySuccess ? now : (store.cache?.at ?? now), items: merged };
  return merged;
}

/** The always-on web service collects independently of page visits. */
export function startNewsSchedule(): void {
  if (store.scheduled) return;
  store.scheduled = true;
  const run = () => {
    void getNews().catch(() => console.error("[news] scheduled refresh failed"));
  };
  setTimeout(run, 5_000).unref();
  // Poll the TTL frequently to avoid an almost-fresh read skipping a full cycle.
  setInterval(run, 15_000).unref();
}

/** How far back the badge counts for a visitor with no last-seen marker. */
const FIRST_VISIT_WINDOW_MS = 48 * 3600 * 1000;

/** When the in-process snapshot was taken, for the "updated" line. */
export function newsFetchedAt(): number | null {
  return store.cache?.at ?? null;
}

/**
 * Number of items newer than the visitor's last-seen ISO timestamp. First-time
 * visitors (no marker) get the recent window only — "today's news", not the
 * whole 60-item history as one scary 9+ badge.
 */
export function unreadCount(items: NewsItem[], since: string | null): number {
  const floor =
    since ?? new Date(Date.now() - FIRST_VISIT_WINDOW_MS).toISOString();
  return items.filter((i) => i.ts > floor).length;
}

/** Server wall-clock, kept out of component render bodies (purity lint). */
export function nowMs(): number {
  return Date.now();
}
