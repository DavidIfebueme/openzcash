import { formatZec, QUORUM_ZEC } from "@/lib/coinholder/derive";
import { proposalDecision } from "@/lib/coinholder/proposal-decision";
import { formatShare } from "@/lib/coinholder/verify-view";
import styles from "./proposal-detail.module.css";
import { segmentLabelY } from "./proposal-graph-layout";

type Decision = NonNullable<ReturnType<typeof proposalDecision>>;
const display = (value: number) => formatZec(value, 2);

/** Only geometry is rounded for display. The verifier supplies every result. */
export function ProposalGraph({ data, digits }: { data: Decision; digits: number }) {
  const accept = data.options.find(option => option.key === "approve")!;
  const abstain = data.options.find(option => option.key === "abstain");
  const rejects = data.options.some(option => option.key === "rejectLower") ? "Rejects" : data.options.find(option => option.key === "reject")?.label ?? "Reject";
  const withoutMet = data.directional >= QUORUM_ZEC;
  const floor = 650, height = 560, x = 300, width = 206;
  const y = (position: number) => floor - height * position;
  const directionalY = y(data.directional / data.scaleMax);
  const top = y(data.total / data.scaleMax);
  const markers = [
    { key: "majority", line: y(data.majorityPosition), met: data.majorityMet },
    { key: "quorum", line: y(data.quorumPosition), met: data.quorumMet },
  ].sort((a, b) => a.line - b.line);
  const referenceLines = markers.filter(marker => marker.key !== "majority" || data.directional > 0).map(marker => marker.line);
  const firstTop = Math.max(104, Math.min(markers[0].line - 58, floor - 248));
  const secondTop = Math.min(floor - 116, Math.max(firstTop + 132, markers[1].line - 58));
  const directionalTextY = Math.max(285, Math.min(floor - 105, (directionalY + floor) / 2 - 30));
  const abstainTextY = Math.max(108, Math.min(directionalTextY - 136, (top + directionalY) / 2 - 30));

  function notes(kind: string) {
    return kind === "majority"
      ? ["Majority cutoff (50%)", `${display(data.majorityCutoff)} ZEC`, "Half the directional vote.", `${accept.label}: ${display(accept.value)} ZEC`, data.majorityMet ? "Above cutoff · majority met" : "At or below cutoff · not met"]
      : ["Participation threshold", "420,000 ZEC", data.quorumMet ? "Met under FPF’s current rule." : "Not met under FPF’s current rule.", `${abstain ? "With Abstain" : "All votes"}: ${display(data.total)}`, abstain ? `Without: ${display(data.directional)}` : "Every ballot option is counted."];
  }

  return <figure className={styles.graph}>
    <svg className={styles.wideGraph} viewBox="0 0 810 690" role="img" aria-labelledby="decision-graph-title decision-graph-desc">
      <title id="decision-graph-title">Vote volume and decision thresholds</title>
      <desc id="decision-graph-desc">{`All options stacked to scale from zero. Dotted dark line: 420,000 ZEC participation minimum. Dashed white line: half the directional vote, which ${accept.label} must exceed. Callouts explain each test. Exact values appear in the tables.`}</desc>
      <text x={x + width / 2} y={33} textAnchor="middle" className={styles.graphMuted}>All votes</text>
      <text x={x + width / 2} y={58} textAnchor="middle" className={styles.graphTotal}>{display(data.total)} ZEC</text>
      <line x1={x - 5} x2={x - 5} y1={90} y2={floor} className={styles.axis} />
      {data.options.map(option => {
        const labelY = segmentLabelY(y(option.start + option.size), y(option.start), referenceLines);
        return <g key={option.key}>
          <rect x={x} y={y(option.start + option.size)} width={width} height={height * option.size} className={styles[option.key]}>
            <title>{`${option.label}: ${formatZec(option.value, digits)} ZEC`}</title>
          </rect>
          {labelY !== null && <text x={x + width / 2} y={labelY} textAnchor="middle" className={styles.segmentLabel} data-option={option.key}>{display(option.value)} ZEC · {formatShare(option.share!)}</text>}
        </g>;
      })}
      <text x={x - 12} y={top + 4} textAnchor="end" className={styles.axisLabel}>{display(data.total)}</text>
      {abstain && abstain.size > .065 && data.directional / data.scaleMax > .065 && <text x={x - 12} y={directionalY + 4} textAnchor="end" className={styles.axisLabel}>{display(data.directional)}</text>}
      <text x={x - 12} y={floor + 5} textAnchor="end" className={styles.axisLabel}>0</text>
      <line x1={x} x2={x + width} y1={floor} y2={floor} className={styles.axis} />
      {markers.map((marker, index) => {
        const boxY = index ? secondTop : firstTop;
        const lines = notes(marker.key);
        return <g key={marker.key}>
          <path d={`M222 ${boxY + 58} H244 L270 ${marker.line} H${x}`} className={styles.connector} />
          <rect x={0} y={boxY} width={222} height={116} rx={8} className={styles.calloutBox} data-met={marker.met} />
          {lines.map((line, i) => <text key={i} x={12} y={boxY + 22 + i * 19} className={i < 2 ? styles.calloutHeading : styles.calloutText} data-met={marker.met}>{line}</text>)}
        </g>;
      })}
      <line x1={x} x2={x + width} y1={y(data.quorumPosition)} y2={y(data.quorumPosition)} className={styles.quorumLine} />
      {data.directional > 0 && <>
        <line x1={x} x2={x + width} y1={y(data.majorityPosition)} y2={y(data.majorityPosition)} className={styles.majorityHalo} />
        <line x1={x} x2={x + width} y1={y(data.majorityPosition)} y2={y(data.majorityPosition)} className={styles.majorityLine} />
      </>}
      {abstain && abstain.value > 0 && <>
        <path d={`M516 ${top} h5 q5 0 5 5 V${Math.max(top + 5, directionalY - 5)} q0 5 -5 5 h-5`} className={styles.abstainBracket} />
        <text x={545} y={abstainTextY} className={styles.annotationTitle}>Abstain</text>
        <text x={545} y={abstainTextY + 22} className={styles.annotation}>{display(abstain.value)} ZEC ({formatShare(abstain.share!)})</text>
        <text x={545} y={abstainTextY + 44} className={styles.annotation}>Excluded from the majority.</text>
        <text x={545} y={abstainTextY + 64} className={styles.annotation}>Counts toward participation</text>
        <text x={545} y={abstainTextY + 84} className={styles.annotation}>under FPF’s current rule.</text>
      </>}
      {data.directional > 0 && <path d={`M516 ${directionalY} h5 q5 0 5 5 V${floor - 5} q0 5 -5 5 h-5`} className={styles.directionalBracket} />}
      <text x={545} y={directionalTextY} className={styles.annotationTitle} data-accent="true">Directional vote</text>
      <text x={545} y={directionalTextY + 22} className={styles.annotation}>{accept.label} + {rejects}</text>
      <text x={545} y={directionalTextY + 44} className={styles.annotation}>{display(data.directional)} ZEC ({data.total ? formatShare(data.directional / data.total) : "—"})</text>
      <text x={545} y={directionalTextY + 66} className={styles.annotation}>Used for the majority test.</text>
    </svg>

    <div className={styles.mobileGraph}>
      <p className={styles.mobileTotal}><span>All votes</span><strong>{display(data.total)} ZEC</strong></p>
      <svg viewBox="0 0 360 340" role="img" aria-labelledby="mobile-graph-title mobile-graph-desc">
        <title id="mobile-graph-title">Full vote volume, with participation and majority lines</title>
        <desc id="mobile-graph-desc">A proportional stack from zero. The callouts below explain the participation and majority lines. Exact amounts for every option follow in the tally table.</desc>
        {data.options.map(option => <rect key={option.key} x={40} width={142} y={312 - 290 * (option.start + option.size)} height={290 * option.size} className={styles[option.key]} />)}
        <line x1={40} x2={182} y1={312 - 290 * data.quorumPosition} y2={312 - 290 * data.quorumPosition} className={styles.quorumLine} />
        {data.directional > 0 && <>
          <line x1={40} x2={182} y1={312 - 290 * data.majorityPosition} y2={312 - 290 * data.majorityPosition} className={styles.majorityHalo} />
          <line x1={40} x2={182} y1={312 - 290 * data.majorityPosition} y2={312 - 290 * data.majorityPosition} className={styles.majorityLine} />
        </>}
        <text x={30} y={316} textAnchor="end" className={styles.axisLabel}>0</text>
        {abstain && abstain.value > 0 && <>
          <text x={197} y={55} className={styles.annotationTitle}>Abstain</text>
          <text x={197} y={77} className={styles.annotation}>{display(abstain.value)} ZEC</text>
          <text x={197} y={97} className={styles.annotation}>{formatShare(abstain.share!)} of all votes</text>
        </>}
        <text x={197} y={207} className={styles.annotationTitle}>Directional vote</text>
        <text x={197} y={229} className={styles.annotation}>{display(data.directional)} ZEC</text>
        <text x={197} y={249} className={styles.annotation}>{accept.label} + {rejects}</text>
        {abstain && <text x={197} y={269} className={styles.annotation}>Abstain excluded</text>}
      </svg>
      <div className={styles.mobileTests}>
        <div><strong><i className={styles.majorityKey} />Majority cutoff (50%)</strong><b>{display(data.majorityCutoff)} ZEC</b><span>{accept.label} must exceed this value. {data.majorityMet ? "Met." : "Not met."}</span></div>
        <div><strong><i className={styles.quorumKey} />Participation threshold</strong><b>420,000 ZEC</b><span>{data.quorumMet ? "Met" : "Not met"}{abstain ? " with Abstain" : ""} under FPF’s current rule.{abstain ? ` ${withoutMet ? "Also met" : "Not met"} without Abstain.` : ""}</span></div>
      </div>
    </div>
    <figcaption>Voting power in ZEC, not a count of people. Chart labels are rounded to 2 decimals; tables retain source precision.</figcaption>
  </figure>;
}
