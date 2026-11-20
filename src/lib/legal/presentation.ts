import type { LegalItem } from "./types";

export function legalDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : "Date not provided";
}
export function legalItemDate(item: LegalItem): string {
  const prefix = item.dateBasis === "received" ? "Received " : item.dateBasis === "updated" ? "Updated " : item.dateBasis === "reporting-period" ? "Week of " : item.dateBasis === "source-date" ? "Source date · " : "";
  return prefix + legalDate(item.publishedAt);
}
export function filterLegalItems(items: readonly LegalItem[], filters: { region?: string; topic?: string; q?: string; sourceId?: string }) {
  const words = (filters.q ?? "").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!filters.sourceId || item.sourceId === filters.sourceId)
    && (!filters.region || filters.region === "all" || item.regions.some(region => region === filters.region))
    && (!filters.topic || item.topics.some(topic => topic === filters.topic))
    && words.every(word => `${item.title} ${item.summary} ${item.contributor ?? ""} ${item.jurisdictions.join(" ")} ${item.topics.join(" ")}`.toLocaleLowerCase().includes(word)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}
