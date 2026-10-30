import Link from "next/link";
import { ACTIVE_CYCLE } from "@/lib/coinholder/cycles";
import { CopilotPage } from "@/components/copilot/copilot-page";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Coinholder Copilot · OpenZcash",
  description:
    "Research Coinholder grant proposals and funding history in your AI assistant. Start without installation, save instructions, or add an optional agent skill.",
  path: "/zcg/coinholder/copilot",
});

const USE_CASES = [
  {
    q: "Review a current proposal before I vote.",
    a: "The ask, the claimed work, prior round verdicts, ledger history, announcement-vs-spreadsheet drift, and the open questions worth taking to the forum thread.",
  },
  {
    q: "Who in this round was funded before, and did they deliver?",
    a: "Compare public payment records and earlier applications. Check delivery evidence separately from funding status.",
  },
  {
    q: "How does the ballot actually work?",
    a: "Check the published round's options, dates, and keyholder veto rules against the FPF announcement.",
  },
  {
    q: "What has the Coinholder program actually paid so far?",
    a: "Recorded paid rows and their payment trail, kept distinct from requested amounts and grant budgets.",
  },
];

const SOURCES = [
  {
    name: "Current proposals",
    desc: "Official submissions carrying FPF's ready-for-vote label. The current round is in progress; check the announced dates and published ballot before voting.",
  },
  {
    name: "OpenZcash ledger",
    desc: "Audited mirror of the official ZCG spreadsheet. What was actually paid, to whom, across both programs.",
  },
  {
    name: "Prior rounds",
    desc: "The Results archive: published outcomes, rejections and withdrawals from previous rounds.",
  },
  {
    name: "FPF GitHub + forum",
    desc: "The application texts with their evidence links, and the community debate in each proposal's thread.",
  },
];

export default function CoinholderCopilotPage() {
  return (
    <CopilotPage
      title="Coinholder Copilot"
      subtitle="Research applications, evidence and funding history before voting."
      skill="coinholder-copilot"
      intro={
        <>
          Research retroactive grant proposals with your own AI assistant.
          Compare submitted evidence, prior rounds, and recorded payments.
          Start with the <Link href={ACTIVE_CYCLE.href}>{ACTIVE_CYCLE.label} proposals</Link> and
          check the sources before making your voting decision.
        </>
      }
      examples={USE_CASES}
      sources={SOURCES}
      note={
        <>
          The skill also encodes the round&apos;s real traps: repeat submissions
          at higher asks, same-org multiple proposals, third-party bonus
          nominations, announcement-vs-spreadsheet drift, and the difference
          between coinholder approval and actual payment. It lays out the
          evidence and never tells you how to vote. Methodology:{" "}
          <Link href="/zcg/methodology">how we compute this</Link>.
        </>
      }
    />
  );
}
