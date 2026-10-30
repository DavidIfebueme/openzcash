import { notFound } from "next/navigation";
import { readQ4 } from "@/lib/coinholder/q4-server";
import { Q4, q4Timestamp, q4Usd } from "@/lib/coinholder/q4";
import { ProposalMarkdown } from "@/components/participate/workspace/proposal-markdown";
import { SourceStatus } from "../source-status";
import base from "../../coinholders.module.css";
import styles from "../proposals.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposal · Coinholder Grants · OpenZcash" };

export default async function ProposalPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^[1-9]\d*$/.test(number)) notFound();
  const snapshot = await readQ4();
  const proposal = snapshot.proposals?.find((p) => p.number === Number(number));
  if (!proposal && snapshot.status === "current") notFound();
  return <div className={`${base.page} ${styles.page}`}>
    <SourceStatus snapshot={snapshot} />
    {proposal ? <>
      <header className={styles.detailHead}>
        <div>
          <p className={styles.eyebrow}>{Q4.label} <span>·</span> #{proposal.number}</p>
          <h1 className={`${base.title} ${styles.detailTitle}`}>{proposal.title}</h1>
          <p className={styles.detailIdentity}>{proposal.organization ?? proposal.applicant} · {proposal.category ?? "Uncategorized"}</p>
        </div>
        <div className={styles.detailAmount}>
          <span>Requested · USD</span><strong>{proposal.requestedUsdCents === null ? "Not specified" : q4Usd(proposal.requestedUsdCents)}</strong>
          <span className={styles.phase}>Ready for vote</span>
        </div>
      </header>
      <div className={styles.detailBar}>
        <a href={proposal.url} target="_blank" rel="noreferrer">Source &amp; discussion ↗</a>
        <span>Edited <time dateTime={proposal.updatedAt}>{q4Timestamp(proposal.updatedAt)}</time></span>
      </div>
      <article className={styles.markdown} aria-label="Application text"><ProposalMarkdown>{proposal.body || "No application text was provided. Open the GitHub submission for details."}</ProposalMarkdown></article>
    </> : <p className={base.lede}>This submission could not be checked. Please open the source above or try again shortly.</p>}
  </div>;
}
