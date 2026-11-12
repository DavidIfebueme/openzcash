"use client";

import { useRef, useState, type ReactNode } from "react";
import { categories, communityTools, type ToolCategory } from "./community-tools";
import { history, paidRounds, releaseNotes, releaseTag, reportedPaid, sourcesChecked } from "./crosslink-history";
import { OngoingTestIcon, type OngoingTestIconName } from "@/components/ongoing-test-icons";
import styles from "./ongoing-test.module.css";

const FORUM = "https://forum.zcashcommunity.com/t/crosslink-incentivized-feature-net/55210";
const RELEASE = releaseNotes;
const ISSUES = "https://github.com/ShieldedLabs/crosslink_monolith/issues";
const tabIcons: OngoingTestIconName[] = ["experiment", "tools", "rewards"];
const tabs = ["Participate", "Community tools", "Incentives"] as const;
type Tab = typeof tabs[number];
const paths: Record<string, string> = {
  network: "M12 8v8M8 6H5v12h3m8-12h3v12h-3M9 3h6v5H9zM9 16h6v5H9z",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  terminal: "m5 7 5 5-5 5m8 0h6M3 3h18v18H3z",
  database: "M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3ZM4 6v12c0 2 4 3 8 3s8-1 8-3V6M4 12c0 2 4 3 8 3s8-1 8-3",
  wallet: "M3 6h16v4H3V6Zm0 4v10h18V10H3Zm12 3h6v4h-6v-4Z",
  book: "M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m8 10 4 4 4-4",
  external: "M13 4h7v7m0-7L10 14M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3",
  check: "m5 12 4 4L19 6",
};
function Icon({ name }: { name: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.network} /></svg>; }
function ToggleMark() {
  return <span className={styles.toggleMark} aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10" /><path className={styles.toggleVertical} d="M8 3v10" /></svg></span>;
}
function Logo({ src, className = "" }: { src: string; className?: string }) {
  // Static, locally hosted organization assets; no third-party image requests.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} />;
}
function Source({ href, children, variant = "source", className = "" }: {
  href: string;
  children: ReactNode;
  variant?: "source" | "tool" | "brand" | "primary";
  className?: string;
}) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  return <a href={href} target="_blank" rel="noopener noreferrer"
    className={`${styles.externalLink} ${styles[`${variant}Link`]} ${className}`}
    title={`${host} · Opens in a new tab`}>
    <span className={styles.linkLabel}>{children}</span>
    <span className={styles.linkArrow}><Icon name="external" /></span>
    <span className={styles.linkHint}> (opens in a new tab)</span>
  </a>;
}

// Exact upstream titles: `npm run check:crosslink` compares each one with the GitHub API.
// This is a curated index, not an assignment board or live issue-status feed.
// A closed listing stays as history; reopen the source before treating it as active.
const referencedIssues = [
  { id: 255, title: "Crash After Clicking Edit Stake Button Due to Out-of-Bounds" },
  { id: 231, title: "FlyClient - (reliable height/sync status in PoW)" },
  { id: 219, title: '\"You are on an old version; please upgrade\"' },
];
const participationPaths: { id: "test" | "build" | "operate"; title: string; detail: string; icon: OngoingTestIconName }[] = [
  { id: "test", title: "Test", detail: "Follow the full cycle", icon: "experiment" },
  { id: "build", title: "Build", detail: "Find a useful contribution", icon: "tools" },
  { id: "operate", title: "Operate", detail: "Run a finalizer", icon: "finalizer" },
];

const steps = [
  { title: "Install & back up", body: <>Download the build for your OS. Open the app and privately back up your test-wallet seed. Use cTAZ only. Shielded Labs ships weekly; only the current chain earns rewards, so upgrade within a week of each release.</>, check: "Record your OS and build.", href: RELEASE },
  { title: "Sync the network", body: <>Let the node catch up. Compare a block’s height and hash with a same-network explorer. Check that finalized height advances too.</>, check: "Matching chain. Advancing finality.", href: `${FORUM}/66` },
  { title: "Get test funds", body: <>Request cTAZ from the app’s faucet, or mine. Desktop CPU mining starts after sync by default.</>, check: "Funds arrive in your own wallet.", href: RELEASE },
  { title: "Choose a finalizer & stake", body: <>Check recent votes, then copy a finalizer’s identity. During a staking window: <b>Stake → Paste Identity → amount.</b></>, check: "Confirm the bond and destination.", href: RELEASE },
  { title: "Change your delegation", body: <>Open <b>Edit Stake</b>, select a bond and retarget it to another finalizer. Retargeting also works outside staking windows.</>, check: "Same bond, new destination.", href: RELEASE },
  { title: "Unstake & withdraw", body: <>Begin unbonding in <b>Edit Stake</b>. Once the bond is withdrawable, withdraw during an allowed window.</>, check: "Confirm the transaction and returned funds.", href: RELEASE },
  { title: "Share what you found", body: <>Record version, OS, time, transaction IDs and expected versus actual behavior. Recheck after restarting. Remove secrets before reporting.</>, check: "Report desktop-app problems in the official issue tracker.", href: ISSUES },
];

export function CrosslinkGuide({ initialTab = "Participate" }: { initialTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [category, setCategory] = useState<ToolCategory>("All");
  const [path, setPath] = useState<"test" | "build" | "operate">("test");
  const [communityView, setCommunityView] = useState<"tools" | "issues">("tools");
  const [done, setDone] = useState<number[]>([]);
  const [openStep, setOpenStep] = useState<number | null>(0);
  const content = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const pathNotes = path === "build" ? [
    ["Check the discussion", "Read the issue and coordinate with its maintainers."],
    ["Keep evidence useful", "Include versions, reproduction steps and expected results."],
    ["Confirm scope", "A listed issue does not imply funding or assignment."],
  ] : path === "operate" ? [
    ["Same network", "Match your release and explorer network."],
    ["Stay available", "Keep the node online and watch its participation."],
    ["Protect your keys", "Keep wallet seeds and private keys out of reports."],
  ] : [
    ["Separate wallet", "Use a test wallet. Keep its seed private."],
    ["Allow time", "Follow the app’s staking windows."],
    ["Verify results", "Save transaction IDs. Confirm each outcome."],
  ];
  const nextStep = steps.findIndex((_, index) => !done.includes(index));
  function showIssues() {
    setCommunityView("issues"); setTab("Community tools");
    tabButtons.current[1]?.focus();
    content.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  const visibleTools = communityTools.filter((tool) => category === "All" || tool.category === category);

  return <>
    <section className={styles.hero} aria-labelledby="crosslink-title">
      <div className={styles.heroCopy}>
        <Source className={styles.brand} variant="brand" href="https://shieldedlabs.net/"><Logo src="/logos/shielded-labs.png" /><span>Shielded Labs</span></Source>
        <div className={styles.heroTitle}><h2 id="crosslink-title">Crosslink<span>.</span></h2></div>
        <div className={styles.actions}><Source variant="primary" href={RELEASE}>Download {releaseTag}</Source><button onClick={() => {
          setTab("Participate"); setPath("test");
          content.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
        }} className={styles.internalLink}><span>Start testing</span><span className={styles.linkArrow}><Icon name="arrow" /></span></button><Source className={styles.heroRules} href={`${FORUM}/39`}>Program rules</Source></div>
      </div>
      <div className={styles.art} aria-hidden="true">
        <div className={styles.orbit} /><div className={styles.orbitInner} />
        <div className={styles.artAxis} /><div className={styles.artAxisTwo} />
        <span className={`${styles.node} ${styles.nodeOne}`} /><span className={`${styles.node} ${styles.nodeTwo}`} /><span className={`${styles.node} ${styles.nodeThree}`} />
        <div className={styles.shield}><Logo src="/logos/shielded-labs.png" /></div>
        <span className={styles.artLabelOne}>PROOF OF WORK</span><span className={styles.artLabelTwo}>PROOF OF STAKE</span>
        <span className={styles.artCaption}>ONE NETWORK. TWO LAYERS.</span>
      </div>
    </section>

    <div className={styles.tabBar} ref={content}>
      <div role="tablist" aria-label="Crosslink resources" className={styles.tabs}>
        {tabs.map((name, index) => <button key={name} ref={(el) => { tabButtons.current[index] = el; }} type="button" role="tab" id={`crosslink-tab-${index}`} aria-controls={`crosslink-panel-${index}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else return;
          event.preventDefault(); setTab(tabs[next]); tabButtons.current[next]?.focus();
        }}><OngoingTestIcon className={styles.tabIcon} name={tabIcons[index]} /><span>{name}</span>{name === "Community tools" && <span className={styles.tabCount}>{communityTools.length}</span>}</button>)}
      </div>
    </div>

    <div role="tabpanel" id="crosslink-panel-0" aria-labelledby="crosslink-tab-0" hidden={tab !== "Participate"} className={styles.panel}>
      <p className={styles.curationNote}>Guide curated by OpenZcash · Instructions linked below.</p>
      <div className={styles.participationPaths} role="group" aria-label="Choose how to contribute">
        {participationPaths.map((item) => <button type="button" key={item.id} aria-pressed={path === item.id} onClick={() => setPath(item.id)}>{item.title}</button>)}
      </div>
      <div className={styles.guideGrid}>
        <section className={styles.guide} aria-labelledby={path === "test" ? "guide-heading" : "path-heading"}>
          {path === "test" ? <>

          <h3 id="guide-heading" className={styles.linkHint}>Testing checklist</h3>
          <progress className={styles.progress} max={steps.length} value={done.length} aria-label="Checklist progress" />
          <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title} data-done={done.includes(index) || undefined} data-next={index === nextStep || undefined} data-expanded={openStep === index || undefined}>
            <div className={styles.stepHeader}>
              <label className={styles.check}><input type="checkbox" checked={done.includes(index)} onChange={() => setDone((old) => old.includes(index) ? old.filter((n) => n !== index) : [...old, index])} aria-label={`Complete step ${index + 1}: ${step.title}`} /><span aria-hidden="true">{done.includes(index) ? <Icon name="check" /> : String(index + 1).padStart(2,"0")}</span></label>
              <button type="button" className={styles.stepButton} aria-expanded={openStep === index} aria-controls={`step-${index}`} onClick={() => setOpenStep((current) => current === index ? null : index)}>{step.title}<ToggleMark /></button>
            </div>
            <div id={`step-${index}`} hidden={openStep !== index} className={styles.stepBody}><p>{step.body}</p><div className={styles.verify}><Icon name="check" /><span>{step.check}</span></div><Source href={step.href}>Source instructions</Source></div>
          </li>)}</ol>
          <div className={styles.progressFoot}><span>{done.length === 7 ? "Cycle complete." : "Progress saved for this visit."}</span>{done.length > 0 && <button onClick={() => setDone([])}>Reset</button>}</div>
          </> : path === "build" ? <div className={styles.pathContent}>
            <div className={styles.sectionHeading}><h3 id="path-heading">Development resources</h3></div>
            <p>Official repository and issue tracker, alongside tools shared by the community.</p>
            <div className={styles.resourceRows}>
              <div><h4>Shielded Labs repository</h4><Source href="https://github.com/ShieldedLabs/crosslink_monolith">Source code</Source></div>
              <div><h4>Selected public issues</h4><button type="button" className={styles.internalLink} onClick={showIssues}><span>Issues &amp; discussions</span><span className={styles.linkArrow}><Icon name="arrow" /></span></button></div>
              <div><h4>Community projects</h4><button type="button" className={styles.internalLink} onClick={() => { setTab("Community tools"); setCommunityView("tools"); tabButtons.current[1]?.focus(); }}><span>Browse tools</span><span className={styles.linkArrow}><Icon name="arrow" /></span></button></div>
            </div>
          </div> : <div className={styles.pathContent}>
            <div className={styles.sectionHeading}><h3 id="path-heading">Prepare your finalizer.</h3></div>
            <p>Use the release instructions for your network. Keep your node online and verify its participation.</p>
            <ol className={styles.pathSteps}>
              <li><span>01</span><div><h4>Confirm the release</h4><p>Check your build and network before following operator instructions.</p><Source href={RELEASE}>{releaseTag} release notes</Source></div></li>
              <li><span>02</span><div><h4>Set up your identity</h4><p>Review the documented delegation and finalizer setup.</p><Source href={RELEASE}>{releaseTag} finalizer instructions</Source></div></li>
              <li><span>03</span><div><h4>Observe participation</h4><p>Check roster membership, recent votes and advancing finality with same-network tools.</p><Source href="https://ctaz.cash/">Network diagnostics</Source></div></li>
            </ol>
            <p className={styles.directoryNote}>OpenZcash summary of the linked {releaseTag} instructions. Follow the documentation for the release you run.</p>
          </div>}
        </section>
        <aside className={styles.guideAside} aria-labelledby="test-essentials-heading">
          <section className={styles.startNote}>
            <div className={styles.noteHeader}>
              <span className={styles.miniIcon}><OngoingTestIcon name="shield" /></span>
              <div><h3 id="test-essentials-heading">{path === "build" ? "Before contributing" : "Before you start"}</h3><p>{path === "build" ? "Work with the maintainers" : "Desktop app · cTAZ only"}</p></div>
            </div>
            <ul className={styles.noteRules}>
              {pathNotes.map(([title, description], index) => <li key={title} className={styles.noteRule}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h4>{title}</h4><p>{description}</p></div></li>)}
            </ul>
          </section>
          <div className={styles.asideOptions} hidden={path !== "test"}>
            <details className={styles.compactDetail}>
              <summary><span className={styles.optionIcon}><OngoingTestIcon name="finalizer" /></span><span>Running a finalizer?</span><span className={styles.disclosureArrow}><Icon name="chevron" /></span></summary>
              <div className={styles.optionBody}><p>The {releaseTag} instructions describe copying your desktop finalizer identity and staking to it during a Staking Day. A finalizer must be online to participate.</p><Source href={RELEASE}>{releaseTag} finalizer instructions</Source></div>
            </details>
            <details className={styles.compactDetail}>
              <summary><span className={styles.optionIcon}><OngoingTestIcon name="phone" /></span><span>Using a phone?</span><span className={styles.disclosureArrow}><Icon name="chevron" /></span></summary>
              <div className={styles.optionBody}><p>Zingo Delegator has a mobile guide. Its linked build is from Season 1; confirm Round 3 compatibility with the team.</p><Source href={communityTools.find((tool) => tool.name === "Zingo Delegator")!.href}>Mobile guide</Source></div>
            </details>
          </div>
          <button type="button" className={styles.asideLink} onClick={() => {
            setTab("Community tools");
            setCategory("All"); setCommunityView("tools");
            tabButtons.current[1]?.focus();
            content.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
          }}><span className={styles.optionIcon}><OngoingTestIcon name="tools" /></span><span>Explore community tools</span><span className={styles.linkArrow}><Icon name="arrow" /></span></button>
        </aside>
      </div>
    </div>

    <div role="tabpanel" id="crosslink-panel-1" aria-labelledby="crosslink-tab-1" hidden={tab !== "Community tools"} className={styles.panel}>
      <div className={styles.sectionHeading}><h3>Community tools</h3><Source href={FORUM}>Join the conversation</Source></div>
      <div className={styles.communityViews} role="group" aria-label="Community resources">
        <button type="button" aria-pressed={communityView === "tools"} onClick={() => setCommunityView("tools")}><Icon name="database" />Tools <span>{communityTools.length}</span></button>
        <button type="button" aria-pressed={communityView === "issues"} onClick={() => setCommunityView("issues")}><Icon name="terminal" />Issues &amp; discussions <span>{referencedIssues.length}</span></button>
      </div>
      {communityView === "tools" ? <>
      <div className={styles.filters} role="group" aria-label="Filter community tools">{categories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <p className={styles.results} aria-live="polite">{visibleTools.length} resources · Confirm network compatibility in the project’s notes.</p>
      <div className={styles.toolGrid}>{visibleTools.map((tool) => <article className={styles.toolCard} key={tool.name}>
        <div className={styles.toolTop}><span className={styles.toolLogo}>{tool.logo ? <Logo src={tool.logo} /> : <Icon name={tool.symbol} />}</span><div className={styles.toolIdentity}><h4><Source href={tool.href} variant="tool">{tool.name}</Source></h4><span className={styles.author}>{tool.author}</span></div></div>
        <p>{tool.description}</p>
        <details><summary>Notes & source</summary><span className={styles.toolType}>{tool.category}</span><p>{tool.note}</p><Source href={tool.source}>Original contribution</Source></details>
      </article>)}</div>
      <p className={styles.directoryNote}>Public resources located in the forum and linked projects. Listing does not imply current-network support or endorsement.</p>
      </> : <>
        <p className={styles.results}>Selected by OpenZcash · Original GitHub titles. Check the source for current status.</p>
        <div className={styles.referencedIssues}>{referencedIssues.map((issue) => <article key={issue.id}>
          <span className={styles.taskNumber}>#{issue.id}</span>
          <h4><Source variant="tool" href={`${ISSUES}/${issue.id}`}>{issue.title}</Source></h4>
        </article>)}</div>
        <div className={styles.taskFooter}><p className={styles.directoryNote}>Curated references · No assignment or funding implied.</p><Source href={ISSUES}>All issues</Source><Source href={FORUM}>Forum discussion</Source></div>
      </>}
    </div>

    <div role="tabpanel" id="crosslink-panel-2" aria-labelledby="crosslink-tab-2" hidden={tab !== "Incentives"} className={styles.panel}>
      <div className={styles.sectionHeading}><h3 id="payouts-heading">Incentive pool</h3></div>
      <section className={styles.paymentOverview} aria-labelledby="payouts-heading">
        <div className={styles.paymentProgress}>
          <div className={styles.paymentProgressLabel}><span className={styles.paymentTotals}><strong>{reportedPaid}</strong><span>/ 500 <small>ZEC</small></span><small>reported paid</small></span><strong className={styles.paymentPercent}>{reportedPaid / 500 * 100}<small>%</small></strong></div>
          <div className={styles.paymentTrack} role="progressbar" aria-label="Reported payments from the program allocation" aria-valuemin={0} aria-valuemax={500} aria-valuenow={reportedPaid} aria-valuetext={`${reportedPaid} of 500 ZEC reported paid`}>
            {paidRounds.map((round) => <span key={round.round} style={{ width: `${round.total / 500 * 100}%` }} />)}
          </div>
        </div>
        <div className={styles.paymentLegend}><span><i />Mining & staking</span><span><i />Discretionary</span></div>
        <ol className={styles.paidMilestones}>{paidRounds.map((round) => <li key={round.round}>
          <div className={styles.milestoneHeader}><div><h4>Round {round.round}</h4><span>Reported {round.reported}</span></div><strong>{round.total} ZEC <span><Icon name="check" />Paid</span></strong></div>
          <div className={styles.paymentSplit}>
            <span style={{ flexGrow: round.earned }} title={`Mining & staking: ${round.earned} ZEC`}><span className={styles.linkHint}>Mining & staking: </span>{round.earned}<span className={styles.linkHint}> ZEC</span></span>
            <span style={{ flexGrow: round.discretionary }} title={`Discretionary: ${round.discretionary} ZEC`}><span className={styles.linkHint}>Discretionary: </span>{round.discretionary}<span className={styles.linkHint}> ZEC</span></span>
          </div>
          <details className={styles.paymentNotes}><summary>Details & sources<ToggleMark /></summary><p>{round.recipients} mining and staking recipients. {round.note}</p><p>Claims closed {round.claim}.</p><div><Source href={round.source}>Payout report</Source><Source href={round.claimSource}>Claim announcement</Source></div></details>
        </li>)}</ol>
      </section>
      <div className={styles.roundStatus}><span><b>Round 3</b> · Running on the {releaseTag} network; reward amount and claim dates pending.</span><Source href={`${FORUM}/101`}>Follow the round</Source></div>
      <div className={styles.rewardDetails}><section><h4>Earned cTAZ counts.</h4><p>Mining and staking earnings determine the proportional reward. Simply holding faucet or transferred funds does not qualify.</p><Source href={`${FORUM}/39`}>Eligibility</Source></section><section><h4>Claims stay with Shielded Labs.</h4><p>Wait for the round’s private submission instructions. Previous claims used test-wallet viewing keys and a mainnet payout address. Never share a seed or spending key.</p><Source href={`${FORUM}/94`}>Previous claim process</Source></section></div>
      <section className={styles.historySection} aria-labelledby="history-heading">
        <div className={styles.sectionHeading}><h3 id="history-heading">Timeline</h3><Source href={FORUM}>Forum</Source></div>
        <ol className={styles.timeline}>{history.map((event) => <li key={event.title} data-kind={event.kind}><time>{event.date}</time><details><summary><span>{event.title}</span><small>{event.kind}</small><ToggleMark /></summary><p>{event.detail}</p><Source href={event.source}>Original source</Source></details></li>)}</ol>
      </section>
    </div>
    <footer className={styles.footer}><span>Curated by OpenZcash · Sources checked {sourcesChecked}</span><Source href={FORUM}>Crosslink forum</Source><Source href="https://github.com/ShieldedLabs/crosslink_monolith/releases">All releases</Source></footer>
  </>;
}
