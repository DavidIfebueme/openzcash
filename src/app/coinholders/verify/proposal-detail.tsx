import Link from "next/link";
import type { Round, RoundProposal } from "@/lib/coinholder/types";
import type { ChainReport } from "@/lib/coinholder/verify-export";
import { OUTCOME_LABEL, QUORUM_ZEC, formatZec } from "@/lib/coinholder/derive";
import { ZIP_1016_RULE, RULE_LABEL, type VerifyRow } from "@/lib/coinholder/verify";
import { proposalDecision, proposalVerifyHref } from "@/lib/coinholder/proposal-decision";
import { formatShare, utcTime } from "@/lib/coinholder/verify-view";
import { SCRIPT_PATH, VOTE_CHAIN_HOSTS, VOTE_CHAIN_ROUNDS, verifyApiPath, voteSummaryUrl } from "@/lib/coinholder/verify-sources";
import { CodeBlock } from "./code-block";
import { ProposalGraph } from "./proposal-graph";
import shared from "../coinholders.module.css";
import styles from "./proposal-detail.module.css";

const shortOption = (key: string, label: string) => key === "rejectLower" ? "Reject, lower amount"
  : key === "reject" && label.includes(" · ") ? "Reject, do not support" : label;

export function ProposalDetail({ round, proposal, row, chain, digits, poll }: {
  round: Round; proposal: RoundProposal; row: VerifyRow; chain: ChainReport | null; digits: number; poll: boolean;
}) {
  const data = proposalDecision(round, row);
  const zec = (value: number) => formatZec(value, digits);
  const accept = round.ballot.find(o => o.key === "approve")?.label ?? "Accept";
  const reject = round.ballot.find(o => o.key === "reject")?.label.split(" · ")[0] ?? "Reject";
  const hasAbstain = round.ballot.some(o => o.key === "abstain");
  const hasLower = round.ballot.some(o => o.key === "rejectLower");
  const approved = row.rule === "funded" || row.rule === "passed";
  const calculatedLabel = row.rule ? RULE_LABEL[row.rule] : "—";
  const official = round.sources.find(s => /official results/i.test(s.label)) ?? round.sources[0];
  const chainId = VOTE_CHAIN_ROUNDS[round.id];
  const rawUrl = chain?.status === "ok" ? chain.url : chainId ? voteSummaryUrl(VOTE_CHAIN_HOSTS[0].origin, chainId) : null;
  const ordered = [...round.proposals].sort((a, b) => (a.question ?? 0) - (b.question ?? 0));
  const index = ordered.findIndex(p => p.id === proposal.id);
  const neighbors = [{ p: ordered[index - 1], label: "← Previous" }, { p: ordered[index + 1], label: "Next →" }];
  const result = !data ? "No published tally" : poll ? "Grant-rule comparison" : proposal.outcome === "vetoed" ? "Passed, then vetoed"
    : row.agrees === false ? approved ? "Passes the vote calculation" : "Does not pass the vote calculation"
    : approved ? row.rule === "funded" ? "Proposal funded" : "Proposal passed" : "Proposal rejected";
  const withoutMet = data !== null && data.directional >= QUORUM_ZEC;
  const thresholdSummary = !data ? "" : `The 420,000 ZEC participation threshold is ${data.quorumMet ? "met" : "not met"}.`;
  return <div className={`${shared.page} ${styles.detail}`}>
    <header className={styles.header}>
      <h1>{proposal.title}</h1>
      <div className={styles.meta}>
        {proposal.question !== undefined && <span>Ballot #{proposal.question}</span>}
        <span>{round.label}</span>
        {proposal.requestedUsdCents !== null && <span>Requested <strong>USD {(proposal.requestedUsdCents / 100).toLocaleString("en-US", { maximumFractionDigits: proposal.requestedUsdCents % 100 ? 2 : 0 })}</strong></span>}
        <span className={styles.outcome} aria-label={`Published outcome: ${OUTCOME_LABEL[proposal.outcome]}`}><i />{OUTCOME_LABEL[proposal.outcome]}</span>
        {proposal.correction && <a href="#proposal-context">Corrected after publication</a>}
      </div>
      <p className={styles.lede}>Participation, majority{hasAbstain ? ", Abstain" : ""} and the {poll ? "recorded response" : "published outcome"}, in one view. <a href="#verify-yourself">Verify it yourself ↓</a></p>
    </header>

    <section className={styles.decision} aria-labelledby="decision-title">
      <div className={styles.chartPanel}>
        <h2 id="decision-title">Decision graph</h2>
        {data ? <>
          <p className={styles.graphSub}>Drawn to scale. Every vote, from the bottom of the bar to the top.</p>
          <ProposalGraph data={data} digits={digits} />
        </> : <p className={styles.empty}>{proposal.outcome === "discarded" ? "FPF discarded this question. Its votes were not published, so no calculation is shown." : "A missing tally cannot be treated as zero votes. Use the published result and linked source records below."}</p>}
      </div>
      <div className={styles.explanation}>
        <div className={styles.verdict} data-tone={!data || poll || proposal.outcome === "vetoed" ? "neutral" : approved ? "positive" : "negative"}>
          <span className={styles.verdictIcon} aria-hidden="true">{!data || poll || proposal.outcome === "vetoed" ? "i" : approved ? "✓" : "×"}</span>
          {poll && <span className={styles.eyebrow}>For comparison only</span>}
          <h2>{result}</h2>
          <p>{data ? `${data.approveShare === null ? "No directional votes were cast." : `${accept} is ${formatShare(data.approveShare)} of the directional vote.`} ${thresholdSummary}${poll ? " This poll set the program’s terms; this is not a grant approval decision." : ""}` : "The official status is kept separate from a calculation we cannot perform."}</p>
          {data && <p><strong>FPF’s current counting rule:</strong>{" "}{hasAbstain ? "All votes, including Abstain, count toward the 420,000 ZEC participation threshold. Abstain is excluded from the approval majority." : "All votes count toward the 420,000 ZEC participation threshold. Approval requires more than 50% of the directional vote."}</p>}
          {row.note && !proposal.correction && <p>{row.note.text} {row.note.href && <a href={row.note.href} target="_blank" rel="noreferrer">Source ↗</a>}</p>}
          {row.agrees === false && <p><strong>The calculation differs from the published result. Review the source before relying on this outcome.</strong></p>}
        </div>
        {data && <>
          <div className={styles.tableWrap}>
            <table className={`${styles.tally} ${styles.optionTotals}`}>
              <caption>Vote totals, all options</caption>
              <thead><tr><th scope="col">Option</th><th scope="col">ZEC</th><th scope="col">% of all votes</th><th scope="col">% of directional vote</th></tr></thead>
              <tbody>{data.options.map(option => <tr key={option.key}><th scope="row"><i className={styles[option.key]} />{shortOption(option.key, option.label)}</th><td>{zec(option.value)}</td><td>{option.share === null ? "—" : formatShare(option.share)}</td><td>{option.key === "abstain" ? <span className={styles.excluded}>Excluded</span> : option.directionalShare === null ? "—" : formatShare(option.directionalShare)}</td></tr>)}</tbody>
              <tfoot><tr><th scope="row">Total</th><td>{zec(data.total)}</td><td>{data.total > 0 ? "100%" : "—"}</td><td>{data.directional > 0 ? "100%" : "—"}</td></tr></tfoot>
            </table>
          </div>
          <div className={styles.tableWrap}>
            <table className={`${styles.tally} ${styles.keyNumbers}`}>
              <caption>Key numbers <small>ZEC unless noted</small></caption>
              <tbody>
                <tr><th scope="row">Participation threshold (ZIP 1016)</th><td>{formatZec(QUORUM_ZEC, 2)}</td></tr>
                <tr><th scope="row">All votes{hasAbstain ? ", with Abstain (FPF’s rule)" : ""}</th><td>{zec(data.total)} <b className={styles.check} data-met={data.quorumMet} aria-label={data.quorumMet ? "Minimum met" : "Below minimum"}>{data.quorumMet ? "✓" : "×"}</b></td></tr>
                <tr><th scope="row">Directional vote{hasAbstain ? ", without Abstain" : ""}</th><td>{zec(data.directional)}</td></tr>
                <tr><th scope="row">{accept}</th><td>{zec(row.accept!)}</td></tr>
                <tr><th scope="row">{hasLower ? "Rejects combined" : reject}</th><td>{zec(data.rejected)}</td></tr>
                <tr><th scope="row">Majority cutoff (50% of directional vote)</th><td>{formatZec(data.majorityCutoff, digits + 1)}</td></tr>
                <tr><th scope="row">{accept} share of directional vote</th><td>{data.approveShare === null ? "—" : formatShare(data.approveShare)}</td></tr>
              </tbody>
              <tfoot><tr><th scope="row">{poll ? "Grant-rule comparison" : "Calculated vote result"}</th><td className={styles.check} data-met={approved}>{approved ? "✓" : "×"} {calculatedLabel}</td></tr></tfoot>
            </table>
          </div>
        </>}
      </div>
    </section>

    {data && <section className={styles.arithmetic} aria-labelledby="calculation-title">
      <h2 id="calculation-title">Calculation, step by step</h2>
      <ol>
        <li><span className={styles.step}>1</span><div><h3>{hasLower ? "Rejects combined" : reject}</h3><p>{zec(row.reject!)}{hasLower ? ` + ${zec(row.lower ?? 0)}` : ""}</p><strong>= {zec(data.rejected)} ZEC</strong></div></li>
        <li><span className={styles.step}>2</span><div><h3>Directional vote</h3><p>{zec(row.accept!)} + {zec(data.rejected)}</p><strong>= {zec(data.directional)} ZEC</strong></div></li>
        <li><span className={styles.step}>3</span><div><h3>{accept} share</h3><p>{zec(row.accept!)} ÷ {zec(data.directional)}</p><strong>{data.approveShare === null ? "Undefined · no directional votes" : `= ${formatShare(data.approveShare)}`}</strong></div></li>
        <li><span className={styles.step}>4</span><div><h3>{poll ? "Comparison" : "Result"}</h3><p>{data.quorumMet ? "Participation met" : "Participation below minimum"}; {accept} {data.majorityMet ? "above" : "not above"} {hasLower ? "combined Rejects" : reject}.</p><strong className={styles.check} data-met={approved}>{approved ? "✓" : "×"} {calculatedLabel}{proposal.outcome === "vetoed" ? " · later vetoed" : ""}</strong></div></li>
      </ol>
    </section>}

    <section className={styles.reading} aria-labelledby="reading-title">
      <h2 id="reading-title">How to read this</h2>
      <div>
        <article><h3>Threshold</h3><p>ZIP 1016 requires at least 420,000 ZEC. {hasAbstain ? "Abstain counts under FPF’s current counting rule, clarified October 2, 2026. The ZIP does not explicitly define its treatment." : "All options on this ballot count toward participation."}{data && hasAbstain && <>{" "}{withoutMet ? "This proposal clears it with or without Abstain." : "Excluding Abstain would put participation below the minimum."}</>}</p></article>
        <article><h3>Majority</h3><p>{accept} must exceed {hasLower ? "both Reject options combined" : reject}.{hasAbstain ? " Abstain is excluded." : ""} More than 50% of directional votes is required; a tie does not pass. “Funded” means approval, not proof of disbursement.</p></article>
        <article><h3>{hasAbstain ? "Abstain" : "Published outcome"}</h3><p>{hasAbstain ? `${round.id === "q1-2026" ? "Q1’s ballot interface defaulted to Abstain. Q3 later required an explicit choice." : "An explicit choice in Q3, not a default."} It counts toward participation but neither helps nor hurts the majority test.` : "The published decision and calculated vote result are separate records. A later veto can stop payment even after a proposal passes."}</p></article>
      </div>
    </section>

    <section id="verify-yourself" className={styles.verify} aria-labelledby="verify-title">
      <div className={styles.verifyHead}><div><p className={styles.eyebrow}>Source records / reproducible checks</p><h2 id="verify-title">Verify it yourself</h2></div><Link href={`/coinholders/verify?round=${round.id}`}>Check the whole round →</Link></div>
      <div className={styles.sourcesGrid}>
        <div><h3>Counting-rule sources</h3><p>Read the specification and the administrator’s clarifications behind this calculation. <strong>FPF’s current counting rule</strong> will also be stated in its Q4 voting announcement.</p><p>FPF confirmed Q3’s Abstain was an explicit choice, not a default.</p><p className={styles.links}><a href={ZIP_1016_RULE.href} target="_blank" rel="noreferrer">ZIP 1016 ↗</a><a href={ZIP_1016_RULE.confirmedBy.href} target="_blank" rel="noreferrer">Majority · Sep 30 ↗</a><a href={ZIP_1016_RULE.participationConfirmedBy.href} target="_blank" rel="noreferrer">Participation · Oct 2 ↗</a></p></div>
        <div><h3>The tally and published outcome</h3>
          <p>{chain?.status === "ok" ? `Compared with ${chain.hostName}’s finalized summary, fetched ${utcTime(chain.fetchedAt)}.` : chain ? "The vote-chain comparison is unavailable on this visit. The figures above are OpenZcash’s recorded tally, not a fresh verification." : "Figures are OpenZcash’s copy of the historical source tally. Use the recount tools for this round to verify the ballots independently."}</p>
          {row.matchesChain !== null && <p className={styles.match} data-ok={row.matchesChain}>{row.matchesChain ? "✓ Every option matches the vote-chain summary." : "Tally mismatch: the source and this record differ. Review the round’s full comparison."}</p>}
          {chain?.status === "ok" && <details><summary>SHA-256 of the source response</summary><code className={styles.hash}>{chain.sha256}</code></details>}
          <p className={styles.small}>A matching hash identifies the same bytes. This does not re-tally encrypted ballots or identify individual voters.</p>
          <p className={styles.links}>{rawUrl && <a href={rawUrl} target="_blank" rel="noreferrer">Raw vote-chain tally ↗</a>}{round.talliesSource && !rawUrl && <a href={round.talliesSource.href} target="_blank" rel="noreferrer">Source tally ↗</a>}{official && <a href={official.href} target="_blank" rel="noreferrer">Published result ↗</a>}</p>
        </div>
      </div>
      <div className={styles.downloads}><span>Complete round data</span><a href={verifyApiPath(round.id, "csv")}>CSV ↓</a><a href={verifyApiPath(round.id, "json")}>JSON ↓</a>{chainId ? <a href={SCRIPT_PATH}>Verification script ↓</a> : <Link href={`/coinholders/verify?round=${round.id}#recount`}>Recount tools for this round →</Link>}</div>
      {rawUrl && row.ballot !== null && <details className={styles.reproduce}><summary>Read this ballot directly from the source</summary><p>Requires curl and jq. The chain records eighths of a ZEC, so each option is divided by 8.</p><CodeBlock wrap label={`Read ballot ${row.ballot} from the vote chain`} code={`curl -fsS '${rawUrl}' | jq '.proposals[] | select(.id == ${row.ballot}) | {ballot: .id, options: [.options[] | {option: .label, zec: ((.total_value // 0) / 8)}]}'`} /></details>}
    </section>
    {(proposal.correction || proposal.notes?.length || proposal.links.length) ? <section id="proposal-context" className={styles.context}><h2>Proposal & context</h2>{proposal.correction && row.note && <p>{row.note.text} {row.note.href && <a href={row.note.href} target="_blank" rel="noreferrer">FPF correction ↗</a>}</p>}{proposal.notes?.map(note => <p key={note}>{note}</p>)}<p className={styles.links}>{proposal.links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>)}</p></section> : null}
    <nav className={styles.neighbors} aria-label="Other proposals">{neighbors.map(({ p, label }) => p ? <Link key={label} href={proposalVerifyHref(round.id, p.id)}><small>{label}</small><span>{p.title}</span></Link> : <span key={label} />)}</nav>
    <footer id="community-credit" className={styles.credit} aria-label="Community contribution"><span>Page design by <strong>vaspholdings</strong></span><span aria-hidden="true">·</span><span>Built by OpenZcash</span></footer>
  </div>;
}
