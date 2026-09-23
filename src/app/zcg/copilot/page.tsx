import Link from "next/link";
import { Terminal } from "./terminal";
import { CopilotPage } from "@/components/copilot/copilot-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ZCG Copilot · OpenZcash",
  description:
    "An agent skill that turns your coding agent into a ZCG grants copilot: live, cited answers about Zcash Community Grants funding.",
};

const USE_CASES = [
  {
    q: "I want to build privacy-preserving payments on Zcash. Vet this idea.",
    a: "Compare recorded funding, declined applications, and the latest published review queue. Identify gaps to investigate.",
  },
  {
    q: "I'm applying for a wallet grant. Who got funded before, and how much?",
    a: "Explore wallet grants in the ledger: grantee, budget, milestones paid, and dates.",
  },
  {
    q: "What's ZCG's burn rate this year, month by month?",
    a: "Aggregated from the payment ledger CSV, split by program, spikes explained line by line.",
  },
  {
    q: "How much has ZCG paid to QEDIT in total?",
    a: "Budgeted vs actually paid, across how many grants and payments.",
  },
];

const SOURCES = [
  {
    name: "OpenZcash ledger",
    desc: "Mirror of the official ZCG spreadsheet. Payments, recipients, and grants in JSON and CSV, with published methodology.",
  },
  {
    name: "Published review queue",
    desc: "GitHub applications reconciled with published decisions. Status updates are published the following day.",
  },
  {
    name: "Supplementary grant records",
    desc: "Requested vs approved amounts from a committee member's grants prototype (zcg.pgpz.org). The Grant Dashboard spreadsheet stays the source of truth.",
  },
  {
    name: "GitHub + forum",
    desc: "Full application texts, labels, and the community debate around each proposal.",
  },
];

export default function ZcgCopilotPage() {
  return (
    <CopilotPage
      title="ZCG Copilot"
      subtitle="Source-backed research for Zcash grants and public spending."
      skill="zcg-copilot"
      intro={
        <>
          Research existing grants, compare projects, and find gaps worth
          building for. Add the skill to your AI agent to query public funding
          data with source links and clear rules for checking the numbers.
        </>
      }
      examples={USE_CASES}
      sources={SOURCES}
      note={
        <>
          The skill also encodes the data&apos;s real failure modes: same-title
          collisions between re-applications, requested vs paid confusion,
          milestone double counting. Methodology:{" "}
          <Link href="/zcg/methodology">how we compute this</Link>.
        </>
      }
      terminal={<Terminal />}
      setup={
        <div className="ws-copilot-setup">
          <p><strong>Get started</strong></p>
          <ol>
            <li>Copy the command for your agent and run it in your project&apos;s terminal.</li>
            <li>Open your agent and ask it to use ZCG Copilot to research your idea.</li>
          </ol>
          <p className="ws-copilot-fine">
            Requires Node.js 22.20+ and a compatible agent. Your AI provider&apos;s usual
            access and usage costs apply. Optional helpers use Python 3.
            {" "}<a href="/.well-known/agent-skills/zcg-copilot/SKILL.md">Read the skill</a>
            {" · "}<a href="/.well-known/agent-skills/zcg-copilot/README.md">Installation guide</a>
          </p>
        </div>
      }
    />
  );
}
