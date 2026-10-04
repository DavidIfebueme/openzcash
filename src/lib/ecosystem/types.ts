export type Source = { title: string; url: string };
export type FundingEvent = {
  /** A status update about an existing award is context, not another grant. */
  kind?: "grant" | "context";
  title: string;
  status: string;
  program?: "zcg" | "coinholder";
  date?: string | null;
  sourceUrl: string;
  repositoryEvidenceUrl?: string;
  scopeSourceUrl?: string;
  ledgerRecordedDate?: string;
  dateNote?: string;
  reviewedAt?: string;
  associationNote?: string;
  repositoryEvidenceKind?: string;
};
export type ProjectNotice = {
  kind: "support" | "capability";
  label: string;
  summary: string;
  sourceUrl: string;
  date: string;
  // Only these stable GitHub identities inherit this project notice.
  repositoryIds?: string[];
};
export type RepositoryClassification = {
  repositoryId: string;
  repository: string;
  category: string;
  tags: string[];
  rationale: string;
  sourceUrl: string;
  checkedAt: string;
};
export type Organization = {
  id: string;
  name: string;
  githubOwners: string[];
  description: string;
  website: string;
  funding: {
    label: string;
    status: string;
    history: { label: string; program?: string; from?: string | null; until?: string | null; sourceUrl: string }[];
  };
  sources: Source[];
};
export type Project = {
  /** Date of an individual identity review; registry date remains the default. */
  checkedAt?: string;
  id: string;
  name: string;
  organizationId: string | null;
  category: string;
  tags: string[];
  description: string;
  website: string;
  repositories: string[];
  funding: { label: string; status: string; events: FundingEvent[]; scopeNote?: string };
  sources: Source[];
  logo?: string | null;
  stage?: string;
  relatedProjectIds?: string[];
  notices?: ProjectNotice[];
};
export type Registry = {
  schemaVersion: number;
  checkedAt: string;
  organizations: Organization[];
  projects: Project[];
  repositoryClassifications?: RepositoryClassification[];
  owners: { login: string; scope: string; sourceUrl: string }[];
  selectedRepositories: string[];
  coverageNotes: string[];
  grantReview: {
    totalApproved: number;
    classification: { title: string; sourceUrl: string; kind: string; projectId?: string | null; reason?: string }[];
    unresolved: { title: string; sourceUrl: string; reason: string }[];
  };
};
export type Release = {
  name: string | null;
  tagName: string;
  publishedAt: string;
  url: string;
  isPrerelease: boolean;
};
export type Repository = {
  id: string;
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string;
  homepage: string | null;
  archived: boolean;
  fork: boolean;
  disabled: boolean;
  language: string | null;
  topics: string[];
  stars: number;
  createdAt: string;
  pushedAt: string | null;
  defaultBranch: string | null;
  sourceUrl: string;
  aliases: string[];
  activity: {
    checkedAt: string;
    since: Record<string, string>;
    commits: Record<string, number | null>;
    latestRelease: Release | null;
    releases: Release[];
    /** All public release records fetched through checkedAt; absent on older snapshots. */
    releaseHistory?: Release[];
    /** Previously observed releases absent from the current public listing, not current release claims. */
    unlistedReleases?: (Release & { lastObservedAt: string; missingAsOf: string })[];
    sourceUrl: string;
  } | null;
};
export type Snapshot = {
  schemaVersion: number;
  collectedAt: string;
  registryHash: string;
  owners: {
    login: string;
    type: string;
    complete: boolean;
    pages: number;
    repositoryCount: number;
    collectedAt: string | null;
    sourceUrl: string;
    identitySource: string;
  }[];
  repositories: Repository[];
  problems: { scope: string; message: string }[];
  selectedRepositoryCount: number;
};
export type Catalog = { registry: Registry; snapshot: Snapshot };
export type ClassifiedRepository = Repository & {
  projects: Project[];
  organization: Organization | null;
  category: string;
  classification: "reviewed" | "project-associated" | "inferred";
  review: RepositoryClassification | null;
  notices: ProjectNotice[];
  tags: string[];
};
