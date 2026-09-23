"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CopyResearchPrompt } from "./copy-prompt";
import { AddToAgent } from "./add-to-agent";
import { InstallCommand } from "./install-command";
import { copyText } from "./copy-text";
import type { CopilotProfile } from "./profiles";

const LEVELS = [
  { title: "Quick start", detail: "No installation" },
  { title: "Save instructions", detail: "Manual setup" },
  { title: "Agent skill", detail: "Optional install" },
];

export function CopilotSetup({ profile, brief }: { profile: CopilotProfile; brief: ReactNode }) {
  const [level, setLevel] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "loading" | "copied" | "failed">("idle");
  const guide = `${profile.path}/instructions`;
  async function copyInstructions() {
    setCopyStatus("loading");
    try {
      const response = await fetch(`/.well-known/agent-skills/${profile.skill}/SKILL.md`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Guide unavailable");
      const instructions = await response.text();
      if (!instructions.startsWith("---\n") || !instructions.includes(`name: ${profile.skill}\n`)) throw new Error("Unexpected guide");
      setCopyStatus(await copyText(instructions) ? "copied" : "failed");
    } catch {
      setCopyStatus("failed");
    }
  }
  return (
    <div className="ws-copilot-experience">
      <div className="ws-setup-heading"><h2>Three levels of setup</h2><span>Start with level 1. The others are optional.</span></div>
      <div className="ws-setup-levels" role="group" aria-label="Setup level">
        {LEVELS.map((option, index) => (
          <button type="button" key={option.title} aria-pressed={level === index} aria-controls={`copilot-level-${index + 1}`} onClick={() => setLevel(index)}>
            <span className="ws-setup-number">{index + 1}</span>
            <span><strong>{option.title}</strong><small>{option.detail}</small></span>
          </button>
        ))}
      </div>
      <div className="ws-copilot-hero">
        <div>
          <div id="copilot-level-1" hidden={level !== 0}>
            <CopyResearchPrompt profile={profile} />
          </div>
          <div id="copilot-level-2" hidden={level !== 1} className="ws-research-picker ws-setup-panel">
            <h2>Keep the guide for future chats</h2>
            <p>Save the public instructions in an assistant project or workspace that supports reference files. Setup depends on your app.</p>
            <ol>
              <li>Read the guide, then copy its instructions.</li>
              <li>Save them as a Markdown file in your assistant&apos;s project or supported skills folder.</li>
              <li>Start a chat, refer to the guide, and enable web access.</li>
            </ol>
            <div className="ws-research-actions">
              <button type="button" onClick={copyInstructions} disabled={copyStatus === "loading"}>{copyStatus === "loading" ? "Loading…" : copyStatus === "copied" ? "Instructions copied ✓" : "Copy full instructions"}</button>
              <Link href={guide}>Read the guide <span aria-hidden="true">↗</span></Link>
            </div>
            <p className="ws-research-feedback" role="status">{copyStatus === "failed" ? "Could not copy. Open the guide and select the text." : "Text instructions only. No installer runs and nothing is added to your assistant automatically."}</p>
          </div>
          <div id="copilot-level-3" hidden={level !== 2} className="ws-research-picker ws-setup-panel">
            <h2>Add a skill to your coding agent</h2>
            <p>For regular use in an existing coding agent. Review the guide before running the command in your project terminal.</p>
            <InstallCommand skill={profile.skill} />
            <AddToAgent skill={profile.skill} />
            <p className="ws-copilot-fine">Requires Node.js 22.20+. This runs the third-party skills installer. Your agent&apos;s permissions still apply.{profile.skill === "zcg-copilot" ? " Optional data helpers require Python 3." : " This package contains text instructions; no helper scripts."}</p>
            <div className="ws-research-actions"><Link href={guide}>Read the guide ↗</Link><a href="/.well-known/agent-skills/index.json">View published files ↗</a></div>
          </div>
          <p className="ws-copilot-fine ws-setup-access">Public data. No wallet or OpenZcash API key. Your AI provider&apos;s usual access and usage costs apply.</p>
        </div>
        <div className="ws-copilot-demo">{brief}</div>
      </div>
    </div>
  );
}
