"use client";
import { isPreviewRelease } from "@/lib/ecosystem/releases";

import Link from "next/link";
import { Card, Stat } from "@/components/ui";
import { OrgHeader } from "@/components/org-header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ecosystemCatalogFilters, updateEcosystemCatalogSearch } from "@/lib/ecosystem/overview-route";
import type {
  Catalog,
  ClassifiedRepository,
  FundingEvent,
  Organization,
  Project,
  ProjectNotice,
  Source,
} from "@/lib/ecosystem/types";
import {
  activitySummary,
  classifyRepositories,
  displayDate,
  filterProjects,
  filterRepositories,
  fundingProgramLabel,
  isGrantFunded,
  normalizeTags,
  relatedRepositories,
  repositoryOwners,
  safeExternalUrl,
  sharedRepositoryFunding,
} from "@/lib/ecosystem/catalog";
import styles from "./explorer.module.css";
import {
  brandLabel,
  organizationBrand,
  projectBrand,
  repositoryBrand,
  type Brand,
} from "./branding";
import { BrandMark, CategoryBadge } from "./identity";
import { categoryStyle } from "./presentation";

type Mode = "ecosystem" | "development";
const isDevelopmentMode = (mode: Mode) => mode === "development";
type Selection =
  | { kind: "project"; value: Project }
  | { kind: "repository"; value: ClassifiedRepository }
  | { kind: "organization"; value: Organization };
const number = new Intl.NumberFormat("en-US");

function External({
  url,
  children,
  className,
}: {
  url: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const safe = safeExternalUrl(url);
  return safe ? (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );
}

function Badge({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span className={styles.badge + (muted ? " " + styles.mutedBadge : "")}>
      {!muted && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )}
      {children}
    </span>
  );
}

function brandSources(brand: Brand | null): Source[] {
  return brand
    ? [{ title: brandLabel(brand) + " source", url: brand.sourceUrl }]
    : [];
}

function NoticeBadges({ notices = [] }: { notices?: ProjectNotice[] }) {
  return (
    <>
      {notices
        .filter((notice) => notice.kind === "support")
        .map((notice) => (
          <span key={notice.sourceUrl} className={styles.noticeBadge}>
            {notice.label}
          </span>
        ))}
    </>
  );
}

function Notices({ notices = [] }: { notices?: ProjectNotice[] }) {
  return (
    <>
      {notices.map((notice) => (
        <div className={styles.notice} role="note" key={notice.sourceUrl}>
          <strong>{notice.label}</strong>
          <p>{notice.summary}</p>
          <External url={notice.sourceUrl}>
            Source · {displayDate(notice.date)} ↗
          </External>
        </div>
      ))}
    </>
  );
}

function FundingEvents({ events }: { events: FundingEvent[] }) {
  if (!events.length)
    return <p>No project-specific funding decision mapped in this catalog.</p>;
  return (
    <>
      {events.map((event, index) => (
        <div
          className={styles.event}
          key={event.sourceUrl + event.title + index}
        >
          <strong>{event.title}</strong>
          <div className={styles.small}>
            {fundingProgramLabel(event.program) &&
              fundingProgramLabel(event.program) + " · "}
            {event.status} · {displayDate(event.date)}
          </div>
          {event.dateNote && (
            <div className={styles.small}>{event.dateNote}</div>
          )}
          <External url={event.sourceUrl}>Decision source ↗</External>
          {event.scopeSourceUrl && (
            <>
              {" "}
              ·{" "}
              <External url={event.scopeSourceUrl}>Proposal scope ↗</External>
            </>
          )}
          {event.repositoryEvidenceUrl && (
            <>
              {" "}
              ·{" "}
              <External url={event.repositoryEvidenceUrl}>
                Repository association ↗
              </External>
            </>
          )}
          {event.associationNote && (
            <div className={styles.small}>{event.associationNote}</div>
          )}
        </div>
      ))}
      <p>
        These are recorded funding decisions. An approval does not establish
        payment, delivery or continuing support.
      </p>
    </>
  );
}

function ProjectFunding({ project }: { project: Project }) {
  return (
    <>
      <FundingEvents events={project.funding.events} />
      {project.funding.scopeNote && <p>{project.funding.scopeNote}</p>}
    </>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  const unique = sources.filter(
    (source, index) =>
      sources.findIndex((other) => other.url === source.url) === index,
  );
  return (
    <div className={styles.dialogLinks}>
      {unique.map((source) => (
        <External key={source.url} url={source.url}>
          {source.title} ↗
        </External>
      ))}
    </div>
  );
}

function OrganizationFunding({ organization }: { organization: Organization }) {
  return (
    <>
      <p>{organization.funding.label}</p>
      {organization.funding.history.map((event, index) => (
        <div className={styles.event} key={event.sourceUrl + index}>
          <strong>{event.label}</strong>
          <div className={styles.small}>
            {event.program}
            {event.from ? " · " + displayDate(event.from) : ""}
            {event.until ? " — " + displayDate(event.until) : ""}
          </div>
          <External url={event.sourceUrl}>Funding source ↗</External>
        </div>
      ))}
    </>
  );
}

export function DetailDialog({
  selection,
  close,
  repositories,
  organizations,
  projects,
  onProjectNavigate,
}: {
  selection: Selection | null;
  close: () => void;
  repositories: ClassifiedRepository[];
  organizations: Organization[];
  projects: Project[];
  onProjectNavigate?: (project: Project) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (selection && dialog && !dialog.open) dialog.showModal();
    if (!selection && dialog?.open) dialog.close();
  }, [selection]);
  const title =
    selection?.kind === "repository"
      ? selection.value.fullName
      : selection?.value.name;
  const brand = !selection
    ? null
    : selection.kind === "project"
      ? projectBrand(selection.value)
      : selection.kind === "repository"
        ? repositoryBrand(selection.value)
        : organizationBrand(selection.value.id);
  const category =
    selection && selection.kind !== "organization"
      ? selection.value.category
      : "Other";
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={close}
      aria-labelledby="catalog-dialog-title"
      onClick={(event) => {
        if (event.target !== ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      <div className={styles.dialogHeader}>
        <div className={styles.dialogTitle}>
          {selection && <BrandMark brand={brand} category={category} />}
          <h2 id="catalog-dialog-title">{title}</h2>
        </div>
        <button type="button" onClick={close} aria-label="Close details">
          ×
        </button>
      </div>
      {selection?.kind === "project" &&
        (() => {
          const project = selection.value;
          const repos = relatedRepositories(project, repositories);
          const org = organizations.find(
            (item) => item.id === project.organizationId,
          );
          const sharedFunding = !isGrantFunded(project)
            ? sharedRepositoryFunding(project, repositories)
            : [];
          return (
            <>
              <div className={styles.badges}>
                <CategoryBadge category={project.category} />
                {normalizeTags(project.tags).map((tag) => (
                  <Badge key={tag} muted>
                    {tag}
                  </Badge>
                ))}
              </div>
              <Notices notices={project.notices} />
              <p>{project.description}</p>
              <div className={styles.dialogLinks}>
                <External url={project.website}>Project website ↗</External>
                <Link
                  href={
                    "/development?project=" + encodeURIComponent(project.id)
                  }
                >
                  View development →
                </Link>
              </div>
              <h3>GitHub repositories · {repos.length}</h3>
              {repos.map((repo) => (
                <div className={styles.event} key={repo.id}>
                  <External url={repo.url}>
                    <strong>{repo.fullName} ↗</strong>
                  </External>
                  <div className={styles.small}>
                    {repo.language || "Language not reported"}
                    {repo.archived ? " · Archived" : ""}
                    {repo.fork ? " · Fork" : ""}
                    {" · Last push " + displayDate(repo.pushedAt)}
                  </div>
                </div>
              ))}
              {!repos.length && (
                <p>
                  No GitHub repository with verified current metadata is
                  associated. Other public source links appear below.
                </p>
              )}
              {!!project.relatedProjectIds?.length && (
                <>
                  <h3>Related components</h3>
                  <div className={styles.dialogLinks}>
                    {projects
                      .filter((item) =>
                        project.relatedProjectIds!.includes(item.id),
                      )
                      .map((item) => (
                        <Link
                          key={item.id}
                          href={
                            "/development?project=" +
                            encodeURIComponent(item.id)
                          }
                        >
                          {item.name} →
                        </Link>
                      ))}
                  </div>
                </>
              )}
              <div className={styles.dialogLinks}><Link href={`/ecosystem/history/${project.id}`}>Full project history →</Link></div>
              <h3>Project funding history</h3>
              <ProjectFunding project={project} />
              {sharedFunding.length > 0 && (
                <>
                  <h3>Funding on shared repositories</h3>
                  <p>
                    These other projects share a repository with this entry.
                    Their approvals do not establish a separate award to this
                    component.
                  </p>
                  <div className={styles.dialogLinks}>
                    {sharedFunding.map((other) => (
                      <Link
                        key={other.id}
                        href={
                          "/ecosystem?project=" + encodeURIComponent(other.id)
                        }
                        onClick={() =>
                          onProjectNavigate ? onProjectNavigate(other) : close()
                        }
                      >
                        {other.name} · scope & sources →
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {org && (
                <>
                  <h3>Project association · {org.name}</h3>
                  <OrganizationFunding organization={org} />
                  <p>
                    Organization funding history is not a grant award to each
                    repository.
                  </p>
                </>
              )}
              <h3>Sources</h3>
              <Sources sources={[...project.sources, ...brandSources(brand)]} />
            </>
          );
        })()}
      {selection?.kind === "repository" &&
        (() => {
          const repo = selection.value;
          return (
            <>
              <div className={styles.badges}>
                <CategoryBadge category={repo.category} />
                {repo.archived && <Badge muted>Archived</Badge>}
                {repo.fork && <Badge muted>Fork</Badge>}
                {repo.disabled && <Badge muted>Disabled</Badge>}
                {normalizeTags([
                  ...(repo.review?.tags || []),
                  repo.language || "",
                ]).map((tag) => (
                  <Badge key={tag} muted>
                    {tag}
                  </Badge>
                ))}
              </div>
              <Notices notices={repo.notices} />
              <p>
                {repo.description ||
                  "No description supplied by the maintainer."}
              </p>
              <div className={styles.dialogLinks}>
                <External url={repo.url}>Repository ↗</External>
                <External
                  url={
                    repo.url +
                    "/commits/" +
                    encodeURIComponent(repo.defaultBranch || "")
                  }
                >
                  Commit history ↗
                </External>
                <External url={repo.url + "/releases"}>Releases ↗</External>
              </div>
              <h3>What is being measured</h3>
              <p>
                Commits reachable from the current default branch (
                {repo.defaultBranch || "not available"}) in the selected time
                window. Fork histories are visible here but excluded from
                headline totals. Activity is not a measure of code quality or
                delivered work.
              </p>
              <div className={styles.event}>
                <strong>Last push · {displayDate(repo.pushedAt)}</strong>
                <div className={styles.small}>
                  Activity collected {displayDate(repo.activity?.checkedAt)}
                </div>
              </div>
              {repo.activity?.latestRelease && (
                <div className={styles.event}>
                  <strong>{repo.activity.latestRelease.tagName}</strong>
                  <div className={styles.small}>
                    {displayDate(repo.activity.latestRelease.publishedAt)}
                    {isPreviewRelease(repo.activity.latestRelease)
                      ? " · Prerelease"
                      : ""}
                  </div>
                  <External url={repo.activity.latestRelease.url}>
                    GitHub release marker ↗
                  </External>
                </div>
              )}
              <p>
                A GitHub release marker can be a beta or a repository notice; it
                does not establish a stable package or a deployment.
              </p>
              <h3>Project associations</h3>
              {repo.projects.length ? (
                repo.projects.map((project) => (
                  <div className={styles.event} key={project.id}>
                    <Link
                      href={
                        "/ecosystem?project=" + encodeURIComponent(project.id)
                      }
                      onClick={() =>
                        onProjectNavigate ? onProjectNavigate(project) : close()
                      }
                    >
                      <strong>{project.name} →</strong>
                    </Link>
                    <ProjectFunding project={project} />
                  </div>
                ))
              ) : (
                <p>
                  This repository is included by its public owner inventory. A
                  product-specific funding association has not been established.
                </p>
              )}
              <h3>GitHub owner / namespace</h3>
              <External
                url={"https://github.com/" + encodeURIComponent(repo.owner)}
              >
                {repo.owner} ↗
              </External>
              {repo.organization && (
                <>
                  <h3>{repo.organization.name} · organization funding</h3>
                  <OrganizationFunding organization={repo.organization} />
                  <p>
                    Namespace ownership does not establish exclusive maintenance
                    or funding of every repository.
                  </p>
                </>
              )}
              <h3>Classification & provenance</h3>
              <p>
                {repo.classification === "reviewed"
                  ? repo.review!.rationale
                  : repo.classification === "project-associated"
                    ? "Purpose is shared by the linked project records; this repository has not received an individual purpose review."
                    : "Purpose is inferred from the repository name, description and topics. It is an organizational aid, not an independently reviewed product claim."}
              </p>
              {repo.review && (
                <p>
                  <External url={repo.review.sourceUrl}>
                    Purpose source ↗
                  </External>
                  {" · Reviewed " + displayDate(repo.review.checkedAt)}
                </p>
              )}
              {repo.aliases.length > 0 && (
                <p>Also found through: {repo.aliases.join(", ")}.</p>
              )}
              <Sources
                sources={[
                  { title: "GitHub metadata", url: repo.sourceUrl },
                  ...(repo.organization?.sources || []),
                  ...brandSources(brand),
                ]}
              />
            </>
          );
        })()}
      {selection?.kind === "organization" && (
        <>
          <p>{selection.value.description}</p>
          <p>GitHub: {selection.value.githubOwners.join(", ")}</p>
          <h3>Funding history & current disclosures</h3>
          <OrganizationFunding organization={selection.value} />
          <h3>Primary sources</h3>
          <Sources
            sources={[...selection.value.sources, ...brandSources(brand)]}
          />
        </>
      )}
    </dialog>
  );
}

export function EcosystemExplorer({
  catalog,
  mode,
}: {
  catalog: Catalog;
  mode: Mode;
}) {
  const isDevelopment = mode === "development";
  const repositories = useMemo(() => classifyRepositories(catalog), [catalog]);
  const [localQuery, setQuery] = useState("");
  const [localCategory, setCategory] = useState("");
  const [localOrganization, setOrganization] = useState("");
  const [localFunding, setFunding] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [period, setPeriod] = useState(30);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [localProjectId, setProjectId] = useState<string | null>(null);
  const methodologyRef = useRef<HTMLDetailsElement>(null);
  // Ecosystem filters follow the URL directly, including insight shortcuts
  // and browser back/forward. Development retains its local filter controls.
  // Null outside the app router (static renders in tests).
  const searchParams = useSearchParams() as ReturnType<typeof useSearchParams> | null;
  const projectParam = searchParams?.get("project") ?? null;
  const orgParam = searchParams?.get("org") ?? null;
  const registryProjects = catalog.registry.projects;
  const registryOrganizations = catalog.registry.organizations;
  const catalogFilters = ecosystemCatalogFilters(searchParams, catalog.registry);
  const query = isDevelopment ? localQuery : catalogFilters.query;
  const category = isDevelopment ? localCategory : catalogFilters.category;
  const organization = isDevelopment ? localOrganization : catalogFilters.organization;
  const funding = isDevelopment ? localFunding : catalogFilters.funding;
  const projectId = isDevelopment ? localProjectId : catalogFilters.projectId;
  const catalogSearch = isDevelopment ? "" : searchParams?.toString() ?? "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(null);
    setPage(1);
    if (!isDevelopment) return;
    const projectRecord = projectParam
      ? registryProjects.find((item) => item.id === projectParam)
      : undefined;
    const organizationRecord = orgParam
      ? registryOrganizations.find((item) => item.id === orgParam)
      : undefined;
    if (organizationRecord) {
      setOrganization(organizationRecord.id);
      setProjectId(null);
    } else if (projectRecord) {
      setOrganization("");
      setProjectId(projectRecord.id);
    } else {
      // Plain /development: no record preselected.
      setOrganization("");
      setProjectId(null);
    }
  }, [projectParam, orgParam, catalogSearch, isDevelopment, registryProjects, registryOrganizations]);
  const activeOrganization = !isDevelopmentMode(mode)
    ? registryOrganizations.find((item) => item.id === organization)
    : undefined;
  const filters = {
    query,
    category,
    organization: isDevelopment ? "" : organization,
    owner: isDevelopment ? organization : undefined,
    funding,
    lifecycle,
  };
  const matchingRepos = filterRepositories(repositories, filters)
    .filter(
      (repo) =>
        !projectId || repo.projects.some((project) => project.id === projectId),
    )
    .sort(
      (a, b) =>
        (b.activity?.commits[String(period)] ?? -1) -
          (a.activity?.commits[String(period)] ?? -1) ||
        (b.pushedAt || "").localeCompare(a.pushedAt || "") ||
        a.fullName.localeCompare(b.fullName),
    );
  const featured = [
    "zebra",
    "zakura",
    "zodl-wallet",
    "librustzcash",
    "shielded-crosslink",
    "zingo-wallet",
    "zaino",
    "frost",
    "qedit-zsa",
  ];
  const matchingProjects = filterProjects(
    catalog.registry.projects,
    filters,
    catalog.registry.organizations,
  )
    .filter((project) => !projectId || project.id === projectId)
    .sort(
      (a, b) =>
        (featured.includes(a.id) ? featured.indexOf(a.id) : 100) -
          (featured.includes(b.id) ? featured.indexOf(b.id) : 100) ||
        a.name.localeCompare(b.name),
    );
  const resultCount = isDevelopment
    ? matchingRepos.length
    : matchingProjects.length;
  const perPage = isDevelopment ? 30 : 24;
  const pages = Math.max(1, Math.ceil(resultCount / perPage));
  const visiblePage = Math.min(page, pages);
  const start = (visiblePage - 1) * perPage;
  const stats = activitySummary(matchingRepos, period);
  const categories = [
    ...new Set(
      (isDevelopment ? repositories : catalog.registry.projects).map(
        (item) => item.category,
      ),
    ),
  ].sort();
  const organizations = catalog.registry.organizations.filter((org) =>
    catalog.registry.projects.some(
      (project) => project.organizationId === org.id,
    ),
  );
  const owners = repositoryOwners(repositories);
  const coreOrganizations = catalog.registry.organizations.filter((org) =>
    [
      "zcash-foundation",
      "zodl",
      "zakura",
      "shielded-labs",
      "ecc",
      "zcash-core",
    ].includes(org.id),
  );
  const selectedProject = catalog.registry.projects.find(
    (project) => project.id === projectId,
  );
  const update = (setter: (value: string) => void, value: string, key?: "q" | "category" | "org" | "funding") => {
    if (isDevelopment) setter(value);
    else if (key) {
      const search = updateEcosystemCatalogSearch(window.location.search, { [key]: value });
      const href = `${window.location.pathname}?${search}${window.location.hash}`;
      // Typing replaces the current search; discrete filters can be undone with Back.
      if (key === "q") window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    }
    setPage(1);
  };
  function clearFilters() {
    setQuery("");
    setCategory("");
    setOrganization("");
    setFunding("");
    setLifecycle("");
    setProjectId(null);
    setPage(1);
    if (!isDevelopment) {
      const search = updateEcosystemCatalogSearch(window.location.search, {
        q: "", category: "", org: "", funding: "", project: "",
      });
      window.history.pushState(null, "", `${window.location.pathname}?${search}${window.location.hash}`);
    } else if (window.location.search)
      window.history.replaceState(null, "", window.location.pathname);
  }
  function navigateProject(project: Project) {
    // Next preserves client state on same-page navigation. A component search
    // or open dialog must not hide the funded project being opened.
    setQuery("");
    setCategory("");
    setOrganization("");
    setFunding("");
    setLifecycle("");
    setProjectId(project.id);
    setPage(1);
    setSelection(null);
  }
  const measuredPercent = stats.eligible
    ? Math.round((stats.measured / stats.eligible) * 100)
    : 0;
  const num = (value: number) => number.format(value);
  function showSources() {
    const details = methodologyRef.current;
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: "start" });
    details.querySelector("summary")?.focus({ preventScroll: true });
  }

  return (
    <div className={styles.explorer}>
      {!isDevelopment && <Link href="/ecosystem" className={styles.textButton}>← Ecosystem overview</Link>}
      <OrgHeader
        name={isDevelopment ? "Development" : "Ecosystem"}
        logo="/logos/ecosystem/zcash.png"
        tagline={
          isDevelopment
            ? "Follow the code behind Zcash, from protocol infrastructure to applications."
            : "Discover the projects, tools and teams building with Zcash."
        }
        actions={
          <div className={styles.headerActions}>
            <nav className={styles.tabs} aria-label="Ecosystem apps">
              <Link
                href={isDevelopment ? "/ecosystem" : "/ecosystem?view=catalog"}
                aria-current={!isDevelopment ? "page" : undefined}
              >
                {isDevelopment ? "Ecosystem" : "Project catalog"}
              </Link>
              <Link
                href="/development"
                aria-current={isDevelopment ? "page" : undefined}
              >
                Development
              </Link>
            </nav>
          </div>
        }
      />

      <div className={styles.stats} aria-label="Catalog statistics">
        {(isDevelopment
          ? [
              [num(matchingRepos.length), "Repositories"],
              [
                stats.measured ? num(stats.commits) : "—",
                "Commits · " + period + "d",
              ],
              [
                stats.measured ? num(stats.active) : "—",
                "Active repos · " + period + "d",
              ],
              [
                stats.measured ? num(stats.releases) : "—",
                "Releases · " + period + "d",
              ],
            ]
          : [
              [num(catalog.registry.projects.length), "Projects & components"],
              [num(repositories.length), "Repositories"],
              [num(catalog.registry.organizations.length), "Teams & accounts"],
              [
                num(catalog.registry.projects.filter(isGrantFunded).length),
                "With grant approvals",
              ],
            ]
        ).map(([value, label]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>
      <div className={styles.dataNote}>
        <span>
          {isDevelopment
            ? "Repository-wide totals · excludes forks"
            : "Grant approval ≠ payment or current funding"}
        </span>
        <button onClick={showSources}>
          Snapshot {displayDate(catalog.snapshot.collectedAt)} · Sources
        </button>
      </div>

      <div className={styles.filters} role="group" aria-label="Catalog filters">
        <label className={`${styles.search} ws-field`}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => update(setQuery, event.target.value, "q")}
            placeholder={
              isDevelopment ? "Search repositories…" : "Search projects…"
            }
            aria-label={
              isDevelopment ? "Search repositories" : "Search projects"
            }
          />
        </label>
        <select
          value={category}
          onChange={(event) => update(setCategory, event.target.value, "category")}
          aria-label="Filter by purpose"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={organization}
          onChange={(event) => update(setOrganization, event.target.value, "org")}
          aria-label={
            isDevelopment
              ? "Filter by GitHub owner"
              : "Filter by project association"
          }
        >
          <option value="">
            {isDevelopment ? "All GitHub owners" : "All project teams"}
          </option>
          {isDevelopment
            ? owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))
            : organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
        </select>
        <select
          value={funding}
          onChange={(event) => update(setFunding, event.target.value, "funding")}
          aria-label="Filter by funding"
        >
          <option value="">All funding</option>
          <option value="grants">Grant approvals</option>
          {isDevelopment && (
            <option value="historical-dev-fund">
              Former Dev Fund recipient
            </option>
          )}
        </select>
        {isDevelopment && (
          <select
            value={lifecycle}
            onChange={(event) => update(setLifecycle, event.target.value)}
            aria-label="Filter repository type"
          >
            <option value="">All repositories</option>
            <option value="original">Original · not archived</option>
            <option value="archived">Archived</option>
            <option value="forks">Forks</option>
          </select>
        )}
      </div>
      <div className={styles.caption}>
        <span aria-live="polite">
          <strong>
            {num(resultCount)}{" "}
            {isDevelopment ? "repositories" : "projects & components"}
          </strong>
          {selectedProject && " · " + selectedProject.name}
        </span>
        <div className={styles.resultActions}>
          {(query ||
            category ||
            organization ||
            funding ||
            lifecycle ||
            projectId) && (
            <button className={styles.textButton} onClick={clearFilters}>
              Clear filters
            </button>
          )}
          {isDevelopment && (
            <div
              className={styles.periods}
              role="group"
              aria-label="Activity period"
            >
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  aria-pressed={period === days}
                  aria-label={days + " days"}
                  onClick={() => {
                    setPeriod(days);
                    setPage(1);
                  }}
                >
                  {days}d
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeOrganization ? (
        <section
          className={styles.orgPanel}
          aria-label={activeOrganization.name}
        >
          <div className={styles.orgPanelHead}>
            <BrandMark
              brand={organizationBrand(activeOrganization.id)}
              category="Other"
              compact
            />
            <div>
              <h2>{activeOrganization.name}</h2>
              <p>{activeOrganization.description}</p>
            </div>
          </div>
          <div className={styles.orgPanelBody}>
            <OrganizationFunding organization={activeOrganization} />
            <p className={styles.small}>
              <External url={activeOrganization.website}>Website ↗</External>
              {(activeOrganization.githubOwners ?? []).map((owner) => (
                <span key={owner}>
                  {" · "}
                  <External url={`https://github.com/${owner}`}>
                    GitHub {owner} ↗
                  </External>
                </span>
              ))}
            </p>
          </div>
        </section>
      ) : null}

      {resultCount === 0 ? (
        <div className={styles.empty}>
          <h2>No matches in this view</h2>
          <p>
            Try another name, category or{" "}
            {isDevelopment ? "GitHub owner" : "project team"}.
          </p>
          <button className={styles.textButton} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : isDevelopment ? (
        <div className={styles.tablePanel}>
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Repository results"
          >
            <table
              className={styles.table}
              aria-label="Development repositories"
            >
              <thead>
                <tr>
                  <th scope="col">Repository</th>
                  <th scope="col">Category</th>
                  <th scope="col" className={styles.numberCell}>
                    Commits · {period}d
                  </th>
                  <th scope="col">Last push</th>
                  <th scope="col">Release</th>
                </tr>
              </thead>
              <tbody>
                {matchingRepos.slice(start, start + perPage).map((repo) => {
                  const count = repo.activity?.commits[String(period)];
                  const release = repo.activity?.latestRelease;
                  return (
                    <tr key={repo.id}>
                      <td>
                        <div className={styles.repoIdentity}>
                          <BrandMark
                            brand={repositoryBrand(repo)}
                            category={repo.category}
                            compact
                          />
                          <div>
                            <button
                              className={styles.repoTitle}
                              onClick={() =>
                                setSelection({
                                  kind: "repository",
                                  value: repo,
                                })
                              }
                            >
                              {repo.name} <span aria-hidden="true">→</span>
                            </button>
                            <div className={styles.repoMeta}>
                              <span>
                                {repo.owner}
                                {repo.language && " · " + repo.language}
                              </span>
                              {repo.archived && <Badge muted>Archived</Badge>}
                              {repo.fork && <Badge muted>Fork</Badge>}
                              {repo.disabled && <Badge muted>Disabled</Badge>}
                              <NoticeBadges notices={repo.notices} />
                              {repo.projects.some(isGrantFunded) && (
                                <Badge>Grant history</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <CategoryBadge category={repo.category} />
                        {repo.classification !== "reviewed" && (
                          <div className={styles.small}>
                            {repo.classification === "project-associated"
                              ? "Project-linked"
                              : "Inferred"}
                          </div>
                        )}
                      </td>
                      <td className={styles.numberCell}>
                        <span
                          className={styles.numeric}
                          title={
                            repo.fork
                              ? "Fork history — excluded from totals"
                              : "Default-branch commits"
                          }
                        >
                          {typeof count === "number" ? num(count) : "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.date}>
                          {displayDate(repo.pushedAt)}
                        </span>
                      </td>
                      <td>
                        {release ? (
                          <>
                            <External
                              className={styles.release}
                              url={release.url}
                            >
                              {release.tagName} ↗
                            </External>
                            <div className={styles.small}>
                              {displayDate(release.publishedAt)}
                            </div>
                            {isPreviewRelease(release) && (
                              <Badge muted>Prerelease</Badge>
                            )}
                          </>
                        ) : (
                          <span
                            className={styles.small}
                            aria-label="No release marker"
                            title="No release marker"
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {matchingProjects.slice(start, start + perPage).map((project) => {
            const repos = relatedRepositories(project, repositories);
            const org = catalog.registry.organizations.find(
              (item) => item.id === project.organizationId,
            );
            const allArchived =
              repos.length > 0 && repos.every((repo) => repo.archived);
            return (
              <article
                className={styles.card}
                style={categoryStyle(project.category)}
                key={project.id}
              >
                <Card className={styles.cardSurface + " p-4"}>
                  <div className={styles.cardTop}>
                    <BrandMark
                      brand={projectBrand(project)}
                      category={project.category}
                    />
                    <div>
                      <h2>{project.name}</h2>
                      <p>{org?.name || "Independent project"}</p>
                    </div>
                  </div>
                  <p className={styles.projectSummary}>{project.description}</p>
                  <div className={styles.badges}>
                    <CategoryBadge category={project.category} />
                    {isGrantFunded(project) && <Badge>Grant history</Badge>}
                    <NoticeBadges notices={project.notices} />
                    {allArchived && <Badge muted>Archived</Badge>}
                  </div>
                  <div className={styles.cardBottom}>
                    <span>
                      {repos.length
                        ? repos.length +
                          " " +
                          (repos.length === 1 ? "repository" : "repositories")
                        : "Public sources"}
                    </span>
                    <button
                      aria-label={"View " + project.name}
                      onClick={() =>
                        setSelection({ kind: "project", value: project })
                      }
                    >
                      Details →
                    </button>
                  </div>
                </Card>
              </article>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className={styles.pagination} aria-label="Results pagination">
          <button
            disabled={visiblePage <= 1}
            onClick={() => setPage(visiblePage - 1)}
          >
            ← Previous
          </button>
          <span>
            {visiblePage} / {pages}
          </span>
          <button
            disabled={visiblePage >= pages}
            onClick={() => setPage(visiblePage + 1)}
          >
            Next →
          </button>
        </nav>
      )}

      {!isDevelopment && (
        <details id="organizations" className={styles.methodology}>
          <summary>Organizations & funding</summary>
          <p>
            Funding models change over time. Explore the source-backed record
            for each team.
          </p>
          <div className={styles.organizationGrid}>
            {coreOrganizations.map((org) => (
              <article key={org.id} className={styles.organizationCard}>
                <div className={styles.organizationIdentity}>
                  <BrandMark
                    brand={organizationBrand(org.id)}
                    category="Other"
                    compact
                  />
                  <h3>{org.name}</h3>
                </div>
                <p>{org.funding.label}</p>
                <button
                  onClick={() =>
                    setSelection({ kind: "organization", value: org })
                  }
                >
                  History & sources →
                </button>
              </article>
            ))}
          </div>
        </details>
      )}
      <details ref={methodologyRef} className={styles.methodology}>
        <summary>Sources & methodology</summary>
        <p>
          Snapshot {displayDate(catalog.snapshot.collectedAt)} ·{" "}
          {num(
            catalog.snapshot.owners.filter((owner) => owner.complete).length,
          )}{" "}
          full account inventories.
          {isDevelopment &&
            stats.eligible > 0 &&
            " Activity available for " +
              measuredPercent +
              "% of original repositories in this view."}
        </p>
        <p>
          Complete public repository inventories are shown below. Other
          maintainers are represented by selected Zcash-related repositories.
          This is a bounded source inventory, not a claim that every private,
          deleted or undiscovered repository is included.
        </p>
        <div className={styles.tableScroll}>
          <table className={styles.coverageTable}>
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Public repos</th>
                <th scope="col">Pages</th>
                <th scope="col">Collected</th>
              </tr>
            </thead>
            <tbody>
              {catalog.snapshot.owners.map((owner) => (
                <tr key={owner.login}>
                  <td>
                    <External url={owner.identitySource}>
                      {owner.login} ↗
                    </External>
                  </td>
                  <td>
                    {num(owner.repositoryCount)}
                    {!owner.complete ? " · incomplete" : ""}
                  </td>
                  <td>{owner.pages}</td>
                  <td>{displayDate(owner.collectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Repository identity is deduplicated by GitHub ID after redirects.
          Archived projects and forks remain searchable. Purpose tags
          distinguish individual source reviews, project-linked categories and
          metadata inferences. Project-linked and inferred categories are not
          individually reviewed repository claims. Project-family tags are not
          inherited as repository capabilities.
        </p>
        <p>
          Development filters GitHub owners, while Ecosystem filters project
          team associations. A namespace can contain shared upstream work;
          neither filter establishes exclusive maintainership. Support notices
          are separate from archive/fork flags. Unqualified stage values are not
          displayed as verified support.
        </p>
        <p>
          Activity counts use 7, 30 and 90-day windows ending at collection
          time. They count commits reachable from the current default branch and
          published GitHub release records, not code quality or delivered work.
          Shared and multichain codebases may include non-Zcash work. Headline
          totals exclude forks. Individual commit counts are not deduplicated
          across separate original repositories or attribution of individual
          developer effort. Missing measurements appear as a dash. Release
          records include prereleases and do not establish deployment.
        </p>
        <p>
          {num(catalog.registry.grantReview.classification.length)} of{" "}
          {num(catalog.registry.grantReview.totalApproved)} approved proposal
          rows classified. {num(catalog.registry.grantReview.unresolved.length)}{" "}
          funding or repository associations remain explicitly unresolved.
          Renewals are funding events rather than additional apps.
        </p>
        <p>
          Mapped entries include both project families and their individual
          components; these counts are not counts of separate businesses or
          wallets. Shared upstream repositories can be associated with a scoped
          contribution grant without being funded in their entirety.
        </p>
        <p>
          Marks identify a project, its maintainer or its shared namespace; they
          do not imply endorsement. Attribution is available in the image label
          and project details. Entries without a confirmed mark use a category
          icon.
        </p>
        {catalog.registry.grantReview.unresolved.length > 0 && (
          <details>
            <summary>Unresolved source associations</summary>
            {catalog.registry.grantReview.unresolved.map((item, index) => (
              <p key={item.sourceUrl + index}>
                <External url={item.sourceUrl}>{item.title} ↗</External> —{" "}
                {item.reason}
              </p>
            ))}
          </details>
        )}
        {catalog.snapshot.problems.length > 0 && (
          <details>
            <summary>
              Collection warnings · {catalog.snapshot.problems.length}
            </summary>
            {catalog.snapshot.problems.map((problem, index) => (
              <p key={problem.scope + index}>
                {problem.scope}: {problem.message}
              </p>
            ))}
          </details>
        )}
        <p>
          <Link href="/ecosystem/history">Project histories →</Link> ·{" "}
          <Link href="/zcg/proposals">Proposal history →</Link> ·{" "}
          <Link href="/zcg/grants">Grant ledger →</Link> ·{" "}
          <a href="/api/ecosystem" target="_blank" rel="noopener noreferrer">
            Public dataset ↗
          </a>
        </p>
      </details>
      <footer className={styles.footer}>
        <span>OpenZcash · Public data</span>
        <div className={styles.footerLinks}>
          <Link href="/wallets">Wallets →</Link>
          <Link href={isDevelopment ? "/ecosystem" : "/development"}>
            {isDevelopment ? "Ecosystem" : "Development"} →
          </Link>
        </div>
      </footer>
      <DetailDialog
        selection={selection}
        close={() => setSelection(null)}
        repositories={repositories}
        organizations={catalog.registry.organizations}
        projects={catalog.registry.projects}
        onProjectNavigate={navigateProject}
      />
    </div>
  );
}
