"use client";

import { useState } from "react";
import { copyText } from "./copy-text";
import { installCommand } from "./command";

/**
 * One click copies the install command with the agent's flag. The marks are
 * brand glyphs from simple-icons rasterised in ink (public/logos/agents);
 * Codex has no published mark and keeps a plain glyph.
 */
const AGENTS = [
  { name: "Claude Code", flag: "claude-code" },
  { name: "Cursor", flag: "cursor" },
  { name: "OpenCode", flag: "opencode" },
  { name: "Codex", flag: "codex" },
  { name: "Windsurf", flag: "windsurf" },
  { name: "Copilot", flag: "github-copilot" },
];

export function AddToAgent({ skill }: { skill: string }) {
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
              src={`/logos/agents/${a.flag}.png`}
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
        …and 40+ more agents the{" "}
        <a
          href="https://github.com/vercel-labs/skills"
          target="_blank"
          rel="noopener noreferrer"
        >
          skills
        </a>{" "}
        CLI supports. Omit <code>-a</code> to auto-detect your agent, or add{" "}
        <code>-g</code> to install globally.
      </p>
    </div>
  );
}
