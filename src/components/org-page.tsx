import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading, SourceNote } from "@/components/workspace";
import { OrgHeader } from "@/components/org-header";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";

function displayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m ?? 1) - 1];
  return d ? `${month} ${d}, ${y}` : `${month} ${y}`;
}

/**
 * One page per organisation of the ecosystem registry: mark, description,
 * public addresses, its projects and repositories, funding history and
 * sources. The explorer stays the place to browse everything at once.
 */
export async function OrgPage({ orgId, logo, tagline }: { orgId: string; logo: string; tagline?: string }) {
  await connection();
  const catalog = await loadEcosystemCatalog();
  const org = catalog.registry.organizations.find((o) => o.id === orgId);
  if (!org) notFound();
  const projects = catalog.registry.projects.filter((p) => p.organizationId === org.id);
  const owners = new Set(org.githubOwners.map((o) => o.toLowerCase()));
  const repos = catalog.snapshot.repositories
    .filter((r) => owners.has(r.owner.toLowerCase()))
    .sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  const latestPush = repos[0]?.pushedAt ?? null;
  const links = [
    { href: org.website, label: new URL(org.website).host.replace(/^www\./, "") },
    ...org.githubOwners.map((o) => ({ href: `https://github.com/${o}`, label: `GitHub · ${o}` })),
  ];
  return (
    <>
      <OrgHeader
        name={org.name}
        logo={logo}
        tagline={tagline ?? org.description}
        links={links}
        stats={[
          { label: "Projects", value: String(projects.length), sub: "in the ecosystem registry" },
          { label: "Repositories", value: String(repos.length), sub: "public, in the snapshot" },
          { label: "Latest push", value: latestPush ? displayDate(latestPush.slice(0, 10)) : "n/a", sub: "across its repositories" },
          { label: "Funding", value: org.funding.status.replace(/-/g, " "), sub: org.funding.label },
        ]}
      />

      {projects.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Projects" count={projects.length} description="What the organisation builds, with its category and the record in the explorer." />
          <div className="ws-org-list">
            {projects.map((p) => (
              <Link key={p.id} href={`/ecosystem?project=${encodeURIComponent(p.id)}`} className="ws-org-row">
                <span className="ws-org-row-main">
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
                <span className="ws-org-row-meta">{p.category}</span>
                <span className="ws-org-row-meta">{p.funding.label}</span>
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {repos.length > 0 ? (
        <section className="mb-8">
          <SectionHeading title="Repositories" count={repos.length} description="Public code under the organisation's GitHub, most recently pushed first." />
          <div className="ws-org-list">
            {repos.slice(0, 12).map((r) => (
              <a key={r.fullName} href={r.url} target="_blank" rel="noreferrer" className="ws-org-row">
                <span className="ws-org-row-main">
                  <strong>{r.fullName}</strong>
                </span>
                <span className="ws-org-row-meta tnum">{r.stars.toLocaleString("en-US")} stars</span>
                <span className="ws-org-row-meta tnum">{r.pushedAt ? displayDate(r.pushedAt.slice(0, 10)) : ""}</span>
                <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
          {repos.length > 12 ? (
            <p className="mt-3 text-xs text-stone-600">
              <Link href={`/development?org=${encodeURIComponent(org.id)}`} className="text-amber-700 hover:underline">
                All {repos.length} repositories in Development →
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeading title="Funding" description={org.funding.label} />
        {org.funding.history.length > 0 ? (
          <div className="ws-org-list">
            {org.funding.history.map((e, i) => (
              <a key={e.sourceUrl + i} href={e.sourceUrl} target="_blank" rel="noreferrer" className="ws-org-row">
                <span className="ws-org-row-main">
                  <strong>{e.label}</strong>
                  <small>{e.program ?? ""}</small>
                </span>
                <span className="ws-org-row-meta tnum">
                  {e.from ? displayDate(e.from) : ""}{e.until ? ` — ${displayDate(e.until)}` : ""}
                </span>
                <span className="ws-org-row-meta" />
                <span aria-hidden>↗</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-600">No dated funding events recorded.</p>
        )}
      </section>

      <SourceNote>
        Sources:{" "}
        {org.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 ? " · " : ""}
            <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>
          </span>
        ))}
        . Registry checked {displayDate(catalog.registry.checkedAt.slice(0, 10))}; the marks identify the organisation and imply no endorsement.
      </SourceNote>
    </>
  );
}
