"use client";

import { useState } from "react";
import { copyText } from "./copy-text";
import { RESEARCH_ASSISTANTS } from "./research-assistants";
import { researchPrompt, type CopilotProfile } from "./profiles";

export function CopyResearchPrompt({ profile, selectedId, onSelect }: { profile: CopilotProfile; selectedId: string; onSelect: (id: string) => void }) {
  const [question, setQuestion] = useState("");
  const [copyResult, setCopyResult] = useState<{ id: string; prompt: string; result: "copied" | "failed" } | null>(null);
  const selected = RESEARCH_ASSISTANTS.find((a) => a.id === selectedId)!;
  const prompt = researchPrompt(profile, question);
  const status = copyResult?.id === selectedId && copyResult.prompt === prompt ? copyResult.result : "idle";
  function select(id: string) {
    onSelect(id);
    setCopyResult(null);
  }
  function updateQuestion(value: string) {
    setQuestion(value);
    setCopyResult(null);
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
                <img src={a.logo} width={18} height={18} alt="" />
              </span>
              <span>{a.name}</span>
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
        <button type="button" onClick={async () => setCopyResult({ id: selectedId, prompt, result: await copyText(prompt) ? "copied" : "failed" })}>
          {status === "copied" ? "Prompt copied ✓" : `Copy for ${selected.name}`}
        </button>
        <a href={selected.id === "other" ? `${profile.path}/instructions` : selected.url} target="_blank" rel="noopener noreferrer">{selected.action} <span aria-hidden="true">↗</span></a>
      </div>
      <p className="ws-research-feedback" role="status">
        {status === "failed" ? "Copy failed. Select the text in the preview." : status === "copied" ? `Paste into ${selected.name} to begin.` : "Copy and paste into your assistant. Nothing is sent automatically."}
      </p>
      <details className="ws-copilot-disclosure">
        <summary>Preview the prompt</summary>
        <pre>{prompt}</pre>
      </details>
    </div>
  );
}
