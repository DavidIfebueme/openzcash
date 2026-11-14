import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import Image from "next/image";
import { countryFlag, countryName, languageName } from "./locales";
import { type ProviderId, platformFor } from "./catalog";
import { Coin, Icon } from "./visuals";
export function Heading({ title, description, action, level = 1 }: { title: string; description?: string; action?: ReactNode; level?: 1 | 2 }) {
  const Title = level === 1 ? "h1" : "h2";
  return <div className="op-heading"><div><Title>{title}</Title>{description && <p>{description}</p>}</div>{action}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="op-empty"><Icon name="search" size={26} /><h2>{title}</h2>{children}</div>;
}
export function PlatformMark({ id }: { id: ProviderId }) {
  const platform = platformFor(id);
  return <span className="directory-source">{platform.logo ? <Image unoptimized width={22} height={22} src={platform.logo} alt="" /> : <span className="directory-monogram" aria-hidden="true">{platform.name[0]}</span>}<span>{platform.name}</span></span>;
}
export function LocaleSummary({ language, country, location }: { language?: string; country?: string; location?: string }) {
  if (!language && !country && !location) return null;
  return <div className="locale-summary"><span>{language ? languageName(language) : ""}</span>{country ? <span title={countryName(country)}><span aria-hidden="true">{countryFlag(country)}</span> {countryName(country)}</span> : location ? <span>{location}</span> : null}</div>;
}
export function Hero() {
  return <section className="op-hero op-hero-compact directory-hero"><div className="op-hero-content">
    <div className="op-hero-intro"><h1>Find your next opportunity.</h1><p>Quests, bounties, jobs and testing.<br />Discover here. Participate at the source.</p></div>
    <div className="directory-hero-mark" aria-hidden="true"><Coin /></div>
  </div></section>;
}
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }> }) {
  const id = useId();
  return <div className={"op-field " + (error ? "invalid" : "")}><label htmlFor={id}>{label}</label>{cloneElement(children, { id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? id + "-help" : undefined })}{error || hint ? <small id={id + "-help"} className={error ? "field-error" : undefined} role={error ? "alert" : undefined}>{error || hint}</small> : null}</div>;
}
