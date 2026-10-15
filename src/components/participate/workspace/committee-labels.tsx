"use client";

import { useRef, useState, type CSSProperties } from "react";
import { passkeyFetch } from "@/lib/participate/workspace/auth/passkey-client";
import { COMMITTEE_LABEL_CATALOG, COMMITTEE_LABEL_GROUPS, COMMITTEE_LABELS, committeeLabelStyle, selectedCommitteeLabels, type CommitteeLabel } from "@/lib/participate/workspace/domain/committee-labels";

function LabelBadge({ label }: { label: CommitteeLabel }) {
  return <span className="committee-label-badge" style={committeeLabelStyle(label.color) as CSSProperties} title={label.description || label.name}>{label.name}</span>;
}

export function CommitteeLabels({ ids = [] }: { ids?: readonly string[] }) {
  const labels = selectedCommitteeLabels(ids);
  if (!labels.length) return null;
  return <ul className="committee-label-badges" aria-label="Committee labels">{labels.map(label => <li key={label.id}><LabelBadge label={label} /></li>)}</ul>;
}

export function CommitteeLabelEditor({ recordId, labels, version, canReview, canSave, demo, onSaved, onReload }: {
  recordId: string; labels: string[]; version: number; canReview: boolean; canSave: boolean; demo: boolean;
  onSaved: (value: { labels: string[]; labelsVersion: number }) => void; onReload: () => Promise<void>;
}) {
  const [selection, setSelection] = useState(labels);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("Review");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [stale, setStale] = useState(false);
  const guard = useRef(false);
  const changed = JSON.stringify([...selection].sort()) !== JSON.stringify([...labels].sort());
  const matches = COMMITTEE_LABELS.filter(label => (group === "All" || label.group === group) && `${label.name} ${label.description}`.toLocaleLowerCase("en").includes(search.trim().toLocaleLowerCase("en")));
  async function save() {
    if (guard.current || !canSave || !canReview || !changed || stale) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const value = await passkeyFetch<{ labels: string[]; labelsVersion: number }>("/api/participate/committee", { action: "labels", recordId, version, labels: [...selection].sort() });
      onSaved(value);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setStale(code === "COMMITTEE_REFRESH_REQUIRED");
      setError(code === "COMMITTEE_REFRESH_REQUIRED" ? "Labels changed. Reload before editing again." : code === "COMMITTEE_FORBIDDEN" || code === "COMMITTEE_VERIFIED_ACCOUNT_REQUIRED" ? "A verified committee reviewer account is required." : code === "COMMITTEE_PROPOSAL_UNAVAILABLE" ? "This proposal is no longer available to this committee." : "Labels could not be saved. Try again.");
    } finally { guard.current = false; setBusy(false); }
  }
  return <section className="committee-label-editor" aria-label="Edit committee labels">
    <div className="committee-label-heading"><div><h3>Public proposal tags <span>{COMMITTEE_LABELS.length}</span></h3><p>Local annotations shown on the public proposal. Source labels, verdicts and payments stay separate.</p></div><a href={COMMITTEE_LABEL_CATALOG.url} target="_blank" rel="noopener noreferrer">ZCG catalog ↗</a></div>
    {canReview ? <>
      <div className="committee-label-search"><label><span className="dao-sr-only">Search labels</span><input type="search" placeholder="Search labels…" value={search} onChange={event => setSearch(event.target.value)} /></label><label><span className="dao-sr-only">Label category</span><select value={group} onChange={event => setGroup(event.target.value)}><option>All</option>{COMMITTEE_LABEL_GROUPS.map(item => <option key={item}>{item}</option>)}</select></label></div>
      {selection.length ? <div className="committee-label-selection"><span>{selection.length} selected</span><div>{selectedCommitteeLabels(selection).map(label => <button type="button" key={label.id} aria-label={`Remove ${label.name}`} disabled={busy || stale} onClick={() => setSelection(current => current.filter(id => id !== label.id))}><LabelBadge label={label} /><span aria-hidden="true">×</span></button>)}</div></div> : null}
      <fieldset className="committee-label-options" disabled={busy || stale}><legend className="dao-sr-only">Available ZCG labels</legend>
        {matches.map(label => <label key={label.id}><input type="checkbox" checked={selection.includes(label.id)} onChange={event => setSelection(current => event.target.checked ? [...current, label.id] : current.filter(id => id !== label.id))} /><span><LabelBadge label={label} />{label.description ? <small>{label.description}</small> : null}</span></label>)}
        {!matches.length ? <p>No labels match your search.</p> : null}
      </fieldset>
      {error ? <p className="dao-form-error" role="alert">{error}</p> : null}
      <div className="committee-label-footer"><span>{demo ? "Read-only preview · Saving requires an authorized committee role and enabled operations." : !canSave ? "Verify your email to save labels." : "Changes are recorded in the proposal’s public history."}</span><div>{stale ? <button type="button" className="dao-button" disabled={busy} onClick={() => void onReload()}>Reload labels</button> : <button type="button" className="dao-text-button" disabled={busy || !changed} onClick={() => { setSelection(labels); setError(""); }}>Reset</button>}<button type="button" className="dao-button dao-button--primary" disabled={busy || !canSave || !changed || stale} onClick={() => void save()}>{busy ? "Saving…" : "Save labels"}</button></div></div>
    </> : <><CommitteeLabels ids={labels} /><p>Only committee reviewers can change labels.</p></>}
  </section>;
}
