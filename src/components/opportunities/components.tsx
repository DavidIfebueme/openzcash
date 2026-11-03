import type { ReactNode } from "react";
import { BETA_PREVIEW, betaUsd, BETA_RATE_DATE } from "./beta";
import { languageName, countryName, countryFlag } from "./locales";
import { BASE, type Opportunity } from "./model";
import { zec, formatDate } from "./data";
import { Link, useApp } from "./state";
import { Coin, Icon, Illustration } from "./visuals";
export function BetaNote({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={"beta-note" + (compact ? " beta-note-compact" : "")}>
      <span className="beta-label">Beta</span>
      <p>{children}</p>
      <Icon name="lock" size={15} />
    </div>
  );
}
export function Heading({
  title,
  description,
  action,
  level = 1,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 1 | 2;
}) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <div className="op-heading">
      <div>
        <Title>{title}</Title>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="op-empty">
      <Icon name="search" size={26} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function OrganizerTag({ id }: { id: string }) {
  const { organizerFor } = useApp();
  const c = organizerFor(id);
  return (
    <Link to={BASE + "/communities/" + id} className="organizer-tag">
      <span className={"organizer-mark " + c.color}>{c.mark}</span>
      <span>{c.name}</span>
    </Link>
  );
}
export function LocaleSummary({
  language,
  country,
  className = "",
}: {
  language?: string;
  country?: string;
  className?: string;
}) {
  return (
    <div className={"locale-summary " + className}>
      <span
        className="locale-language"
        title={"Language: " + languageName(language)}
      >
        <bdi>{languageName(language)}</bdi>
      </span>
      <span
        className="locale-country"
        title={countryName(country)}
        aria-label={"Country: " + countryName(country)}
      >
        <span className="country-flag" aria-hidden="true">
          {countryFlag(country)}
        </span>
        <span>{countryName(country)}</span>
      </span>
    </div>
  );
}
export function Card({ item }: { item: Opportunity }) {
  const { bookmarks, toggleSave, submissions } = useApp();
  const saved = bookmarks.includes(item.id);
  return (
    <article className="op-card">
      <div className="op-card-art">
        <Link to={BASE + "/tasks/" + item.id} aria-label={"View " + item.title}>
          <Illustration kind={item.art} />
        </Link>
      </div>
      <div className="op-card-body">
        <div className="op-card-organizer">
          <OrganizerTag id={item.community} />
          <button
            className={"op-save " + (saved ? "saved" : "")}
            aria-label={(saved ? "Unsave " : "Save ") + item.title}
            aria-pressed={saved}
            onClick={() => toggleSave(item.id)}
          >
            <Icon name="bookmark" size={18} />
          </button>
        </div>
        <h2>
          <Link to={BASE + "/tasks/" + item.id}>{item.title}</Link>
        </h2>
        <div className="op-card-tagline">
          <div className="op-tags">
            <span>{item.type}</span>
            <span>{item.category}</span>
          </div>
          <span className="op-card-status">
            {BETA_PREVIEW ? "Beta" : "Open"}
          </span>
        </div>
        <div className="op-card-facts">
          <div
            title={
              BETA_PREVIEW
                ? "Illustrative conversion · " + BETA_RATE_DATE
                : undefined
            }
          >
            <span>{BETA_PREVIEW ? "Example reward" : "Reward"}</span>
            <strong className="op-card-amount">
              <Coin />
              {zec(item.reward)} <small>ZEC</small>
            </strong>
            {BETA_PREVIEW ? (
              <small className="op-card-conversion">
                ≈ {betaUsd(item.reward)}
              </small>
            ) : (
              <small className="op-card-conversion">
                {item.applicants +
                  submissions.filter((s) => s.opportunityId === item.id).length}{" "}
                {item.type === "Task" ? "applicants" : "entries"}
              </small>
            )}
          </div>
          <div className="op-card-deadline">
            <span>
              {BETA_PREVIEW
                ? "Example deadline"
                : item.type === "Task"
                  ? "Apply by"
                  : "Submit by"}
            </span>
            <strong>
              <time dateTime={item.deadline}>{formatDate(item.deadline)}</time>
            </strong>
          </div>
        </div>
        <LocaleSummary
          language={item.language}
          country={item.country}
          className="op-card-locale"
        />
      </div>
    </article>
  );
}
export function Hero({
  title,
  description,
  stats,
  compact = false,
}: {
  title: string;
  description: string;
  stats: [string, string][];
  compact?: boolean;
}) {
  return (
    <section className={"op-hero" + (compact ? " op-hero-compact" : "")}>
      {!compact && (
        <>
          <div className="hero-pattern left" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <Coin key={i} black={i % 3 === 2} />
            ))}
          </div>
          <div className="hero-pattern right" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <Coin key={i} black={i % 3 === 2} />
            ))}
          </div>
        </>
      )}
      <div className="op-hero-content">
        <div className="op-hero-intro">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {compact && (
          <div className="op-hero-art" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Coin key={i} black={i === 2 || i === 4} />
            ))}
          </div>
        )}
        <div className="hero-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={"op-field " + (error ? "invalid" : "")}>
      <span>{label}</span>
      {children}
      {error ? (
        <small className="field-error" role="alert">
          {error}
        </small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}
