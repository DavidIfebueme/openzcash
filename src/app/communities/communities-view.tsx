"use client";

import { useMemo, useState } from "react";
import { CommunityMark } from "@/components/communities/community-mark";
import { Stat } from "@/components/ui";
import type { Community, CommunityLinks, Region } from "@/lib/communities/data";
import type { TopicActivity } from "@/lib/communities/forum-activity";
import type { FundingSource } from "@/lib/communities/ledger-funding";
import {
  daoLine,
  daoTitle,
  fundingBadges,
  fundingSummary,
  fundingTitle,
  matchesFunding,
  noneTitle,
  paidLine,
  paidLineTitle,
  type FundingFilter,
} from "@/lib/communities/funding-display";
import { matchesQuery } from "@/lib/communities/search";
import { cn } from "@/lib/utils";
import styles from "./communities.module.css";

/**
 * Client view for /communities, designed as an assessment surface for the
 * ZCG committee: a single dense ledger-style list, ordered by most recent
 * forum activity, with a recency signal per row (green ≤7d, amber ≤30d,
 * grey = quiet). Filters and the list are the whole page; totals sit at
 * the bottom.
 */

/** Channel order in the directory line; the key is the links field. */
const CHANNELS = [
  ["x", "X"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["youtube", "YouTube"],
  ["telegram", "Telegram"],
  ["discord", "Discord"],
  ["whatsapp", "WhatsApp"],
  ["facebook", "Facebook"],
  ["linkedin", "LinkedIn"],
  ["bluesky", "Bluesky"],
  ["substack", "Substack"],
  ["medium", "Medium"],
  ["linktree", "Linktree"],
  ["site", "Site"],
] as const satisfies readonly (readonly [keyof CommunityLinks, string])[];

const REGIONS: Region[] = [
  "Africa",
  "North America",
  "Latin America",
  "Asia",
  "Europe",
  "Middle East",
  "Global",
];

type SortMode = "activity" | "name" | "region";

const FUNDING_OPTIONS = [
  ["all", "All"],
  ["zcg", "ZCG-funded"],
  ["dao", "ZecHub DAO"],
  ["none", "No funding"],
] as const satisfies readonly (readonly [FundingFilter, string])[];

const SORT_OPTIONS = [
  ["activity", "Latest activity"],
  ["name", "Name"],
  ["region", "Region"],
] as const satisfies readonly (readonly [SortMode, string])[];

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function timeAgo(iso: string): string {
  const days = daysSince(iso);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Recency signal: the committee's at-a-glance "is this group alive".
 * Calibrated to a monthly reporting cadence: a community whose latest
 * report is 3 weeks old is on schedule, not idle.
 */
function RecencyDot({ iso }: { iso?: string }) {
  const days = iso ? daysSince(iso) : Infinity;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        days <= 35
          ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
          : days <= 90
            ? "bg-amber-400"
            : "bg-stone-300",
      )}
      title={
        days === Infinity
          ? "No tracked forum activity"
          : `Last forum activity ${timeAgo(iso!)}`
      }
    />
  );
}

/** Gold shield for the OGs: communities with five or more years of verified
 * public record. Computed from `since`, so entries age into it on their own. */
function OgShield({ since }: { since?: number }) {
  if (!since) return null;
  const years = new Date().getFullYear() - since;
  if (years < 5) return null;
  return (
    <span
      title={`OG community: ${years} years of verified public record (since ${since})`}
      className="inline-flex shrink-0 items-center"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="url(#og-gold)"
        stroke="#92400e"
        strokeWidth="1.4"
        aria-label="OG community, five or more years"
      >
        <defs>
          <linearGradient id="og-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path d="M12 2l8 3.5v5.2c0 5-3.4 8.6-8 11.3-4.6-2.7-8-6.3-8-11.3V5.5L12 2z" />
      </svg>
    </span>
  );
}

export function CommunitiesView({
  communities,
  activity,
  fundingSource,
  fallbackAsOf,
}: {
  communities: Community[];
  activity: TopicActivity[];
  /** Whether the funding figures are live from the ledger or the dated
   *  curated fallback (ledger unreachable). */
  fundingSource: FundingSource;
  /** Ledger date of the fallback figures. */
  fallbackAsOf: string;
}) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<Region | "all">("all");
  const [funding, setFunding] = useState<FundingFilter>("all");
  const [sort, setSort] = useState<SortMode>("activity");

  const lastByCommunity = useMemo(() => {
    const m = new Map<string, TopicActivity>();
    for (const a of activity)
      if (!m.has(a.communityId)) m.set(a.communityId, a);
    return m;
  }, [activity]);

  const shown = useMemo(() => {
    const filtered = communities.filter(
      (c) =>
        matchesQuery(c, query) &&
        (region === "all" || c.region === region) &&
        matchesFunding(c.zcg, funding),
    );
    const key = (c: Community) =>
      lastByCommunity.get(c.id)?.lastPostedAt ?? "0000";
    if (sort === "name")
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "region")
      return [...filtered].sort(
        (a, b) =>
          a.region.localeCompare(b.region) || key(b).localeCompare(key(a)),
      );
    return [...filtered].sort((a, b) => key(b).localeCompare(key(a)));
  }, [communities, region, funding, sort, lastByCommunity, query]);

  const fundingCounts = Object.fromEntries(
    FUNDING_OPTIONS.map(([key]) => [
      key,
      communities.filter((c) => matchesFunding(c.zcg, key)).length,
    ]),
  ) as Record<FundingFilter, number>;
  const funded = communities.filter((c) => c.zcg.funded);
  const totalBudgeted = funded.reduce(
    (s, c) => s + (c.zcg.budgetedUsd ?? 0),
    0,
  );
  const countries = new Set(
    communities.filter((c) => c.country !== "Global").map((c) => c.country),
  ).size;
  const activeMonth = communities.filter((c) => {
    const l = lastByCommunity.get(c.id);
    return l && daysSince(l.lastPostedAt) <= 35;
  }).length;

  return (
    <>
      {/* ---- Totals, at the bottom ---- */}
      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Communities" value={String(communities.length)} />
        <Stat label="Countries" value={String(countries)} />
        <Stat
          label="Active this month"
          value={`${activeMonth} of ${communities.length}`}
        />
        <Stat
          label="ZCG-funded"
          value={`${funded.length} of ${communities.length}`}
          sub={fundingSummary(totalBudgeted, fundingSource, fallbackAsOf)}
          tone="warn"
        />
      </section>
      {/* ---- Filters + sort: one quiet row, the count below ---- */}
      <div className={styles.filterBar}>
        <div className={styles.filterControls}>
          <label className={`ws-field ${styles.filterSearch}`}>
            <span aria-hidden>⌕</span>
            <input
              type="search"
              aria-label="Search communities"
              placeholder="Find a community or country…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className={`${styles.filterSelect} ${styles.region}`}>
            <span>Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region | "all")}
            >
              <option value="all">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div
            className={styles.segmented}
            role="group"
            aria-label="Filter by funding"
          >
            {FUNDING_OPTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={styles.segment}
                aria-pressed={funding === key}
                onClick={() => setFunding(key)}
              >
                {label}{" "}
                <span className={styles.segmentCount}>
                  {fundingCounts[key]}
                </span>
              </button>
            ))}
          </div>
          <label className={`${styles.filterSelect} ${styles.sort}`}>
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              {SORT_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.filterFoot}>
          <p className={styles.filterCount} aria-live="polite">
            {shown.length === communities.length
              ? `${communities.length} communities`
              : `${shown.length} of ${communities.length} communities`}
          </p>
        </div>
      </div>

      {/* ---- The assessment list ---- */}
      <div className={`ws-community-directory ${styles.directory}`}>
        <div className="sr-only">
          {["Community", "Latest forum activity", "Funding", "Channels"].map(
            (h) => (
              <p
                key={h}
                className="text-[11px] font-semibold uppercase tracking-wider text-stone-500"
              >
                {h}
              </p>
            ),
          )}
        </div>

        <ul className="ws-community-grid">
          {shown.map((c) => {
            const last = lastByCommunity.get(c.id);
            const paid = paidLine(c.zcg, fundingSource);
            const dao = daoLine(c.zcg);
            return (
              <li key={c.id} className={`ws-community-card ${styles.card}`}>
                {/* Community */}
                <div className="flex items-center gap-3">
                  <CommunityMark community={c} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <span className="truncate">{c.name}</span>
                      <OgShield since={c.since} />
                      <RecencyDot iso={last?.lastPostedAt} />
                    </p>
                    <p
                      className="truncate text-[11px] text-stone-500"
                      title={
                        c.localName ? `Also known as ${c.localName}` : undefined
                      }
                    >
                      {c.country} · {c.language}
                      {c.since ? (
                        <span className="text-stone-400">
                          {" "}
                          · since {c.since}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                {/* Latest activity */}
                <div className="min-w-0">
                  {last ? (
                    <a
                      href={last.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block"
                    >
                      <p className="truncate text-xs font-medium text-stone-800 group-hover:text-amber-800">
                        {last.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-500">
                        <span
                          className={cn(
                            "font-semibold tnum",
                            daysSince(last.lastPostedAt) <= 35
                              ? "text-emerald-700"
                              : daysSince(last.lastPostedAt) <= 90
                                ? "text-amber-700"
                                : "text-stone-500",
                          )}
                        >
                          {timeAgo(last.lastPostedAt)}
                        </span>{" "}
                        ·{" "}
                        {last.source === "forum"
                          ? `forum ${last.kind} · ${last.postsCount} posts`
                          : last.source === "youtube"
                            ? "YouTube upload"
                            : "Telegram post"}
                      </p>
                    </a>
                  ) : (
                    <p className="text-[11px] text-stone-400">
                      No tracked activity (forum, YouTube, Telegram)
                    </p>
                  )}
                </div>

                {/* Funding */}
                <div>
                  <div className="flex flex-wrap gap-1">
                    {fundingBadges(c.zcg).map((badge) =>
                      badge === "zcg" ? (
                        <span
                          key={badge}
                          className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-500/25"
                          title={fundingTitle(
                            c.zcg,
                            fundingSource,
                            fallbackAsOf,
                          )}
                        >
                          ZCG-funded
                        </span>
                      ) : badge === "dao" ? (
                        <span
                          key={badge}
                          className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-500/25"
                          title={daoTitle(c.zcg)}
                        >
                          ZecHub DAO
                        </span>
                      ) : (
                        <span
                          key={badge}
                          className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 ring-1 ring-inset ring-stone-200"
                          title={noneTitle(c.zcg)}
                        >
                          No funding
                        </span>
                      ),
                    )}
                  </div>
                  {paid ? (
                    <p
                      className="mt-1 text-[10px] leading-snug text-stone-500 tnum"
                      title={paidLineTitle(c.zcg)}
                    >
                      {dao ? `ZCG ${paid}` : paid}
                    </p>
                  ) : null}
                  {dao ? (
                    <p
                      className={cn(
                        "text-[10px] leading-snug text-stone-500 tnum",
                        paid ? "mt-0.5" : "mt-1",
                      )}
                      title={daoTitle(c.zcg)}
                    >
                      <a
                        href={dao.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-stone-600 hover:text-amber-800"
                      >
                        DAO {dao.ref}
                      </a>{" "}
                      · {dao.text}
                      {dao.asOf ? ` · ${dao.asOf}` : ""}
                    </p>
                  ) : null}
                  {c.zcg.note ? (
                    <p className="mt-1 hidden max-w-[150px] text-[10px] leading-snug text-stone-400 md:line-clamp-2">
                      {c.zcg.note}
                    </p>
                  ) : null}
                </div>

                {/* Channels: every official account, links only where no
                    public feed exists (X, Instagram, TikTok, Facebook). */}
                <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-medium">
                  {CHANNELS.filter(([key]) => c.links[key]).map(
                    ([key, label]) => (
                      <a
                        key={key}
                        className="text-stone-600 hover:text-amber-800"
                        href={c.links[key]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {label}
                      </a>
                    ),
                  )}
                  {c.links.forumUser ? (
                    <a
                      className="text-stone-600 hover:text-amber-800"
                      href={`https://forum.zcashcommunity.com/u/${c.links.forumUser}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{c.links.forumUser}
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
          {shown.length === 0 ? (
            <li className="py-10 text-center text-sm text-stone-500">
              No communities match these filters.
            </li>
          ) : null}
        </ul>
      </div>
    </>
  );
}
