import type { ReactNode } from "react";
import { BETA_PREVIEW, betaUsd, BETA_RATE_DATE } from "./beta";
import { languageName, countryName, countryFlag } from "./locales";
import { BASE, type Opportunity } from "./model";
import { zec, formatDate } from "./data";
import { Link, useApp } from "./state";
import { Coin, Icon, Illustration } from "./visuals";
export function BetaNote({ children }: { children: ReactNode }) {
  return (
    <div className="beta-note">
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="op-heading">
      <div>
        <h1>{title}</h1>
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
        <span className="reward-badge">
          <Coin />
          {zec(item.reward)} ZEC
        </span>
        <span className="status-badge">{BETA_PREVIEW ? "Beta" : "Open"}</span>
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
        <div className="op-tags">
          <span>{item.type}</span>
          <span>{item.category}</span>
        </div>
        <div className="op-card-facts">
          <div
            title={
              BETA_PREVIEW
                ? "Illustrative conversion · " + BETA_RATE_DATE
                : undefined
            }
          >
            <span>
              {BETA_PREVIEW
                ? "Example value"
                : item.type === "Task"
                  ? "Applicants"
                  : "Entries"}
            </span>
            <strong>
              {BETA_PREVIEW
                ? "≈ " + betaUsd(item.reward)
                : item.applicants +
                  submissions.filter((s) => s.opportunityId === item.id).length}
            </strong>
          </div>
          <div>
            <span>
              {BETA_PREVIEW
                ? "Example deadline"
                : item.type === "Task"
                  ? "Apply by"
                  : "Submit by"}
            </span>
            <strong>{formatDate(item.deadline)}</strong>
          </div>
          <Icon name="arrow" size={19} />
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
}: {
  title: string;
  description: string;
  stats: [string, string][];
}) {
  return (
    <section className="op-hero">
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
      <div className="op-hero-content">
        <h1>{title}</h1>
        <p>{description}</p>
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
