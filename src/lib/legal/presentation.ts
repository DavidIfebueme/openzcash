import type { LegalItem, ReadingLanguage } from "./types";

export const readingLanguages = {
  en: { name: "English", flag: "🇺🇸" },
  pt: { name: "Português", flag: "🇧🇷" },
  es: { name: "Español", flag: "🇪🇸" },
} satisfies Record<ReadingLanguage, { name: string; flag: string }>;

export function isReadingLanguage(value: string | null): value is ReadingLanguage {
  return value !== null && Object.hasOwn(readingLanguages, value);
}

// Languages of the registered publication endpoints (including archived records).
const sourceLanguages: Partial<Record<string, ReadingLanguage>> = {
  pgp: "en", sec: "en", treasury: "en", bcb: "pt", rfb: "pt", aaip: "es", urcdp: "es", cnv: "es",
};

export function languagesOf(item: LegalItem): ReadingLanguage[] {
  if (item.languages) return item.languages;
  if (item.sourceId === "eurlex" && item.url.endsWith("/eng")) return ["en"];
  if (item.sourceId === "fatf" && item.url.includes("/en/")) return ["en"];
  const language = sourceLanguages[item.sourceId];
  return language ? [language] : [];
}

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
export function filterLegalItems(items: readonly LegalItem[], filters: { region?: string; topic?: string; q?: string; sourceId?: string; language?: ReadingLanguage }) {
  const words = (filters.q ?? "").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (!filters.sourceId || item.sourceId === filters.sourceId)
    && (!filters.region || filters.region === "all" || item.regions.some(region => region === filters.region))
    && (!filters.language || languagesOf(item).includes(filters.language))
    && (!filters.topic || item.topics.some(topic => topic === filters.topic))
    && words.every(word => `${item.title} ${item.summary} ${item.contributor ?? ""} ${item.jurisdictions.join(" ")} ${item.topics.join(" ")}`.toLocaleLowerCase().includes(word)))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}
