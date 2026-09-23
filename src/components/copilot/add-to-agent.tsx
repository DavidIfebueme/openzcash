"use client";

import { useState } from "react";
import { copyText } from "./copy-text";
import { installCommand } from "./command";
import type { CopilotSkill } from "./profiles";
import { RESEARCH_ASSISTANTS } from "./research-assistants";

/**
 * Copies a command for an explicitly supported coding agent.
 */
const AGENTS = RESEARCH_ASSISTANTS.filter((a) => a.installAgent);
const CHATS = RESEARCH_ASSISTANTS.filter((a) => a.group === "chat");

export function AddToAgent({ skill, onUsePrompt }: { skill: CopilotSkill; onUsePrompt: (id: string) => void }) {
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
      <p className="ws-copilot-label">Install in a coding agent</p>
      <div className="ws-agent-row">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => copy(a.installAgent!)}
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
            <small>{copied === a.installAgent ? "copied" : "copy"}</small>
          </button>
        ))}
      </div>
      <div className="ws-chat-alternatives">
        <p className="ws-copilot-label">AI chat <span>Use a prompt</span></p>
        <div className="ws-agent-row">
          {CHATS.map((a) => (
            <button type="button" key={a.id} className="ws-agent-chip" onClick={() => onUsePrompt(a.id)} aria-label={`Use a prompt with ${a.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.logo} alt="" width={16} height={16} className="ws-agent-mark" />
              <span>{a.name}</span><span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
