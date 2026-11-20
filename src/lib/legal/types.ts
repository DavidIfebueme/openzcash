export const LEGAL_REGIONS = [
  { id: "all", label: "All regions" },
  { id: "latam", label: "LATAM" },
  { id: "europe", label: "Europe" },
  { id: "north-america", label: "North America" },
  { id: "global", label: "Global" },
] as const;
export type LegalRegion = Exclude<(typeof LEGAL_REGIONS)[number]["id"], "all">;
export const LEGAL_TOPICS = ["Privacy", "Regulation", "Courts", "Policy"] as const;
export type LegalTopic = (typeof LEGAL_TOPICS)[number];
export type LegalStatus = "Analysis" | "Proposal" | "Consultation" | "Adopted" | "In force" | "Court decision" | "Official update";
export type ReadingLanguage = "en" | "pt" | "es";
export type LegalItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  reader?: string;
  languages?: ReadingLanguage[];
  contributor?: string;
  sourceId: string;
  publishedAt: string;
  /** Date semantics: publication, publisher update, memo week or labeled archive date. */
  dateBasis?: "published" | "updated" | "reporting-period" | "source-date" | "received";
  /** Publisher timestamp, separately preserved when a first-publication date exists. */
  sourceUpdatedAt?: string;
  /** A later observed source revision does not renew the earlier editorial review. */
  sourceChangedAt?: string;
  regions: LegalRegion[];
  jurisdictions: string[];
  topics: LegalTopic[];
  kind: "Country report" | "Forum post" | "Policy memo" | "Regulation" | "Court ruling" | "Consultation" | "Official update";
  status: LegalStatus;
  /** Dated statement of what the source establishes; not a country legality rating. */
  statusDetail?: string;
  effectiveAt?: string;
  /** Separate from publication date, e.g. the week discussed in a memo. */
  reportingPeriod?: string;
  reviewedAt?: string;
};
export type LegalSource = {
  id: string;
  name: string;
  url: string;
  role: "Contributor analysis" | "Advocacy & analysis" | "Primary authority";
  mode: "live" | "curated";
};
export type LegalFeed = {
  items: LegalItem[];
  sources: LegalSource[];
  fetchedAt: string | null;
  pgpStatus: "live" | "unavailable" | "cached";
  pgpLastSuccessAt: string | null;
  archive?: {
    status: "available" | "unavailable";
    lastReadAt: string | null;
    lastCollectedAt: string | null;
    itemCount: number;
    cadence: "daily";
    timeZone: "America/Sao_Paulo";
  };
  sourceHealth?: Array<{
    sourceId: string;
    status: "live" | "cached" | "unavailable";
    fetchedAt: string | null;
    lastSuccessAt: string | null;
  }>;
};
