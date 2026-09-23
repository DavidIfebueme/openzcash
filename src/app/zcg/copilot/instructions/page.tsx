import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "ZCG Copilot research guide · OpenZcash",
  description: "Read the complete ZCG Copilot instructions in your browser before using them.",
};

export default async function CopilotInstructionsPage() {
  const instructions = await readFile(join(process.cwd(), "skills/zcg-copilot/SKILL.md"), "utf8");
  return (
    <div className="ws-copilot">
      <PageHeader title="Research guide" subtitle="The complete ZCG Copilot instructions, readable in your browser." />
      <p className="ws-copilot-note"><Link href="/zcg/copilot">← Back to ZCG Copilot</Link></p>
      <p className="ws-copilot-note">
        Opening this guide does not install a skill or run its helper scripts.
        The guide helps an AI assistant
        check public sources; it does not grant permissions or guarantee an answer&apos;s accuracy.
      </p>
      <pre className="ws-copilot-guide">{instructions}</pre>
    </div>
  );
}
