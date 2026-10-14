"use client";

import { useId } from "react";
import { PROPOSAL_TAGS } from "@/lib/participate/workspace/domain/proposal-tags";
import { EMPTY_PROPOSAL_FILTERS, type ProposalFilters } from "@/lib/participate/workspace/domain/proposal-filters";
import "./proposal-search.css";

export function ProposalSearch({ value, onChange }: {
  value: ProposalFilters;
  onChange: (value: ProposalFilters) => void;
}) {
  const id = useId();
  const active = Boolean(value.query.trim() || value.category !== "all");
  return <div className="proposal-search-tools">
    <form role="search" aria-label="Search and filter proposals" onSubmit={event => event.preventDefault()}>
      <label className="proposal-search-input">
        <span className="dao-sr-only">Search proposals</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input type="search" value={value.query} onChange={event => onChange({ ...value, query: event.target.value })} placeholder="Search proposals…" title="Search by proposal, author or issue number" autoComplete="off" aria-controls="proposal-results" />
      </label>
      <div className="proposal-category-select">
        <label className="dao-sr-only" htmlFor={id}>Category</label>
        <select id={id} value={value.category} onChange={event => onChange({ ...value, category: event.target.value as ProposalFilters["category"] })} aria-controls="proposal-results">
          <option value="all">All categories</option>
          {PROPOSAL_TAGS.map(tag => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
          <option value="uncategorized">Uncategorized</option>
        </select>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </div>
      {active ? <button type="button" className="dao-text-button proposal-clear-filters" onClick={() => onChange(EMPTY_PROPOSAL_FILTERS)} aria-label="Clear filters" title="Clear filters">×</button> : null}
    </form>
  </div>;
}
