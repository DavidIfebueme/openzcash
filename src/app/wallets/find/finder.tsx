"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
const STEPS = ["platform", "privacy", "hardware", "multichain", "audit"] as const;
type Question = typeof STEPS[number];
type View = Question | "results" | "evidence";
const STEP_NAMES: Record<Question, string> = {
  platform: "Platform", privacy: "Privacy", hardware: "Hardware", multichain: "Other coins", audit: "Audit",
};
const PRIVACY_LABELS: Record<WalletRequirements["shielded"], string> = {
  any: "No privacy requirement", send: "Send privately", receive: "Receive privately", both: "Send and receive privately",
};
const STATE_LABELS = { supported: "Supported", unsupported: "Not supported", unknown: "Unknown" } as const;
const QUESTIONS: Record<Question, { title: string; description: string; options: { value: string; label: string; detail: string }[] }> = {
  platform: {
    title: "Where do you want to use Zcash?",
    description: "Choose the platform you will use. A wallet must meet all your requirements on the same platform.",
    options: [
      { value: "any", label: "Any platform", detail: "Show every platform with matching evidence." },
      ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label, detail: {
        ios: "An app for iPhone or iPad.", android: "An app for an Android phone.",
        desktop: "A desktop app; check the listed operating systems.", browser: "An extension in a supported browser.",
        web: "A wallet accessed through a website.", hardware: "A physical device, with its required companion app.",
      }[value] ?? "" })),
    ],
  },
  privacy: {
    title: "What do you want to do privately?",
    description: "Private means shielded Zcash transactions. Sending and receiving are checked separately; transparent-only support does not qualify.",
    options: [
      { value: "both", label: PRIVACY_LABELS.both, detail: "Require both shielded sending and shielded receiving." },
      { value: "send", label: PRIVACY_LABELS.send, detail: "Require shielded sending." },
      { value: "receive", label: PRIVACY_LABELS.receive, detail: "Require shielded receiving." },
      { value: "any", label: PRIVACY_LABELS.any, detail: "Include transparent-only wallets if they meet your other choices." },
    ],
  },
  hardware: {
    title: "Do you need a hardware signer?",
    description: "A separate device signs your Zcash transactions. The evidence must confirm the wallet, device and any companion app needed.",
    options: [
      { value: "any", label: "No hardware requirement", detail: "Software and hardware options can both match." },
      { value: "required", label: "I need a hardware signer", detail: "Only confirmed hardware signing can meet this requirement." },
    ],
  },
  multichain: {
    title: "Do you also need to manage other coins?",
    description: "This means managing native assets on other blockchains in the wallet. Swaps, CrossPay and paying out to another coin do not establish this capability.",
    options: [
      { value: "any", label: "Zcash is enough", detail: "No requirement to manage coins on other blockchains." },
      { value: "required", label: "I also need other blockchains", detail: "Require verified native asset management on more than one blockchain." },
    ],
  },
  audit: {
    title: "Need a public audit report?",
    description: "Find wallets with a published independent report. Check its version and scope; a past audit cannot guarantee current safety.",
    options: [
      { value: "any", label: "No audit requirement", detail: "Include wallets with or without a verified public report." },
      { value: "required", label: "Public report required", detail: "A past audit does not guarantee current safety." },
    ],
  },
};

function readParams(params: Pick<URLSearchParams, "forEach" | "getAll">): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  params.forEach((_value, key) => {
    const all = params.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  });
  return values;
}

function queryView(value: string | null, requirements: WalletRequirements): View {
  if (value === "results" || value === "evidence" || STEPS.includes(value as Question)) return value as View;
  return walletRequirementsQuery(requirements) ? "results" : "platform";
}

function answer(requirements: WalletRequirements, question: Question): string {
  if (question === "platform") return requirements.platform === "any" ? "Any platform" : PLATFORM_LABELS[requirements.platform];
  if (question === "privacy") return PRIVACY_LABELS[requirements.shielded];
  if (question === "hardware") return requirements.hardware === "required" ? "Hardware signer required" : "No hardware requirement";
  if (question === "multichain") return requirements.multichain === "required" ? "Other blockchains required" : "Zcash is enough";
  return requirements.audit === "required" ? "Public report required" : "No audit requirement";
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
  const view = queryView(params.get("view"), requirements);
  const step = STEPS.indexOf(view as Question);
  const [shareMessage, setShareMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const shouldFocus = useRef(false);
  const results = matchWallets(WALLET_EVIDENCE, requirements);
  const matches = results.filter(result => result.status === "match");
  const unknown = results.filter(result => result.status === "unknown");
  const excluded = results.filter(result => result.status === "excluded");

  useEffect(() => {
    if (shouldFocus.current) {
      (view === "results" ? headingRef.current : legendRef.current)?.focus();
      shouldFocus.current = false;
    }
  }, [view]);

  function navigate(nextView: View, nextRequirements = requirements, focus = true) {
    const query = new URLSearchParams(walletRequirementsQuery(nextRequirements));
    query.set("view", nextView);
    shouldFocus.current = focus;
    setShareMessage("");
    window.history.pushState(null, "", `/wallets/find?${query.toString()}`);
  }

  function selectRecord(name: string) {
    const query = new URLSearchParams(walletRequirementsQuery(requirements));
    query.set("view", "evidence");
    query.set("wallet", name);
    window.history.pushState(null, "", `/wallets/find?${query.toString()}`);
  }

  function select(question: Question, value: string) {
    const field = question === "privacy" ? "shielded" : question;
    navigate(view, { ...requirements, [field]: value }, false);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Link copied.");
    } catch {
      setShareMessage("Copy the address from your browser to share these choices.");
    }
  }

  return <div className={styles.finder}>
    <PageHeader title={view === "evidence" ? "Wallet capability evidence" : "Wallet Finder"} subtitle={view === "evidence" ? "Sources, dates and limits, by wallet and platform." : "Five quick questions. Every match has a source."} actions={<Link href="/wallets" className={styles.catalogLink}>Browse all wallets <span aria-hidden="true">↗</span></Link>} />
    {view !== "evidence" && <nav aria-label="Wallet Finder steps" className={styles.steps}>
      <ol>{STEPS.map((question, index) => <li key={question}>
        <button type="button" onClick={() => navigate(question)} aria-current={view === question ? "step" : undefined}>
          <span className={styles.stepNumber}>{index + 1}</span><span>{STEP_NAMES[question]}</span>
        </button>
      </li>)}</ol>
    </nav>}

    {view === "evidence" ? <CapabilityRecords selectedName={params.get("wallet")} onSelect={selectRecord} onFind={() => navigate("platform")} /> : view !== "results" ? <form className={styles.questionPanel} onSubmit={event => {
      event.preventDefault();
      navigate(step === STEPS.length - 1 ? "results" : STEPS[step + 1]);
    }}>
      <fieldset aria-describedby={`question-${view}-description`}>
        <legend ref={legendRef} tabIndex={-1}><span className={styles.stepHint}>Step {step + 1} of {STEPS.length}</span><span className={styles.questionTitle}>{QUESTIONS[view].title}</span></legend>
        <p id={`question-${view}-description`} className={styles.questionDescription}>{QUESTIONS[view].description}</p>
        <div className={styles.options} data-count={QUESTIONS[view].options.length}>{QUESTIONS[view].options.map(option => <label key={option.value} className={styles.option}>
          <input type="radio" name={view} value={option.value} checked={(view === "privacy" ? requirements.shielded : requirements[view]) === option.value} onChange={() => select(view, option.value)} />
          <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        </label>)}</div>
      </fieldset>
      <div className={styles.questionActions}>
        {step > 0 ? <button type="button" className={styles.secondaryButton} onClick={() => navigate(STEPS[step - 1])}>Back</button> : <span />}
        <button type="submit" className={styles.primaryButton}>{step === STEPS.length - 1 ? "See matching wallets" : "Continue"}<span aria-hidden="true"> →</span></button>
      </div>
    </form> : <>
      <section className={styles.answers} aria-labelledby="your-choices">
        <div className={styles.sectionHeading}><h2 id="your-choices">Your choices</h2><button type="button" className={styles.textButton} onClick={() => navigate("platform", DEFAULT_REQUIREMENTS)}>Start over</button></div>
        <dl>{STEPS.map(question => <div key={question}><dt>{STEP_NAMES[question]}</dt><dd><span className={styles.answerValue}>{answer(requirements, question)}</span><button type="button" aria-label={`Edit ${STEP_NAMES[question].toLowerCase()}`} onClick={() => navigate(question)}>Edit<span aria-hidden="true"> ↗</span></button></dd></div>)}</dl>
      </section>
      <section className={styles.results} aria-labelledby="matching-wallets">
        <div className={styles.resultHeading}>
          <div><h2 id="matching-wallets" ref={headingRef} tabIndex={-1}>{matches.length} {matches.length === 1 ? "wallet matches" : "wallets match"} your choices</h2><p>Every selected requirement must have supporting evidence on the same platform. Results are alphabetical, with no paid ranking.</p></div>
          <button type="button" className={styles.secondaryButton} onClick={share}>Copy result link</button>
        </div>
        <p role="status" className={styles.shareMessage}>{shareMessage}</p>
        {matches.length ? <div className={styles.walletList}>{matches.map(result => <WalletResult key={result.walletName} result={result} />)}</div> : <div className={styles.empty}>
          <h3>No confirmed matches for this combination</h3>
          <p>You can edit a requirement above. Wallets with missing evidence are kept below; unknown support never counts as a match.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate("platform")}>Edit your choices</button>
        </div>}
      </section>
      <div className={styles.otherResults}>
        <details><summary>{unknown.length} {unknown.length === 1 ? "wallet needs" : "wallets need"} more verification<span aria-hidden="true"> +</span></summary><p>At least one requirement is unconfirmed for these wallets. The available evidence does not establish a match.</p><div className={styles.walletList}>{unknown.map(result => <WalletResult key={result.walletName} result={result} />)}{!unknown.length && <p>No wallets in this group.</p>}</div></details>
        <details><summary>{excluded.length} {excluded.length === 1 ? "wallet does" : "wallets do"} not meet these choices<span aria-hidden="true"> +</span></summary><p>The reviewed evidence shows at least one requirement is not supported. Expand a wallet’s sources to see the reason and scope.</p><div className={styles.walletList}>{excluded.map(result => <WalletResult key={result.walletName} result={result} />)}{!excluded.length && <p>No wallets in this group.</p>}</div></details>
      </div>
    </>}
    <aside className={styles.method}><details><summary>How matching works</summary><p>We check availability, platform and your selected capabilities against the linked sources. Unknown or incomplete evidence stays unknown. Swaps do not establish multichain support, and capabilities from different platforms are never combined into one match.</p><p>A public audit report covers its stated product and release; it is not a safety guarantee. The ⭐ is an editorial highlight. Read source dates and limits before choosing. <Link href="/wallets/find?view=evidence">Browse all capability records</Link> or <Link href="/wallets">open the full wallet catalog</Link>.</p><p>No account or wallet connection is needed. Your choices stay in this page’s address so you can revisit or share them.</p></details></aside>
    <CommunityCredit screen="wallet-finder" />
  </div>;
}
