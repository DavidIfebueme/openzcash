"use client";
import { useState, type FormEvent } from "react";
import {
  BASE,
  categories,
  safeHttpUrl,
  type Opportunity,
  type Campaign,
} from "./model";
import { useApp, Link } from "./state";
import {
  Card,
  Hero,
  Heading,
  Empty,
  OrganizerTag,
  Field,
  LocaleSummary,
} from "./components";
import { languages, matchesLocale } from "./locales";
import { CountryPicker } from "./country-picker";
import { Editor, Setup } from "./editor";
import { Coin, Icon, Illustration } from "./visuals";
import { formatDate, zec } from "./data";
import {
  BETA_PREVIEW,
  betaUsd,
  BETA_LOCK_MESSAGE,
  BETA_RATE_DATE,
} from "./beta";
import { BetaNote } from "./components";

function Listing({
  items,
  create = true,
  createTo = BASE + "/new",
}: {
  items: Opportunity[];
  create?: boolean;
  createTo?: string;
}) {
  const a = useApp();
  const [filters, setFilters] = useState(false);
  const q = a.params.get("q") || "",
    type = a.params.get("type") || "all",
    category = a.params.get("category") || "all",
    organizer = a.params.get("community") || "all",
    sort = a.params.get("sort") || "random",
    language = a.params.get("language") || "all",
    country = a.params.get("country") || "all";
  const matching = items.filter(
    (o) =>
      matchesLocale(o, language, country) &&
      (type === "all" || type === o.type) &&
      (category === "all" || category === o.category) &&
      (organizer === "all" || organizer === o.community) &&
      (o.title + " " + o.description + " " + a.organizerFor(o.community).name)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  if (sort === "reward") matching.sort((a, b) => b.reward - a.reward);
  if (sort === "deadline")
    matching.sort((a, b) => a.deadline.localeCompare(b.deadline));
  const active =
    category !== "all" ||
    organizer !== "all" ||
    language !== "all" ||
    country !== "all";
  function reset() {
    const p = new URLSearchParams(a.params);
    [
      "q",
      "type",
      "category",
      "community",
      "sort",
      "language",
      "country",
    ].forEach((k) => p.delete(k));
    a.go(a.path + (p.size ? "?" + p : ""), true);
  }
  return (
    <>
      <section
        className={"op-listing-controls" + (create ? " with-create" : "")}
        aria-label="Find opportunities"
      >
        <div className="listing-tools">
          <label className="op-search">
            <Icon name="search" size={17} />
            <input
              aria-label="Search opportunities"
              placeholder="Search opportunities"
              value={q}
              onChange={(e) => a.filter("q", e.target.value)}
            />
            {q && (
              <button onClick={() => a.filter("q", "")} aria-label="Clear search">
                <Icon name="close" size={15} />
              </button>
            )}
          </label>
          <button
            className={"op-button " + (active ? "selected" : "")}
            aria-expanded={filters}
            aria-controls="op-filters"
            onClick={() => setFilters((v) => !v)}
          >
            <Icon name="filter" size={16} />
            Filters{active && <span className="filter-dot" />}
          </button>
          {create && (
            <Link to={createTo} className="op-button primary create-opportunity">
              <Icon name="plus" size={17} />
              <span>Create opportunity</span>
            </Link>
          )}
        </div>
        <div className="listing-meta">
          <div className="op-segment" aria-label="Opportunity format">
            {[
              ["all", "All"],
              ["Task", "Tasks"],
              ["Contest", "Contests"],
            ].map(([v, l]) => (
              <button
                aria-pressed={type === v}
                className={type === v ? "active" : ""}
                key={v}
                onClick={() => a.filter("type", v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="results-sort">
            <span aria-live="polite">{matching.length} results</span>
            <select
              className="op-sort-select"
              aria-label="Sort opportunities"
              value={sort}
              onChange={(e) => a.filter("sort", e.target.value)}
            >
              <option value="random">Random order</option>
              <option value="deadline">Closing soon</option>
              <option value="reward">Highest reward</option>
            </select>
          </div>
        </div>
        {filters && (
          <div
            className="op-filters"
            id="op-filters"
            role="region"
            aria-label="Opportunity filters"
          >
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => a.filter("category", e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Organizer">
              <select
                value={organizer}
                onChange={(e) => a.filter("community", e.target.value)}
              >
                <option value="all">All organizers</option>
                {a.organizers
                  .filter((c) => items.some((o) => o.community === c.id))
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Language">
              <select
                value={language}
                onChange={(e) => a.filter("language", e.target.value)}
              >
                <option value="all">All languages</option>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <CountryPicker
              value={country}
              allowAll
              onChange={(value) => a.filter("country", value)}
            />
            <div className="op-filter-actions">
              <button className="op-text" onClick={reset}>
                Clear filters
              </button>
              <Link to={BASE + "?tab=communities"} className="op-text">
                Browse organizers <Icon name="arrow" size={14} />
              </Link>
            </div>
          </div>
        )}
      </section>
      {matching.length ? (
        <div className="op-grid">
          {matching.map((o) => (
            <Card key={o.id} item={o} />
          ))}
        </div>
      ) : (
        <Empty title="No matching opportunities">
          <button className="op-button" onClick={reset}>
            Clear filters
          </button>
        </Empty>
      )}
    </>
  );
}
function Overview() {
  const a = useApp();
  return <Listing items={a.items} create={false} />;
}
function CampaignCard({ campaign }: { campaign: Campaign }) {
  const a = useApp();
  const items = a.items.filter((o) => o.campaign === campaign.id);
  return (
    <article className="campaign-card">
      <Link to={BASE + "/campaigns/" + campaign.id} className="campaign-cover">
        <Illustration kind={campaign.art} />
        <span className="status-badge">{campaign.kind}</span>
      </Link>
      <div>
        <OrganizerTag id={campaign.organizer} />
        <h2>
          <Link to={BASE + "/campaigns/" + campaign.id}>{campaign.title}</Link>
        </h2>
        <p>{campaign.description}</p>
        <div className="campaign-card-meta">
          <strong>
            {zec(items.reduce((n, o) => n + o.reward, 0))} ZEC{" "}
            <small>{BETA_PREVIEW ? "example total" : "pledged"}</small>
          </strong>
          <span>{items.length} opportunities</span>
          <Icon name="arrow" size={18} />
        </div>
      </div>
    </article>
  );
}
function Campaigns() {
  const a = useApp();
  return (
    <>
      <Heading
        title="Campaigns"
        level={2}
        description="Tasks and contests around a shared goal."
        action={
          <Link to={BASE + "/campaigns/new"} className="op-button primary">
            <Icon name="plus" size={17} />
            Create campaign
          </Link>
        }
      />
      <div className="campaign-grid">
        {a.campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
      </div>
    </>
  );
}
function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const a = useApp(),
    items = a.items.filter((o) => o.campaign === campaign.id),
    owner = campaign.owner && campaign.owner === a.profile?.id;
  return (
    <>
      <Link to={BASE + "?tab=campaigns"} className="op-back">
        <Icon name="left" size={16} />
        Campaigns
      </Link>
      <Hero
        title={campaign.title}
        description={campaign.description}
        stats={[
          [
            BETA_PREVIEW ? "Example total" : "Pledged rewards",
            zec(items.reduce((n, o) => n + o.reward, 0)) + " ZEC",
          ],
          ["Opportunities", String(items.length)],
          ["Ends", formatDate(campaign.deadline)],
        ]}
      />
      <div className="section-title">
        <OrganizerTag id={campaign.organizer} />
        <span className="op-tag">{campaign.kind}</span>
        {owner && items.length > 0 && (
          <Link
            to={BASE + "/new?campaign=" + campaign.id}
            className="op-button primary"
          >
            <Icon name="plus" size={16} />
            Add opportunity
          </Link>
        )}
      </div>
      {items.length ? (
        <Listing items={items} create={false} />
      ) : (
        <Empty title="Add the first opportunity">
          <p>Each task or contest defines its own reward and criteria.</p>
          {owner && (
            <Link
              to={BASE + "/new?campaign=" + campaign.id}
              className="op-button primary"
            >
              Add opportunity <Icon name="arrow" size={16} />
            </Link>
          )}
        </Empty>
      )}
    </>
  );
}
function Organizers() {
  const a = useApp();
  return (
    <>
      <Heading
        title="Organizers"
        description="The people and communities behind the work."
        action={
          <Link to={BASE + "/communities/new"} className="op-button primary">
            <Icon name="plus" size={16} />
            Create community
          </Link>
        }
      />
      <div className="organizer-grid">
        {a.organizers
          .filter(
            (o) =>
              o.id !== "personal" ||
              a.items.some((i) => i.community === "personal"),
          )
          .map((o) => (
            <Link
              key={o.id}
              to={BASE + "/communities/" + o.id}
              className="organizer-card"
            >
              <span className={"organizer-mark large " + o.color}>
                {o.mark}
              </span>
              <h2>{o.name}</h2>
              <p>{o.description}</p>
              <div>
                {a.items.filter((i) => i.community === o.id).length}{" "}
                opportunities <Icon name="arrow" size={16} />
              </div>
            </Link>
          ))}
      </div>
    </>
  );
}
function CommunityDetail({ id }: { id: string }) {
  const a = useApp(),
    c = a.organizerFor(id),
    items = a.items.filter((o) => o.community === id),
    campaigns = a.campaigns.filter((c) => c.organizer === id),
    owner = a.managed.includes(id) && a.profile;
  return (
    <>
      <Link to={BASE + "?tab=communities"} className="op-back">
        <Icon name="left" size={16} />
        Organizers
      </Link>
      <div className="community-profile">
        <span className={"organizer-mark large " + c.color}>{c.mark}</span>
        <div>
          <h1>{c.name}</h1>
          <p>{c.description}</p>
        </div>
        {owner && (
          <Link
            to={BASE + "/campaigns/new?organizer=" + id}
            className="op-button"
          >
            Create campaign <Icon name="plus" size={16} />
          </Link>
        )}
      </div>
      {campaigns.length > 0 && (
        <>
          <div className="section-title">
            <h2>Campaigns</h2>
          </div>
          <div className="campaign-grid compact-campaigns">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </>
      )}
      <div className="section-title">
        <h2>Opportunities</h2>
      </div>
      <Listing
        items={items}
        createTo={BASE + "/new" + (owner ? "?organizer=" + id : "")}
      />
    </>
  );
}
function Work() {
  const a = useApp(),
    view = a.params.get("view") || "contributing";
  return (
    <>
      <Heading
        title="My work"
        level={2}
        description={
          BETA_PREVIEW
            ? "Publishing and contributions open after beta. Saved opportunities are available now."
            : undefined
        }
        action={
          <Link to={BASE + "/new"} className="op-button primary">
            <Icon name="plus" size={16} />
            Create opportunity
          </Link>
        }
      />
      <div className="work-tabs" aria-label="My work view">
        {[
          ["contributing", "Contributing"],
          ["publishing", "Publishing"],
          ["saved", "Saved"],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-pressed={view === v}
            className={view === v ? "active" : ""}
            onClick={() => a.filter("view", v)}
          >
            {l}
            <span>
              {v === "saved"
                ? a.bookmarks.length
                : v === "contributing"
                  ? a.submissions.length
                  : a.drafts.length + a.published.length}
            </span>
          </button>
        ))}
      </div>
      {view === "saved" &&
        (a.items.some((o) => a.bookmarks.includes(o.id)) ? (
          <div className="op-grid">
            {a.items
              .filter((o) => a.bookmarks.includes(o.id))
              .map((o) => (
                <Card key={o.id} item={o} />
              ))}
          </div>
        ) : (
          <Empty title="No saved opportunities">
            <p>Bookmark a task or contest to keep it here.</p>
            <Link to={BASE} className="op-button">
              Explore opportunities
            </Link>
          </Empty>
        ))}
      {view === "contributing" &&
        (a.submissions.length ? (
          <div className="work-list">
            {a.submissions.map((s) => {
              const item = a.items.find((o) => o.id === s.opportunityId);
              return (
                <Link
                  key={s.id}
                  to={BASE + "/tasks/" + s.opportunityId}
                  className="work-row"
                >
                  <Icon
                    name={item?.type === "Task" ? "briefcase" : "trophy"}
                    size={22}
                  />
                  <div>
                    <strong>{item?.title || "Opportunity"}</strong>
                    <small>
                      {item?.type === "Task"
                        ? "Awaiting selection"
                        : "Awaiting review"}
                    </small>
                  </div>
                  <span className="op-tag">
                    {item?.type === "Task" ? "Applied" : "Submitted"}
                  </span>
                  <Icon name="chevron" size={17} />
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty title="Your contributions will appear here">
            <p>
              {BETA_PREVIEW
                ? "Applications and contest entries are coming soon."
                : "Apply for a task or enter a contest to get started."}
            </p>
            <Link to={BASE} className="op-button">
              Explore opportunities
            </Link>
          </Empty>
        ))}
      {view === "publishing" && (
        <>
          <div className="section-title">
            <h2>
              Drafts <span>{a.drafts.length}</span>
            </h2>
          </div>
          {a.drafts.length ? (
            <div className="work-list">
              {a.drafts.map((d) => (
                <Link
                  to={BASE + "/new?draft=" + d.id}
                  key={d.id}
                  className="work-row"
                >
                  <Icon name="document" size={22} />
                  <div>
                    <strong>{d.title || "Untitled opportunity"}</strong>
                    <small>
                      {d.type} · Step {d.step + 1} of 4
                    </small>
                  </div>
                  <span className="op-tag">Draft</span>
                  <Icon name="chevron" size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="quiet">No drafts yet.</p>
          )}
          <div className="section-title">
            <h2>
              Published <span>{a.published.length}</span>
            </h2>
          </div>
          {a.published.length ? (
            <div className="op-grid">
              {a.published.map((o) => (
                <Card key={o.id} item={o} />
              ))}
            </div>
          ) : (
            <p className="quiet">Published opportunities will appear here.</p>
          )}
        </>
      )}
    </>
  );
}
function Detail({ item }: { item: Opportunity }) {
  const a = useApp(),
    isTask = item.type === "Task",
    owner = item.owner === a.profile?.id && !!item.owner;
  const contribution = a.submissions.find((s) => s.opportunityId === item.id);
  const [applying, setApplying] = useState(false),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const campaign = a.campaigns.find((c) => c.id === item.campaign);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (BETA_PREVIEW) return;
    if (!a.profile) {
      a.setAuthOpen(true);
      return;
    }
    if (url && !safeHttpUrl(url)) {
      setError("Use a valid https:// or http:// link.");
      return;
    }
    a.setSubmissions((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        opportunityId: item.id,
        message: message.trim(),
        url: url.trim(),
        kind: isTask ? "Application" : "Submission",
        stage: isTask ? "Applied" : "Submitted",
      },
    ]);
    setApplying(false);
    a.setToast(
      isTask
        ? "Application saved in this preview."
        : "Entry saved in this preview.",
    );
  }
  function start() {
    if (BETA_PREVIEW) return;
    if (!a.profile) {
      a.setAuthOpen(true);
      return;
    }
    setApplying(true);
    requestAnimationFrame(() =>
      document
        .getElementById("contribution-form")
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }
  return (
    <>
      <Link to={a.lastList.current} className="op-back">
        <Icon name="left" size={16} />
        {a.lastList.current.includes("/campaigns/")
          ? "Back to campaign"
          : a.lastList.current.includes("/communities/")
            ? "Back to organizer"
            : a.lastList.current.includes("activity")
              ? "Back to my work"
              : "Back to opportunities"}
      </Link>
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-art">
            <Illustration kind={item.art} />
            <span className="status-badge">{item.type}</span>
          </div>
          <OrganizerTag id={item.community} />
          <h1>{item.title}</h1>
          <div className="op-tags">
            <span>{item.category}</span>
            <span>{item.level}</span>
          </div>
          <LocaleSummary language={item.language} country={item.country} />
          <div className="mobile-offer">
            <div>
              <small>{isTask ? "Fixed reward" : "Prize pool"}</small>
              <strong>{zec(item.reward)} ZEC</strong>
              <span>
                {BETA_PREVIEW
                  ? "Example · ≈ " + betaUsd(item.reward)
                  : "Pledged"}
              </span>
            </div>
            {!owner && (
              <button
                className="op-button primary"
                disabled={BETA_PREVIEW || !!contribution}
                onClick={start}
              >
                {BETA_PREVIEW
                  ? "Coming soon"
                  : contribution
                    ? "Received"
                    : isTask
                      ? "Apply for task"
                      : "Submit entry"}
                <Icon name={BETA_PREVIEW ? "lock" : "arrow"} size={15} />
              </button>
            )}
          </div>
          {BETA_PREVIEW && <BetaNote>{BETA_LOCK_MESSAGE}</BetaNote>}
          <section>
            <h2>Brief</h2>
            <p className="preserve-lines">{item.brief}</p>
          </section>
          <section>
            <h2>Deliverables</h2>
            <ul>
              {item.deliverables.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Acceptance criteria</h2>
            <ol>
              {item.criteria.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
          {item.resources?.length && (
            <section>
              <h2>Project resources</h2>
              <div className="project-resources">
                {item.resources
                  .filter((r) => safeHttpUrl(r.url))
                  .map((r) => (
                    <a
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="op-text"
                    >
                      {r.label}
                      <Icon name="external" size={15} />
                    </a>
                  ))}
              </div>
            </section>
          )}
          {campaign && (
            <Link
              to={BASE + "/campaigns/" + campaign.id}
              className="op-campaign-link"
            >
              <Icon name="flag" size={20} />
              <div>
                <small>{campaign.kind}</small>
                <strong>{campaign.title}</strong>
              </div>
              <Icon name="arrow" size={18} />
            </Link>
          )}
          {contribution && (
            <section className="contribution-state">
              <span className="op-tag positive">
                <Icon name="checkcircle" size={14} />
                {isTask ? "Application received" : "Entry received"}
              </span>
              <h2>{isTask ? "Awaiting selection" : "Awaiting review"}</h2>
              <p>
                {isTask
                  ? "Wait for the organizer to select you before starting work."
                  : "The organizer will review your entry against the published criteria."}
              </p>
              <blockquote>{contribution.message}</blockquote>
              {contribution.url && safeHttpUrl(contribution.url) && (
                <a
                  href={safeHttpUrl(contribution.url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="op-text"
                >
                  View submitted link <Icon name="external" size={14} />
                </a>
              )}
              <Link className="op-text" to={BASE + "?tab=activity"}>
                View in My work <Icon name="arrow" size={15} />
              </Link>
            </section>
          )}
          {!BETA_PREVIEW && applying && !contribution && (
            <section className="contribution-form" id="contribution-form">
              <div className="review-title">
                <h2>{isTask ? "Apply for this task" : "Submit your entry"}</h2>
                <button
                  className="rd-icon-button"
                  aria-label="Close contribution form"
                  onClick={() => setApplying(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              <form onSubmit={submit} className="form-stack">
                <Field label={isTask ? "Your approach" : "About your work"}>
                  <textarea
                    required
                    minLength={20}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isTask
                        ? "Relevant experience, your approach and availability."
                        : "Describe how your work meets the criteria."
                    }
                  />
                </Field>
                <Field
                  label={
                    isTask ? "Portfolio link (optional)" : "Deliverable link"
                  }
                  error={error}
                >
                  <input
                    type="url"
                    required={!isTask}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setError("");
                    }}
                    placeholder="https://example.com/my-work"
                  />
                </Field>
                <p className="review-preview">
                  This example stays in your browser. Nothing is sent.
                </p>
                <button type="submit" className="op-button primary">
                  {isTask ? "Apply in preview" : "Submit in preview"}
                  <Icon name="arrow" size={16} />
                </button>
              </form>
            </section>
          )}
        </div>
        <aside className="detail-sidebar">
          <div className="reward-panel">
            <span className="open-label">
              {BETA_PREVIEW ? (
                <>
                  <Icon name="lock" size={13} />
                  Beta preview
                </>
              ) : (
                <>
                  <i />
                  Open for {isTask ? "applications" : "entries"}
                </>
              )}
            </span>
            <span className="op-label">
              {BETA_PREVIEW
                ? isTask
                  ? "Example reward"
                  : "Example prize pool"
                : isTask
                  ? "Fixed reward"
                  : "Prize pool"}
            </span>
            <div className="detail-amount">
              <Coin />
              <strong>
                {zec(item.reward)} <span>ZEC</span>
              </strong>
            </div>
            <span
              className="funding-label"
              title={
                BETA_PREVIEW
                  ? "Illustrative conversion · " + BETA_RATE_DATE
                  : undefined
              }
            >
              {BETA_PREVIEW
                ? "≈ " + betaUsd(item.reward) + " · illustrative"
                : "Pledged · funds not verified"}
            </span>
            {!isTask && (
              <ol className="prize-list">
                {item.prizes.map((p, i) => (
                  <li key={i}>
                    <span>
                      {i + 1}
                      {i === 0
                        ? "st"
                        : i === 1
                          ? "nd"
                          : i === 2
                            ? "rd"
                            : "th"}{" "}
                      place
                    </span>
                    <strong>{zec(p)} ZEC</strong>
                  </li>
                ))}
              </ol>
            )}
            <dl className="op-definition">
              <div>
                <dt>{isTask ? "Apply by" : "Submit by"}</dt>
                <dd>{formatDate(item.deadline)} · 23:59 UTC</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>Within {item.reviewDays} days</dd>
              </div>
              {isTask && (
                <div>
                  <dt>Delivery</dt>
                  <dd>{item.deliveryDays} days after assignment</dd>
                </div>
              )}
              <div>
                <dt>Reviewer</dt>
                <dd>{a.organizerFor(item.community).name}</dd>
              </div>
            </dl>
            {owner ? (
              <div className="owner-note">
                <Icon name="users" size={18} />
                <div>
                  <strong>You’re the organizer</strong>
                  <p>
                    {
                      a.submissions.filter((s) => s.opportunityId === item.id)
                        .length
                    }{" "}
                    {isTask ? "applications" : "entries"} received
                  </p>
                </div>
              </div>
            ) : (
              <button
                className="op-button primary full"
                disabled={BETA_PREVIEW || !!contribution}
                onClick={start}
              >
                {BETA_PREVIEW
                  ? isTask
                    ? "Applications soon"
                    : "Submissions soon"
                  : contribution
                    ? isTask
                      ? "Application received"
                      : "Entry received"
                    : isTask
                      ? "Apply for task"
                      : "Submit entry"}
                <Icon
                  name={
                    BETA_PREVIEW
                      ? "lock"
                      : contribution
                        ? "checkcircle"
                        : "arrow"
                  }
                  size={17}
                />
              </button>
            )}
            <button
              className="op-button full"
              onClick={() => a.toggleSave(item.id)}
            >
              <Icon name="bookmark" size={16} />
              {a.bookmarks.includes(item.id) ? "Saved" : "Save for later"}
            </button>
          </div>
          <div className="detail-process">
            <h3>
              {BETA_PREVIEW
                ? isTask
                  ? "Task workflow"
                  : "Contest workflow"
                : isTask
                  ? "Before you start"
                  : "How prizes are decided"}
            </h3>
            <p>
              {isTask
                ? "Apply first. The organizer selects one contributor, then the delivery window begins."
                : "Submit before the deadline. The organizer selects winners using the criteria in the brief."}
            </p>
            <p>
              {isTask
                ? "Payment follows acceptance of the delivered work."
                : "Winners and payment records are separate outcomes."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
export function OpportunitiesRoutes() {
  const a = useApp();
  if (a.path === BASE + "/new")
    return (
      <Editor
        key={a.params.get("draft") || a.params.get("campaign") || "new"}
      />
    );
  if (a.path === BASE + "/campaigns/new") return <Setup kind="campaign" />;
  if (a.path === BASE + "/communities/new") return <Setup kind="community" />;
  if (a.path.startsWith(BASE + "/tasks/")) {
    const item = a.items.find((o) => o.id === a.path.split("/").pop());
    return item ? (
      <Detail item={item} key={item.id} />
    ) : (
      <Empty title="Opportunity not found">
        <Link to={BASE} className="op-button">
          Back to opportunities
        </Link>
      </Empty>
    );
  }
  if (a.path.startsWith(BASE + "/campaigns/")) {
    const c = a.campaigns.find((c) => c.id === a.path.split("/").pop());
    return c ? (
      <CampaignDetail campaign={c} />
    ) : (
      <Empty title="Campaign not found" />
    );
  }
  if (a.path.startsWith(BASE + "/communities/")) {
    const id = a.path.split("/").pop()!;
    return a.organizers.some((o) => o.id === id) ? (
      <CommunityDetail id={id} />
    ) : (
      <Empty title="Organizer not found" />
    );
  }
  if (a.tab === "campaigns") return <Campaigns />;
  if (a.tab === "communities") return <Organizers />;
  if (a.tab === "activity") return <Work />;
  return <Overview />;
}
