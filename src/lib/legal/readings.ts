import reports from "../../../data/legal/reports.json";
import posts from "../../../data/legal/forum/posts.json";
import snapshots from "../../../data/legal/forum/snapshots.json";
import type { LegalFeed, LegalItem, LegalRegion, LegalSource } from "./types";
import { LEGAL_REGIONS, LEGAL_TOPICS } from "./types";

export const brazilDeskName = "Policy Brazil";

export const brazilReports = reports.map(record => {
  const item: LegalItem = {
    id: record.slug, title: record.title, summary: record.summary,
    url: record.original, contributor: record.author, sourceId: "brazil-reports", publishedAt: record.received,
    languages: record.english ? ["pt", "en"] : ["pt"],
    dateBasis: "received", regions: ["latam"], jurisdictions: ["Brazil"],
    topics: LEGAL_TOPICS.filter(topic => record.topics.includes(topic)),
    kind: "Country report", status: "Analysis",
  };
  return { item, record };
}).sort((a, b) => b.record.received.localeCompare(a.record.received));

export type ForumSnapshot = (typeof snapshots)[keyof typeof snapshots];
function snapshot(slug: string): ForumSnapshot | undefined {
  return Object.hasOwn(snapshots, slug) ? snapshots[slug as keyof typeof snapshots] : undefined;
}

export const forumReadings = posts.map(post => {
  const source = snapshot(post.slug);
  if (!source) throw new Error("Missing forum snapshot for " + post.slug);
  const regions = post.regions.map(region => {
    const known = LEGAL_REGIONS.find(r => r.id === region && r.id !== "all");
    if (!known) throw new Error("Unknown legal region " + region);
    return known.id as LegalRegion;
  });
  const item: LegalItem = {
    id: post.slug, title: post.title, summary: post.summary, contributor: source.author,
    url: "https://forum.zcashcommunity.com/t/" + post.topic + "/" + post.number,
    languages: ["en"], publishedAt: source.posted.slice(0, 10), sourceId: "divij-forum", regions,
    jurisdictions: post.jurisdictions, topics: ["Policy"], kind: "Forum post", status: "Analysis",
  };
  return { item, source };
}).sort((a, b) => b.source.posted.localeCompare(a.source.posted));

export function readingPath(item: LegalItem) {
  return "/legal/read/" + item.id;
}

const sources: LegalSource[] = [
  { id: "brazil-reports", name: brazilDeskName, url: "/legal?source=brazil-reports#updates", role: "Contributor analysis", mode: "curated" },
  { id: "divij-forum", name: "Divij Pandya · Zcash Community Forum", url: "https://forum.zcashcommunity.com/u/divijpandya/activity", role: "Advocacy & analysis", mode: "curated" },
];

/** Reading copies appear in search and regional tabs without entering the regulator archive. */
export function withLegalReadings(feed: LegalFeed): LegalFeed {
  const readings = [...brazilReports, ...forumReadings].map(entry => entry.item);
  return { ...feed, sources: [...feed.sources, ...sources],
    items: [...feed.items, ...readings.map(item => ({ ...item, reader: readingPath(item) }))] };
}
