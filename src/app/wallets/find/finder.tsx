"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CommunityCredit } from "@/components/community-credit";
import { PageHeader } from "@/components/ui";
import { WALLET_EVIDENCE } from "@/lib/wallet-finder/evidence";
import {
  capabilityReason, DEFAULT_REQUIREMENTS, matchWallets, parseWalletRequirements,
  PLATFORM_LABELS, walletRequirementsQuery,
} from "@/lib/wallet-finder/matching";
import type { CapabilityEvidence, MatchReason, WalletMatch, WalletRequirements } from "@/lib/wallet-finder/types";
import { EDITORIAL_HIGHLIGHTS, HARDWARE, SOFTWARE } from "../catalog-data";
import styles from "./finder.module.css";

const CATALOG = new Map([...SOFTWARE, ...HARDWARE].map(wallet => [wallet.name, wallet]));
const STATE_LABELS = { supported: "Supported", unsupported: "Not supported", unknown: "Unknown" } as const;

function readParams(params: Pick<URLSearchParams, "forEach" | "getAll">): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  params.forEach((_value, key) => {
    const all = params.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  });
  return values;
}

function checkedDate(date: CapabilityEvidence["checkedAt"]): string {
  if (!date) return "Not yet verified";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return "Verification date unavailable";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function Evidence({ reason }: { reason: MatchReason }) {
  const evidence = reason.evidence;
  return <li className={styles.evidenceItem}>
    <div className={styles.evidenceHeading}>
      <h4>{reason.requirement}{reason.platform ? ` · ${PLATFORM_LABELS[reason.platform]}` : ""}</h4>
      <span className={styles.evidenceState} data-state={reason.state}>{STATE_LABELS[reason.state]}</span>
    </div>
    <dl className={styles.evidenceFacts}>
      <div><dt>Source checked</dt><dd>{evidence.checkedAt ? <time dateTime={evidence.checkedAt}>{checkedDate(evidence.checkedAt)}</time> : checkedDate(null)}</dd></div>
      <div><dt>Scope</dt><dd>{evidence.scope}</dd></div>
      <div><dt>Limits &amp; context</dt><dd>{evidence.note}</dd></div>
    </dl>
    {evidence.sources.length ? <ul className={styles.sources} aria-label={`Sources for ${reason.requirement}`}>
      {evidence.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span></a></li>)}
    </ul> : <p className={styles.noSource}>No primary source recorded for this capability.</p>}
  </li>;
}

function WalletResult({ result }: { result: WalletMatch }) {
  const wallet = CATALOG.get(result.walletName);
  const profile = WALLET_EVIDENCE.find(item => item.walletName === result.walletName);
  const auditedPlatform = result.status === "match" ? result.platforms.find(platform => {
    const record = profile?.platforms[platform]?.securityAudit;
    return record && capabilityReason("Public security audit", record, platform).state === "supported";
  }) : undefined;
  const auditEvidence = auditedPlatform ? profile?.platforms[auditedPlatform]?.securityAudit : undefined;
  const auditReport = auditEvidence?.sources[0];
  const shownReasons = result.status === "match"
    ? result.platformReasons.flatMap((group, index) => index === 0 ? group.reasons : group.reasons.filter(reason => reason.platform))
    : result.reasons;
  const reviewedScopes = result.status === "match"
    ? result.platformReasons.map(group => ({
      platform: group.platform,
      scope: group.reasons.find(reason => reason.requirement === "Platform available")?.evidence.scope,
    }))
    : [];
  const representativePlatform = result.reasons.find(reason => reason.platform)?.platform;
  const id = `wallet-${result.walletName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <article className={styles.wallet} aria-labelledby={id}>
    <div className={styles.walletHeading}>
      {wallet?.logo ? <img src={wallet.logo} alt="" width={44} height={44} /> : null}
      <div>
        <div className={styles.walletName}><h3 id={id}>{result.walletName}</h3>{EDITORIAL_HIGHLIGHTS.has(result.walletName) && <span className={styles.editorialStar} role="img" aria-label="Editorial highlight" title="Editorial highlight, not a safety rating">⭐</span>}</div>
        {wallet ? <p>{wallet.maker}</p> : null}
      </div>
      {wallet ? <a className={styles.officialLink} href={wallet.url} target="_blank" rel="noopener noreferrer">Official website<span aria-hidden="true"> ↗</span></a> : null}
    </div>
    {auditReport && auditedPlatform && auditEvidence && <div className={styles.auditBlock}>
      <a className={styles.auditBadge} href={auditReport.url} target="_blank" rel="noopener noreferrer" aria-label={`Audit report for ${result.walletName} on ${PLATFORM_LABELS[auditedPlatform]}`}><span aria-hidden="true">🛡️</span> Audit report<span aria-hidden="true"> ↗</span></a>
      <span className={styles.auditContext}>Scope: {auditEvidence.scope} · Source checked {checkedDate(auditEvidence.checkedAt)}. Past reports do not guarantee current safety.</span>
    </div>}
    {result.status === "match" && <p className={styles.matchPlatform}>Matches on {result.platforms.map(platform => PLATFORM_LABELS[platform]).join(", ")}.</p>}
    {reviewedScopes.length > 0 && <dl className={styles.reviewedScope}>{reviewedScopes.map(({ platform, scope }) => <div key={platform}><dt>{PLATFORM_LABELS[platform]} reviewed scope</dt><dd>{scope}</dd></div>)}</dl>}
    {result.status !== "match" && <p className={styles.representative}>Reasons below assess {representativePlatform ? PLATFORM_LABELS[representativePlatform] : "one available record"}. Other platforms may differ. <Link href={`/wallets/find?view=evidence&wallet=${encodeURIComponent(result.walletName)}`}>See all capability records</Link>.</p>}
    <ul className={styles.reasons}>
      {shownReasons.map((reason, index) => <li key={`${reason.requirement}-${reason.platform ?? "all"}-${index}`} data-state={reason.state}>
        <span aria-hidden="true">{reason.state === "supported" ? "✓" : reason.state === "unsupported" ? "−" : "?"}</span>
        <span>{reason.message}</span>
      </li>)}
    </ul>
    <details className={styles.evidence}>
      <summary>Sources, dates &amp; limits<span aria-hidden="true"> +</span></summary>
      <p className={styles.evidenceIntro}>These records support the requirements checked above. A source check is a dated review, not a live availability or security guarantee.</p>
      <ul>{shownReasons.map((reason, index) => <Evidence key={`${reason.requirement}-${reason.platform ?? "all"}-${index}`} reason={reason} />)}</ul>
    </details>
  </article>;
}

const CAPABILITY_LABELS = {
  availability: "Platform available",
  shieldedSend: "Send shielded ZEC",
  shieldedReceive: "Receive shielded ZEC",
  hardwareSigning: "Sign with a hardware device",
  multichain: "Manage native assets on multiple blockchains",
  securityAudit: "Public independent security audit",
} as const;

function CapabilityRecords({ selectedName, onSelect, onFind }: { selectedName: string | null; onSelect: (name: string) => void; onFind: () => void }) {
  const profiles = [...WALLET_EVIDENCE].sort((a, b) => a.walletName.localeCompare(b.walletName, "en"));
  const profile = selectedName ? profiles.find(item => item.walletName === selectedName) : profiles[0];
  const wallet = profile ? CATALOG.get(profile.walletName) : undefined;
  return <section aria-label="Wallet capability records">
    <div className={styles.recordHeader}>
      <label>Wallet evidence<select value={profile?.walletName ?? ""} onChange={event => onSelect(event.target.value)}>{!profile && <option value="">Choose a wallet</option>}{profiles.map(item => <option key={item.walletName} value={item.walletName}>{item.walletName}</option>)}</select></label>
      <a className={styles.catalogLink} href="/api/wallets/capabilities" download="wallet-capabilities.json">Download evidence data <span aria-hidden="true">↓</span></a>
      <button type="button" className={styles.secondaryButton} onClick={onFind}>Find a wallet for my needs</button>
    </div>
    {profile ? <article className={styles.record} aria-labelledby="wallet-record-title">
      <h2 id="wallet-record-title">{profile.walletName}</h2>
      <p>All recorded capabilities, including unknowns. Each platform has its own evidence; a feature confirmed on one platform does not establish support on another.</p>
      {wallet && <a className={styles.officialLink} href={wallet.url} target="_blank" rel="noopener noreferrer">Official website<span aria-hidden="true"> ↗</span></a>}
      <ul className={styles.recordFacts}><Evidence reason={capabilityReason("Available to use", profile.availability)} /></ul>
      {Object.entries(profile.platforms).map(([platform, facts], index) => <details key={`${profile.walletName}-${platform}`} className={styles.recordPlatform} open={index === 0}>
        <summary>{PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS]}</summary>
        <ul className={styles.recordFacts}>{(Object.keys(CAPABILITY_LABELS) as (keyof typeof CAPABILITY_LABELS)[]).map(key => <Evidence key={key} reason={capabilityReason(CAPABILITY_LABELS[key], facts[key], platform as keyof typeof PLATFORM_LABELS)} />)}</ul>
      </details>)}
    </article> : <div className={styles.empty}><h2>Wallet record not found</h2><p>Choose a wallet above to inspect its available evidence.</p></div>}
  </section>;
}

export function WalletFinder() {
  const params = useSearchParams();
  const requirements = parseWalletRequirements(readParams(params));
  const viewingEvidence = params.get("view") === "evidence";
  const [shareMessage, setShareMessage] = useState("");
  const results = matchWallets(WALLET_EVIDENCE, requirements);
  const matches = results.filter(result => result.status === "match");
  const unknown = results.filter(result => result.status === "unknown");
  const excluded = results.filter(result => result.status === "excluded");
  const sendingPrivately = requirements.shielded === "send" || requirements.shielded === "both";
  const receivingPrivately = requirements.shielded === "receive" || requirements.shielded === "both";
  const hasFilters = !!walletRequirementsQuery(requirements);

  function updateRequirements(next: WalletRequirements) {
    const query = walletRequirementsQuery(next);
    window.history.pushState(null, "", `/wallets/find${query ? `?${query}` : ""}`);
    setShareMessage("");
  }

  function togglePrivacy(direction: "send" | "receive", checked: boolean) {
    const send = direction === "send" ? checked : sendingPrivately;
    const receive = direction === "receive" ? checked : receivingPrivately;
    const shielded = send && receive ? "both" : send ? "send" : receive ? "receive" : "any";
    updateRequirements({ ...requirements, shielded });
  }

  function selectRecord(name: string) {
    const query = new URLSearchParams(walletRequirementsQuery(requirements));
    query.set("view", "evidence");
    query.set("wallet", name);
    window.history.pushState(null, "", `/wallets/find?${query.toString()}`);
  }

  async function share() {
    try {
      const query = walletRequirementsQuery(requirements);
      const link = new URL(`/wallets/find${query ? `?${query}` : ""}`, window.location.origin);
      await navigator.clipboard.writeText(link.href);
      setShareMessage("Link copied.");
    } catch {
      setShareMessage("Copy the address from your browser to share these filters.");
    }
  }

  return <div className={styles.finder}>
    <PageHeader
      title={viewingEvidence ? "Wallet capability evidence" : "Wallet Finder"}
      subtitle={viewingEvidence ? "Sources, dates and limits, by wallet and platform." : "Choose what matters. The results update as you filter."}
      actions={<Link href="/wallets" className={styles.catalogLink}>Browse all wallets <span aria-hidden="true">↗</span></Link>}
    />
    {viewingEvidence ? <CapabilityRecords selectedName={params.get("wallet")} onSelect={selectRecord} onFind={() => updateRequirements(requirements)} /> : <>
      <section className={styles.filterPanel} aria-labelledby="wallet-filters">
        <div className={styles.filterHeading}>
          <h2 id="wallet-filters">Filters</h2>
          <button type="button" className={styles.textButton} onClick={() => updateRequirements(DEFAULT_REQUIREMENTS)} disabled={!hasFilters}>Clear filters</button>
        </div>
        <div className={styles.filterGrid}>
          <label className={styles.platformField}>
            <span>Platform</span>
            <select value={requirements.platform} onChange={event => updateRequirements({ ...requirements, platform: event.target.value as WalletRequirements["platform"] })}>
              <option value="any">Any platform</option>
              {Object.entries(PLATFORM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <fieldset className={styles.filterGroup}>
            <legend>Capabilities</legend>
            <div className={styles.filterOptions}>
              <label className={styles.filterOption}><input type="checkbox" checked={sendingPrivately} onChange={event => togglePrivacy("send", event.target.checked)} /><span>Send ZEC privately</span></label>
              <label className={styles.filterOption}><input type="checkbox" checked={receivingPrivately} onChange={event => togglePrivacy("receive", event.target.checked)} /><span>Receive ZEC privately</span></label>
              <label className={styles.filterOption}><input type="checkbox" checked={requirements.hardware === "required"} onChange={event => updateRequirements({ ...requirements, hardware: event.target.checked ? "required" : "any" })} /><span>Hardware signer</span></label>
              <label className={styles.filterOption}><input type="checkbox" checked={requirements.multichain === "required"} onChange={event => updateRequirements({ ...requirements, multichain: event.target.checked ? "required" : "any" })} /><span>Other blockchains</span></label>
              <label className={styles.filterOption}><input type="checkbox" checked={requirements.audit === "required"} onChange={event => updateRequirements({ ...requirements, audit: event.target.checked ? "required" : "any" })} /><span>Public audit report</span></label>
            </div>
          </fieldset>
        </div>
        <p className={styles.filterNote}>Only documented capabilities count. Open a wallet’s sources for scope and limits.</p>
      </section>
      <section className={styles.results} aria-labelledby="matching-wallets">
        <div className={styles.resultHeading}>
          <div><h2 id="matching-wallets" aria-live="polite" aria-atomic="true">{matches.length} {matches.length === 1 ? "wallet matches" : "wallets match"} your filters</h2><p>Confirmed matches are alphabetical. Wallets with missing evidence appear below.</p></div>
          <button type="button" className={styles.secondaryButton} onClick={share}>Copy result link</button>
        </div>
        <p role="status" className={styles.shareMessage}>{shareMessage}</p>
        {matches.length ? <div className={styles.walletList}>{matches.map(result => <WalletResult key={result.walletName} result={result} />)}</div> : <div className={styles.empty}>
          <h3>No confirmed matches for this combination</h3>
          <p>Change a filter above to widen the results. Unknown support never counts as a match.</p>
        </div>}
      </section>
      <div className={styles.otherResults}>
        <details><summary>{unknown.length} {unknown.length === 1 ? "wallet needs" : "wallets need"} more verification<span aria-hidden="true"> +</span></summary><p>At least one selected requirement is unconfirmed for these wallets.</p><div className={styles.walletList}>{unknown.map(result => <WalletResult key={result.walletName} result={result} />)}{!unknown.length && <p>No wallets in this group.</p>}</div></details>
        <details><summary>{excluded.length} {excluded.length === 1 ? "wallet does" : "wallets do"} not meet these filters<span aria-hidden="true"> +</span></summary><p>Reviewed evidence shows at least one selected requirement is not supported. Expand a wallet’s sources for the scope.</p><div className={styles.walletList}>{excluded.map(result => <WalletResult key={result.walletName} result={result} />)}{!excluded.length && <p>No wallets in this group.</p>}</div></details>
      </div>
    </>}
    <aside className={styles.method}><details><summary>How matching works</summary><p>We check availability, platform and selected capabilities against the linked sources. Unknown or incomplete evidence stays unknown. Capabilities from different platforms are never combined into one match. Other blockchains means managing native assets, not swaps.</p><p>A public audit report covers its stated product and release; it is not a safety guarantee. The ⭐ is an editorial highlight. Read source dates and limits before choosing. <Link href="/wallets/find?view=evidence">Browse all capability records</Link> or <Link href="/wallets">open the full wallet catalog</Link>.</p><p>No account or wallet connection is needed. Your filters stay in this page’s address so you can revisit or share them.</p></details></aside>
    <CommunityCredit screen="wallet-finder" />
  </div>;
}
