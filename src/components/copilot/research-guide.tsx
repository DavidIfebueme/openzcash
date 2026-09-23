import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { COPILOT_PROFILES, type CopilotSkill } from "./profiles";

export async function ResearchGuide({ skill }: { skill: CopilotSkill }) {
  const profile = COPILOT_PROFILES[skill];
  const instructions = await readFile(join(process.cwd(), "skills", profile.skill, "SKILL.md"), "utf8");
  return (
    <div className="ws-copilot">
      <PageHeader title="Research guide" subtitle={`The complete ${profile.title} instructions, readable in your browser.`} />
      <p className="ws-copilot-note"><Link href={profile.path}>← Back to {profile.title}</Link></p>
      <p className="ws-copilot-note">Opening this guide does not install software or run scripts. It helps an AI assistant check public sources; it does not grant permissions or guarantee an answer&apos;s accuracy.</p>
      <pre className="ws-copilot-guide">{instructions}</pre>
    </div>
  );
}
