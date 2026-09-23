import Link from "next/link";
import { Terminal } from "./terminal";
import { CopilotPage } from "@/components/copilot/copilot-page";
import { CopyResearchPrompt } from "@/components/copilot/copy-prompt";
import { AddToAgent } from "@/components/copilot/add-to-agent";
import { InstallCommand } from "@/components/copilot/install-command";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ZCG Copilot · OpenZcash",
  description:
    "Research Zcash grants and project ideas with public sources in your AI assistant. Start with a prompt, with no installation required.",
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
          building for. Use public funding data in your own AI assistant, with
          source links and clear rules for checking the numbers.
        </>
      }
      examples={USE_CASES}
      sources={SOURCES}
      note={
        <>
          The research guide covers the data&apos;s real failure modes: same-title
          collisions between re-applications, requested vs paid confusion,
          milestone double counting. Methodology:{" "}
          <Link href="/zcg/methodology">how we compute this</Link>.
        </>
      }
      terminal={<Terminal />}
      start={<CopyResearchPrompt />}
      setup={
        <div className="ws-copilot-setup">
          <p className="ws-copilot-fine">
            Public data. No wallet or OpenZcash API key. Your AI provider&apos;s
            usual access and usage costs apply.
            {" "}<Link href="/zcg/copilot/instructions">Read the research guide</Link>.
          </p>
          <details className="ws-copilot-disclosure ws-copilot-advanced">
            <summary>Advanced: install as a skill</summary>
            <p>Optional, for people who want the instructions saved in their coding agent.</p>
            <InstallCommand skill="zcg-copilot" />
            <AddToAgent skill="zcg-copilot" />
            <p className="ws-copilot-fine">
              This command runs the third-party skills installer from npm.
              Review the instructions and files before installing; your agent&apos;s
              existing permissions still apply. Requires Node.js 22.20+.
              Optional helpers use Python 3.
              {" "}<a href="/.well-known/agent-skills/index.json">View the file list</a>.
            </p>
          </details>
        </div>
      }
    />
  );
}
