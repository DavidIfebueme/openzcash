"use client";

import { useState } from "react";
import { copyText } from "./copy-text";
import { RESEARCH_ASSISTANTS } from "./research-assistants";
import { researchPrompt, type CopilotProfile } from "./profiles";

export function CopyResearchPrompt({ profile }: { profile: CopilotProfile }) {
  const [selectedId, setSelectedId] = useState("chatgpt");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const selected = RESEARCH_ASSISTANTS.find((a) => a.id === selectedId)!;
  const prompt = researchPrompt(profile, question);
  function select(id: string) {
    setSelectedId(id);
    setStatus("idle");
  }
  function updateQuestion(value: string) {
    setQuestion(value);
    setStatus("idle");
  }
  return (
    <div className="ws-copilot-start ws-research-picker">
      <div className="ws-research-heading">
        <h2>Start your research</h2>
        <span>No installation</span>
      </div>
      <fieldset className="ws-research-assistants">
        <legend>Choose your assistant</legend>
        <div className="ws-assistant-groups" aria-label="Assistant category">
          <button type="button" aria-pressed={selected.group === "chat"} onClick={() => select("chatgpt")}>AI chat</button>
          <button type="button" aria-pressed={selected.group === "coding"} onClick={() => select("cursor")}>Coding agents</button>
        </div>
        <div className="ws-assistant-grid">
          {RESEARCH_ASSISTANTS.filter((a) => a.group === selected.group).map((a) => (
            <label key={a.id} className="ws-assistant-choice" data-selected={a.id === selectedId}>
              <input className="sr-only" type="radio" name="research-assistant" value={a.id} checked={a.id === selectedId} onChange={() => select(a.id)} />
              <span className="ws-assistant-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.logo} width={24} height={24} alt="" />
              </span>
              <span>{a.name}</span>
              <span className="ws-assistant-check" aria-hidden="true">✓</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="ws-assistant-hint" aria-live="polite"><strong>{selected.name}</strong> · {selected.hint}</p>
      <div className="ws-research-question">
        <label htmlFor="copilot-question">Your idea or question <span>Optional</span></label>
        <textarea id="copilot-question" rows={3} maxLength={1500} value={question} onChange={(e) => updateQuestion(e.target.value)} placeholder={profile.placeholder} />
        <div className="ws-research-presets" aria-label="Example questions">
          {profile.presets.map((p) => <button type="button" key={p.label} onClick={() => updateQuestion(p.question)}>{p.label}</button>)}
        </div>
      </div>
      <div className="ws-research-actions">
        <button type="button" onClick={async () => setStatus(await copyText(prompt) ? "copied" : "failed")}>
          {status === "copied" ? "Prompt copied ✓" : `Copy for ${selected.name}`}
        </button>
        <a href={selected.id === "other" ? `${profile.path}/instructions` : selected.url} target="_blank" rel="noopener noreferrer">{selected.action} <span aria-hidden="true">↗</span></a>
      </div>
      <p className="ws-research-feedback" role="status">
        {status === "failed" ? "Copy failed. Open the preview below and select the text." : status === "copied" ? `Paste into ${selected.name} to begin. Nothing is sent automatically.` : "Copy the prompt, then paste it into your assistant. Your text stays in this page until you share it."}
      </p>
      <details className="ws-copilot-disclosure">
        <summary>Preview the prompt</summary>
        <pre>{prompt}</pre>
      </details>
    </div>
  );
}
