"use client";
import { useEffect, useId, useRef, useState } from "react";
import { countries, countryFlag, countryName } from "./locales";
import { Dialog } from "./frame";
import { Icon } from "./visuals";

const searchText = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** One compact country control for both discovery and opportunity setup. */
export function CountryPicker({
  value,
  onChange,
  allowAll = false,
  hint,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) searchInput.current?.focus();
  }, [open]);
  const name = value === "all" ? "All countries" : countryName(value);
  const options = allowAll
    ? [{ code: "all", name: "All countries" }, ...countries]
    : countries;
  const search = searchText(query);
  const matches = options.filter(
    (country) =>
      searchText(country.name).includes(search) ||
      country.code.toLowerCase() === search,
  );
  return (
    <div className={"op-field country-field " + (error ? "invalid" : "")}>
      <label htmlFor={id}>Country</label>
      <button
        id={id}
        type="button"
        className="country-trigger"
        aria-label={"Country: " + name}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={hint || error ? id + "-hint" : undefined}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <span className="country-symbol" aria-hidden="true">
          {countryFlag(value)}
        </span>
        <span>{name}</span>
        <Icon name="down" size={14} />
      </button>
      {(error || hint) && (
        <small
          id={id + "-hint"}
          className={error ? "field-error" : undefined}
          role={error ? "alert" : undefined}
        >
          {error || hint}
        </small>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Choose a country"
        className="country-dialog"
      >
        <label className="op-search country-search">
          <Icon name="search" size={17} />
          <input
            ref={searchInput}
            aria-label="Search countries"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="country-results" role="status">
          {query ? matches.length + " matches" : "Search by name or country code"}
        </div>
        <div className="country-grid" role="group" aria-label="Countries">
          {matches.map((country) => (
            <button
              type="button"
              className="country-option"
              key={country.code}
              aria-label={country.name}
              aria-pressed={value === country.code}
              onClick={() => {
                onChange(country.code);
                setOpen(false);
              }}
            >
              <span className="country-symbol" aria-hidden="true">
                {countryFlag(country.code)}
              </span>
              <span>{country.name}</span>
              {value === country.code && <Icon name="check" size={14} />}
            </button>
          ))}
          {!matches.length && (
            <p className="country-empty">
              No countries found. Try another name or country code.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
