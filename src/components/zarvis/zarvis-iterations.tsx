"use client";
import { useState } from "react";
import Link from "next/link";
import { ZarvisMark } from "./zarvis-mark";
import { ZarvisFigure } from "./zarvis-figure";
import { ZarvisChat } from "./zarvis-chat";
import { useZarvis } from "./zarvis-provider";
import type { ZarvisExpression } from "@/lib/zarvis/types";

const states: { value: ZarvisExpression; label: string }[] = [
  { value: "idle", label: "Idle" }, { value: "greeting", label: "Wave" },
  { value: "listening", label: "Listening" }, { value: "thinking", label: "Thinking" },
  { value: "explaining", label: "Replying" }, { value: "pleased", label: "Complete" },
  { value: "error", label: "Error" },
];

export function ZarvisIterations() {
  const chat = useZarvis();
  const [selection, setSelection] = useState<ZarvisExpression>("idle");
  const [take, setTake] = useState(0);
  const [followLive, setFollowLive] = useState(false);
  const expression = followLive ? chat.expression : selection;
  return <div className="zarvis-studio">
    <header className="zarvis-studio-header">
      <div><p className="zarvis-studio-eyebrow">LOCAL PREVIEW</p><h1>Zarvis, outside the frame.</h1><p>Compare the iterations, try each expression, then start a real conversation.</p></div>
      <Link href="/zarvis">Open full chat ↗</Link>
    </header>
    <section className="zarvis-studio-controls" aria-label="Animation preview controls">
      <div role="group" aria-label="Preview an expression">{states.map(({ value, label }) => <button key={value} type="button" aria-pressed={!followLive && selection === value}
        onClick={() => { setFollowLive(false); setSelection(value); setTake((n) => n + 1); }}>{label}</button>)}</div>
      <div className="zarvis-studio-options"><label><input type="checkbox" checked={followLive} onChange={(event) => setFollowLive(event.target.checked)}/> Follow the live conversation</label>
        <button type="button" onClick={chat.toggleMotion}>{chat.motionPaused ? "Resume motion" : "Pause motion"}</button></div>
      <p>{followLive ? "The figures follow the real chat below." : "Expression previews only. These buttons do not send AI requests."}</p>
    </section>
    <section className="zarvis-iteration-grid" aria-label="Mascot iterations">
      <article className="zarvis-iteration-card"><header><span>01</span><h2>Avatar</h2><small>Previous</small></header>
        <div className="zarvis-iteration-stage"><ZarvisMark key={take} className="zarvis-iteration-before" expression={expression} animated paused={chat.motionPaused}/></div>
        <p>Portrait inside a circular frame.</p></article>
      <article className="zarvis-iteration-card zarvis-iteration-current"><header><span>02</span><h2>Free-standing</h2><small>Current</small></header>
        <div className="zarvis-iteration-stage"><ZarvisFigure key={take} expression={expression} paused={chat.motionPaused}/></div>
        <p>Full body, transparent backdrop, room to move.</p></article>
    </section>
    <section className="zarvis-studio-live" aria-labelledby="zarvis-live-title">
      <header><div><p className="zarvis-studio-eyebrow">03 · REAL INTERACTION</p><h2 id="zarvis-live-title">Talk to Zarvis</h2></div><span>{chat.status ? (chat.status.available ? "OpenAI connected" : "Chat unavailable") : "Checking connection…"}</span></header>
      <p>This is the real chat. Messages are sent to OpenAI and use the configured request limits.</p>
      <ZarvisChat compact/>
    </section>
  </div>;
}
