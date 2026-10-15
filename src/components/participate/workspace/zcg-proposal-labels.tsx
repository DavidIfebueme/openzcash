"use client";

import type { CSSProperties, ReactNode } from "react";
import { CommitteeLabels } from "@/components/participate/workspace/committee-labels";
import { committeeLabelStyle, selectedCommitteeLabels } from "@/lib/participate/workspace/domain/committee-labels";
import { PROPOSAL_TAGS } from "@/lib/participate/workspace/domain/proposal-tags";
import { sourceCategoryTag, zcgCurrentStatusLabel, type ZcgSourceMetadata } from "@/lib/participate/workspace/domain/zcg-source-metadata";
import type { ParticipateProposalOutcome } from "@/lib/participate/official-proposals-model";
import { zcgSourceMetadata } from "@/lib/participate/workspace/data/zcg-source-metadata";
import { proposalSectors } from "@/lib/participate/workspace/domain/proposal-filters";

const outcomeLabels = { under_review: "Under review", approved: "Approved", rejected: "Rejected", filtered: "Filtered", abandoned: "Withdrawn", closed: "Closed" };

export function ZcgProposalLabels({ recordId, title, tags, committeeLabels = [], outcome, sourceOverride, categoryOverride, statusOverride }: { recordId: string; title: string; tags: readonly string[]; committeeLabels?: readonly string[]; outcome?: ParticipateProposalOutcome; sourceOverride?: ZcgSourceMetadata | null; categoryOverride?: string | null; statusOverride?: ReactNode }) {
  const source = sourceOverride === null ? undefined : sourceOverride ?? zcgSourceMetadata(recordId);
  const category = categoryOverride ?? source?.category;
  const sectors = proposalSectors(title, tags, category);
  const declared = sourceCategoryTag(category);
  const names = new Set(source?.labels.map(label => label.name.toLowerCase()) ?? []);
  const local = selectedCommitteeLabels(committeeLabels).filter(label => !names.has(label.name.toLowerCase())).map(label => label.id);
  const statusLabel = outcome && outcome !== "filtered" ? zcgCurrentStatusLabel(source, outcome) : null;
  const visibleLabels = outcome ? statusLabel ? [statusLabel] : [] : source?.labels ?? [];
  const extraLabels = outcome ? source?.labels.filter(label => label !== statusLabel) ?? [] : [];
  return <div className={`zcg-proposal-labels${outcome || statusOverride ? " zcg-proposal-labels--compact" : ""}`}>
    {statusOverride ?? (visibleLabels.length ? <div className="zcg-tag-group zcg-tag-group--labels">
      <ul className="committee-label-badges" aria-label="GitHub labels">{visibleLabels.map(label => <li key={label.name}>
        <span className="committee-label-badge" title={`Official GitHub label${label.description ? ` · ${label.description}` : ""}`} style={committeeLabelStyle(label.color) as CSSProperties}>{label.name}</span>
      </li>)}</ul>
    </div> : outcome ? <span className={`dao-status dao-status--${outcome}`}>{outcomeLabels[outcome]}</span> : null)}
    <div className="zcg-tag-group">
      {!outcome && !statusOverride ? <span className="zcg-tag-origin">Sectors</span> : null}
      <ul className="dao-proposal-tags" aria-label="Proposal sectors">{sectors.length ? sectors.map(id => {
        const tag = PROPOSAL_TAGS.find(tag => tag.id === id)!;
        return <li key={id} className={`dao-topic dao-topic--${tag.tone}`} title={id === declared ? `Applicant category on GitHub · ${category}` : "OpenZcash sector classification"}>{tag.label}</li>;
      }) : <li className="dao-topic dao-topic--slate" title="No category has been identified yet">Uncategorized</li>}</ul>
    </div>
    {local.length ? <div className="zcg-tag-group"><span className="zcg-tag-origin">Committee</span><CommitteeLabels ids={local} /></div> : null}
    {extraLabels.length ? <details className="zcg-extra-labels" name="proposal-extra-labels" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }} onKeyDown={event => {
      if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
    }}>
      <summary><span>{`+${extraLabels.length.toLocaleString("en-US")} ${extraLabels.length === 1 ? "label" : "labels"}`}</span></summary>
      <div className="zcg-extra-labels-panel"><span>Review & milestones</span><ul className="committee-label-badges" aria-label="Additional GitHub labels">{extraLabels.map(label => <li key={label.name}>
        <span className="committee-label-badge" title={`Official GitHub label${label.description ? ` · ${label.description}` : ""}`} style={committeeLabelStyle(label.color) as CSSProperties}>{label.name}</span>
      </li>)}</ul></div>
    </details> : null}
  </div>;
}
