"use client";

import { useState } from "react";
import { copyText } from "./copy-text";
import { installCommand } from "./command";
import type { CopilotSkill } from "./profiles";

/**
 * Copies a command for an explicitly supported coding agent.
 */
const AGENTS = [
  { name: "Cursor", flag: "cursor", logo: "/logos/agents/cursor.png" },
  { name: "Claude Code", flag: "claude-code", logo: "/logos/assistants/claude.svg" },
  { name: "Codex", flag: "codex", logo: "/logos/assistants/openai.png" },
  { name: "GitHub Copilot", flag: "github-copilot", logo: "/logos/agents/github-copilot.png" },
  { name: "OpenCode", flag: "opencode", logo: "/logos/agents/opencode.png" },
];

export function AddToAgent({ skill }: { skill: CopilotSkill }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (flag: string) => {
    const ok = await copyText(
      installCommand(skill, flag),
    );
    if (ok) {
      setCopied(flag);
      setTimeout(() => setCopied((c) => (c === flag ? null : c)), 1600);
    }
  };
  return (
    <div className="ws-agents">
      <p className="ws-copilot-label">Add to your agent</p>
      <div className="ws-agent-row">
        {AGENTS.map((a) => (
          <button
            key={a.flag}
            type="button"
            onClick={() => copy(a.flag)}
            className="ws-agent-chip"
            aria-label={`Copy the install command for ${a.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.logo}
              alt=""
              width={16}
              height={16}
              className="ws-agent-mark"
            />
            <span>{a.name}</span>
            <small>{copied === a.flag ? "copied" : "copy"}</small>
          </button>
        ))}
      </div>
      <p className="ws-copilot-fine">
        More agents are supported by the{" "}
        <a
          href="https://github.com/vercel-labs/skills"
          target="_blank"
          rel="noopener noreferrer"
        >
          skills
        </a>{" "}
        CLI. Omit <code>-a</code> to auto-detect your agent, or add{" "}
        <code>-g</code> to install globally.
      </p>
    </div>
  );
}
