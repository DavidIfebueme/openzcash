import Link from "next/link";
import { CopilotPage } from "@/components/copilot/copilot-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Coinholder Copilot · OpenZcash",
  description:
    "Research Coinholder grant proposals and funding history in your AI assistant. Start without installation, save instructions, or add an optional agent skill.",
};

const USE_CASES = [
  {
    q: "Run diligence on proposal #21 before I vote.",
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
    name: "Round mirror",
    desc: "A dated record of proposals, asks, and ballot options from FPF's announcement. Check its dates before treating the round as open.",
  },
  {
    name: "OpenZcash ledger",
    desc: "Audited mirror of the official ZCG spreadsheet. What was actually paid, to whom, across both programs.",
  },
  {
    name: "Prior rounds",
    desc: "The Coinholder proposals tab: rejections, withdrawals and late submissions that never reach the ledger.",
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
          Check the sources and make your own voting decision.
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
