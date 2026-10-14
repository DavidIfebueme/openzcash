"use client";

import Link from "next/link";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { formatTreasuryZec, type CommunityTreasuryView } from "@/lib/participate/workspace/domain/treasury";
import { formatProposalUsd, PROPOSAL_SETTLEMENT_LABEL } from "@/lib/participate/workspace/domain/proposal-funding";
import type { CreditScope } from "@/lib/participate/workspace/domain/credit-scope";
import type { AccountProfile } from "@/lib/participate/workspace/domain/account-profile";
import type { AccountCreditSummary } from "@/lib/participate/workspace/domain/participation-credits";
import type { DemoPersona } from "@/lib/participate/workspace/auth/demo-persona";
import { WorkspaceAccount } from "@/components/participate/workspace/workspace-account";
import { WorkspaceSignInButton } from "@/components/participate/workspace/workspace-auth";
import { TreasuryActions } from "@/components/participate/workspace/treasury-actions";
import { getWorkspaceVotePreview } from "@/lib/participate/workspace/domain/workspace-vote-preview";
import { WorkspaceVotePreviewBar } from "@/components/participate/workspace/workspace-vote-preview";
import { ProposalCard } from "./proposal-card";
import { PROPOSAL_TAGS } from "@/lib/participate/workspace/domain/proposal-tags";
import { proposalSectors } from "@/lib/participate/workspace/domain/proposal-filters";
import { useParticipateHost } from "@/components/participate/workspace/participate-bridge";
import { DiscussionNotifications } from "@/components/participate/workspace/discussion-notifications";

export type WorkspaceCommunity = { id: string; name: string; slug: string };
export type WorkspaceViewer = { nick: string; role: "OWNER" | "MANAGER" | "REVIEWER" | "MODERATOR" | "MEMBER" | "PARTICIPANT" | "VISITOR"; canEditProfile?: boolean; committeeEntry?: { label: string; href: string }; demoPersona?: DemoPersona; canPreviewCommittee?: boolean; canModeratePilot?: boolean };
export type WorkspaceSection = "proposals" | "treasury" | "members" | "coinholder";
export type WorkspaceProposal = {
  id: string;
  question: string;
  status: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  commentCount: number | null;
  treasuryName?: string;
  requestedAmountZat?: string;
  requestedAmountUsdCents?: string;
  tags?: string[];
};
export type WorkspaceFrameProps = {
  community: WorkspaceCommunity;
  communities: WorkspaceCommunity[];
  viewer: WorkspaceViewer | null;
  activeSection?: WorkspaceSection;
  isDemo?: boolean;
  workspaceModule?: "proposals" | "dao";
  creditScope?: CreditScope;
  initialProfile?: AccountProfile | null;
  initialCreditSummary?: AccountCreditSummary | null;
  embedded?: boolean;
  embeddedSection?: "proposals" | "history" | "committee";
  children: ReactNode;
};
export type CommunityWorkspaceProps = Omit<WorkspaceFrameProps, "children" | "activeSection"> & {
  treasury: CommunityTreasuryView | null;
  proposals: WorkspaceProposal[];
  memberCount: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ANCHORING: "Preparing",
  SCHEDULED: "Scheduled",
  OPEN: "Voting open",
  CLOSED: "Tally pending",
  FINALIZED: "Finalized",
  ARCHIVED: "Archived"
};
const IN_PROGRESS_STATUSES = new Set(["OPEN", "SCHEDULED", "ANCHORING"]);
const FILTERS = ["All", "In progress", "Draft", "Closed"] as const;
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
});

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormat.format(date);
}

function NavIcon({ name }: { name: WorkspaceSection }) {
  const paths = {
    proposals: <><path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    treasury: <><path d="M3 8h18M5 8v11m5-11v11m4-11v11m5-11v11M3 21h18M2 6l10-4 10 4" /></>,
    members: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" /></>,
    coinholder: <><circle cx="12" cy="12" r="9" /><path d="M8 8h8l-8 8h8M12 5v3m0 8v3" /></>
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function WorkspaceFrame({ community, viewer, activeSection = "proposals", workspaceModule = "dao", creditScope, initialProfile, initialCreditSummary, embedded = false, embeddedSection = "proposals", children }: WorkspaceFrameProps) {
  const openHostView = useParticipateHost();
  function navigateEmbedded(event: MouseEvent<HTMLAnchorElement>, view: "proposals" | "history" | "committee") {
    if (!openHostView || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openHostView(view);
  }
  const base = `/communities/${encodeURIComponent(community.id)}`;
  const participant = viewer?.role === "PARTICIPANT";
  const canManage = viewer?.role === "OWNER" || viewer?.role === "MANAGER";
  const roleLabel = workspaceModule === "proposals" ? "Account" : participant ? "Invited participant" : viewer?.role === "OWNER" ? "Owner" : viewer?.role === "MANAGER" ? "Manager" : viewer?.role === "MEMBER" ? "Member" : "Account";
  const links = [
    { section: "proposals" as const, label: "Decisions", href: `${base}/dao` },
    ...(canManage ? [
      { section: "treasury" as const, label: "Treasury", href: `${base}/treasury` },
      { section: "members" as const, label: "Members", href: `${base}/members` }
    ] : [{ section: "members" as const, label: "Membership", href: `${base}/join` }])
  ];
  return (
    <div className={`dao-app${embedded ? " dao-app--embedded" : ""}`}>
      <a className="dao-skip-link" href="#dao-main">Skip to content</a>
      <header className="dao-header">
        <div className="dao-header-main">
          {!embedded ? <><Link className="dao-brand" href={participant ? "/polls" : base} aria-label="Proposals home">
            <span className="dao-zcash-mark" aria-hidden="true" />
          </Link>
          <nav className="dao-navigation dao-module-navigation" aria-label="Community navigation">
            {participant ? <Link className="dao-nav-link dao-nav-link--active" href="/polls" aria-current="page">Poll board</Link> : <>
              <Link href={base} className={`dao-nav-link${workspaceModule === "proposals" ? " dao-nav-link--active" : ""}`} aria-current={workspaceModule === "proposals" ? "page" : undefined}><NavIcon name="proposals" /><span>Proposals</span></Link>
              <Link href={`${base}/dao`} className={`dao-nav-link${workspaceModule === "dao" ? " dao-nav-link--active" : ""}`} aria-current={workspaceModule === "dao" ? "page" : undefined}><NavIcon name="treasury" /><span>DAO</span></Link>
            </>}
          </nav>
          </> : <>
            <Link className="dao-brand" href="/zcg/participate" prefetch={false} aria-label="Proposals home" onClick={event => navigateEmbedded(event, "proposals")}><span className="dao-zcash-mark" aria-hidden="true" /></Link>
            <nav className="dao-navigation participate-navigation" aria-label="Participation navigation">
              <Link href="/zcg/participate" prefetch={false} onClick={event => navigateEmbedded(event, "proposals")} className={`dao-nav-link${embeddedSection === "proposals" ? " dao-nav-link--active" : ""}`} aria-current={embeddedSection === "proposals" ? "page" : undefined}>Proposals</Link>
              <Link href="/zcg/participate?view=history" prefetch={false} onClick={event => navigateEmbedded(event, "history")} className={`dao-nav-link${embeddedSection === "history" ? " dao-nav-link--active" : ""}`} aria-current={embeddedSection === "history" ? "page" : undefined}>Decision history</Link>
              {viewer?.committeeEntry ? <Link href={viewer.committeeEntry.href} prefetch={false} onClick={event => navigateEmbedded(event, "committee")} title={viewer.committeeEntry.label} className={`dao-nav-link${embeddedSection === "committee" ? " dao-nav-link--active" : ""}`} aria-current={embeddedSection === "committee" ? "page" : undefined}>Committee</Link> : null}
            </nav>
          </>}
          <div className="dao-account">
            {embedded && openHostView ? <button type="button" className="participate-about" aria-label="About Participate" title="About Participate" onClick={() => openHostView("about")}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5h.01" /></svg><span>About Participate</span></button> : null}
            {embedded && viewer && viewer.canEditProfile !== false ? <DiscussionNotifications key={`${community.id}:${viewer.nick}`} communityId={community.id} /> : null}
            <div className="participate-account-anchor" data-participate-tour="account">{viewer ? <WorkspaceAccount key={viewer.nick} nick={viewer.nick} roleLabel={roleLabel} canEditProfile={viewer.canEditProfile} communityId={community.id} creditScope={creditScope} initialProfile={initialProfile} initialCreditSummary={initialCreditSummary} committeeEntry={viewer.committeeEntry} demoPersona={viewer.demoPersona} canPreviewCommittee={viewer.canPreviewCommittee} canModeratePilot={viewer.canModeratePilot} /> : <WorkspaceSignInButton />}</div>
          </div>
        </div>
      </header>
      {workspaceModule === "dao" && !participant ? <div className="dao-module-bar"><span>{community.name}</span><nav aria-label="DAO navigation">{links.map(item => <Link key={item.section} href={item.href} aria-current={activeSection === item.section ? "page" : undefined}>{item.label}</Link>)}</nav></div> : null}
      <main id="dao-main" className="dao-main" tabIndex={-1}>{children}</main>
    </div>
  );
}

export const CommunityShell = WorkspaceFrame;

export function CommunityWorkspace({ community, communities, viewer, treasury, proposals, memberCount, isDemo }: CommunityWorkspaceProps) {
  const [balanceUpdate, setBalanceUpdate] = useState<{ source: CommunityTreasuryView | null; value: CommunityTreasuryView } | null>(null);
  const balances = balanceUpdate?.source === treasury ? balanceUpdate.value : treasury;
  const canManage = viewer?.role === "OWNER" || viewer?.role === "MANAGER";
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const base = `/communities/${encodeURIComponent(community.id)}`;
  const displayedProposals = useMemo(() => proposals.map((proposal, index) => {
    const previewVote = getWorkspaceVotePreview(index, isDemo === true && community.id === "preview_orchard");
    return {
      ...proposal,
      previewVote,
      displayStatus: previewVote ? (previewVote.outcome === "ongoing" ? "OPEN" : "CLOSED") : proposal.status
    };
  }), [proposals, isDemo, community.id]);
  const inProgressCount = displayedProposals.filter(proposal => IN_PROGRESS_STATUSES.has(proposal.displayStatus)).length;
  const filtered = useMemo(() => displayedProposals.filter(proposal => {
    const matches = filter === "All"
      || (filter === "In progress" && IN_PROGRESS_STATUSES.has(proposal.displayStatus))
      || (filter === "Draft" && proposal.displayStatus === "DRAFT")
      || (filter === "Closed" && ["CLOSED", "FINALIZED", "ARCHIVED"].includes(proposal.displayStatus));
    const sectors = proposalSectors(proposal.question, proposal.tags ?? []);
    const searchable = [proposal.question, ...(sectors.length ? PROPOSAL_TAGS.filter(tag => sectors.includes(tag.id)).map(tag => tag.label) : ["Uncategorized"])].join(" ");
    return matches && searchable.toLocaleLowerCase("en-US").includes(search.trim().toLocaleLowerCase("en-US"));
  }), [filter, displayedProposals, search]);

  return (
    <WorkspaceFrame community={community} communities={communities} viewer={viewer} isDemo={isDemo}>
      <div className={`dao-board-layout${balances ? "" : " dao-board-layout--public"}`}>
        <section id="proposals" className="dao-proposals-section" aria-labelledby="dao-proposals-heading">
          <div className="dao-section-heading dao-proposals-heading">
            <h1 id="dao-proposals-heading">DAO decisions</h1>
            <div className="dao-proposal-heading-actions">
            {canManage ? (
              <Link className="dao-button dao-button--primary" href={`${base}/proposals/new`}><span aria-hidden="true">+</span> New proposal</Link>
            ) : null}
            </div>
          </div>

          <div className="dao-proposal-tools">
            <div className="dao-filter-list" aria-label="Filter proposals">
              {FILTERS.filter(item => canManage || item !== "Draft").map(item => (
                <button key={item} type="button" aria-pressed={filter === item} className={`dao-filter${filter === item ? " dao-filter--active" : ""}`} onClick={() => setFilter(item)}>{item}{item === "All" ? <span>{proposals.length}</span> : null}</button>
              ))}
            </div>
            <label className="dao-search">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
              <span className="dao-sr-only">Search proposals</span>
              <input type="search" placeholder="Search proposals" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
          </div>
          <ul className="dao-proposal-list">
            {filtered.map(proposal => (
              <ProposalCard key={proposal.id} recordId={proposal.id}
                title={<Link className="dao-proposal-title" href={`${base}/proposals/${encodeURIComponent(proposal.id)}`}>{proposal.question}</Link>}
                submittedAt={proposal.createdAt}
                closesAt={proposal.previewVote && proposal.previewVote.outcome !== "ongoing" ? undefined : proposal.closesAt}
                budget={<div className="dao-zcg-budget">
                  {proposal.requestedAmountUsdCents ? <><div className="dao-zcg-budget-amount"><Link href={`${base}/proposals/${encodeURIComponent(proposal.id)}`} aria-label={`${formatProposalUsd(proposal.requestedAmountUsdCents)} requested. ${PROPOSAL_SETTLEMENT_LABEL}`} title={proposal.treasuryName ? `Requested from ${proposal.treasuryName}` : "Requested funding"}><strong>{formatProposalUsd(proposal.requestedAmountUsdCents).replace(" USD", "").replace(/\.00$/, "")}</strong></Link><span>USD requested</span></div><span>Payable in ZEC</span></>
                    : proposal.requestedAmountZat ? <div className="dao-zcg-budget-amount"><Link href={`${base}/proposals/${encodeURIComponent(proposal.id)}`} aria-label={`${formatTreasuryZec(proposal.requestedAmountZat)} ZEC requested`}><strong>{formatTreasuryZec(proposal.requestedAmountZat)}</strong></Link><span>ZEC requested</span></div>
                      : <span>Amount not specified</span>}
                </div>}
                labels={{ title: proposal.question, tags: proposal.tags ?? [], sourceOverride: null,
                  statusOverride: <span className={`dao-status dao-status--${proposal.previewVote?.outcome ?? proposal.status.toLowerCase()}`}>{proposal.previewVote ? ({ approved: "Approved", rejected: "Rejected", ongoing: "In progress" } as const)[proposal.previewVote.outcome] : STATUS_LABELS[proposal.status] ?? proposal.status}</span> }}
                engagement={<div className="dao-proposal-meta"><Link href={`${base}/proposals/${encodeURIComponent(proposal.id)}#discussion`} aria-label={proposal.commentCount === null ? `Discussion on ${proposal.question}` : `${proposal.commentCount} comments on ${proposal.question}`}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2v3l4-3h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" /></svg>
                  {proposal.commentCount === null ? "Discussion" : <>{proposal.commentCount} {proposal.commentCount === 1 ? "comment" : "comments"}</>}
                </Link></div>}
                actions={<Link className="dao-text-button" href={`${base}/proposals/${encodeURIComponent(proposal.id)}`}>Read proposal →</Link>}
              >
                {proposal.previewVote ? <WorkspaceVotePreviewBar vote={proposal.previewVote} /> : null}
              </ProposalCard>
            ))}
          </ul>
          {filtered.length === 0 ? (
            <div className="dao-empty-state"><p>{search || filter !== "All" ? "No matching proposals." : "No proposals yet."}</p><span>{search || filter !== "All" ? "Try another search or filter." : "Start with a community idea."}</span></div>
          ) : null}
        </section>
        {balances ? <aside className="dao-community-sidebar" aria-label="Community and treasury information">
          <section className="dao-community-summary" aria-labelledby="dao-community-summary-heading">
            <h2 id="dao-community-summary-heading">Community</h2>
            <dl className="dao-community-stats">
              <div><dt>{memberCount === 1 ? "Member" : "Members"}</dt><dd>{memberCount}</dd></div>
              <div className="dao-stat-active"><dt>In progress</dt><dd>{inProgressCount}</dd></div>
              <div><dt>Proposals</dt><dd>{proposals.length}</dd></div>
            </dl>
          </section>
          <section className="dao-treasury-section" id="treasury" aria-labelledby="dao-treasury-heading">
            <div className="dao-section-heading"><h2 id="dao-treasury-heading">Treasury</h2><Link className="dao-text-button" href={`${base}/treasury`}>View treasury <span aria-hidden="true">↗</span></Link></div>
            <div className="dao-treasury-cards">
              {balances.funds.map(fund => (
                <article className={`dao-treasury-card${fund.kind === "SUSTAINABILITY" ? " dao-treasury-card--sustainability" : ""}`} key={fund.kind}>
                  <div className="dao-fund-title">
                    <svg className="dao-fund-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {fund.kind === "SUSTAINABILITY" ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></> : <><path d="M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm0 0V5a2 2 0 0 1 2-2h12v4" /><path d="M21 11h-5v4h5" /></>}
                    </svg>
                    <h3>{fund.name.replace(/ Treasury$/, "")}</h3>
                    <span className="dao-fund-role">{fund.kind === "SUSTAINABILITY" ? "Reserve" : "Initiatives"}</span>
                  </div>
                  <details className="dao-fund-details">
                    <summary aria-label={`${fund.name}: ${formatTreasuryZec(fund.availableZat)} ZEC available. ${viewer?.role === "OWNER" && balances.canManage ? "Manage treasury" : "View breakdown"}`}>
                      <span className="dao-fund-balance"><span className="dao-balance-label">Available</span><span className="dao-fund-amount"><span>{formatTreasuryZec(fund.availableZat)}</span><span className="dao-currency">ZEC</span></span></span>
                      <span className="dao-fund-action">{viewer?.role === "OWNER" && balances.canManage ? "Manage" : "Details"}</span>
                    </summary>
                    <dl className="dao-fund-breakdown">
                      <div><dt>Reserved</dt><dd>{formatTreasuryZec(fund.reservedZat)} <span>ZEC</span></dd></div>
                      <div><dt>Committed</dt><dd>{formatTreasuryZec(fund.committedZat)} <span>ZEC</span></dd></div>
                      <div><dt>Paid</dt><dd>{formatTreasuryZec(fund.paidZat)} <span>ZEC</span></dd></div>
                    </dl>
                    <TreasuryActions key={`${community.id}-${fund.kind}`} communityId={community.id} treasuryKind={fund.kind} canManage={viewer?.role === "OWNER" && balances.canManage} onUpdated={value => setBalanceUpdate({ source: treasury, value })} />
                  </details>
                </article>
              ))}
            </div>
            <p className="dao-ledger-note"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></svg><span>Recorded budgets<span className="dao-wallet-status">Wallet not connected</span></span></p>
          </section>
          <details className="dao-activity-details">
            <summary>Recent activity</summary>
            <ol className="dao-activity-list">
              {balances.recentActivity.slice(0, 3).map(entry => (
                <li key={entry.id}>
                  <span className={`dao-activity-dot${entry.toTreasuryKind === "SUSTAINABILITY" ? " dao-activity-dot--gold" : ""}`} aria-hidden="true" />
                  <div>
                    <p className="dao-activity-title">{entry.kind === "FUNDING" ? "Funding recorded" : "Budget allocated"}</p>
                    <p className="dao-activity-amount">{formatTreasuryZec(entry.amountZat)} ZEC <span>to {entry.toTreasuryKind === "SUSTAINABILITY" ? "sustainability" : "community"}</span></p>
                    <p className="dao-activity-reason">{entry.reason}</p>
                    <p className="dao-activity-meta">{entry.actorLabel}<span aria-hidden="true"> · </span><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time></p>
                  </div>
                </li>
              ))}
            </ol>
            {balances.recentActivity.length === 0 ? <p className="dao-quiet-empty">No activity yet.</p> : null}
          </details>
        </aside> : null}
      </div>
    </WorkspaceFrame>
  );
}
