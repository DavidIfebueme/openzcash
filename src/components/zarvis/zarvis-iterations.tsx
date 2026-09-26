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
  { value: "explaining", label: "Replying" }, { value: "reading", label: "Reading" },
  { value: "exploring", label: "Exploring" }, { value: "protecting", label: "Privacy" },
  { value: "pleased", label: "Celebrate" }, { value: "error", label: "Error" },
];
const examples: { value: ZarvisExpression; label: string; when: string; example: string; question?: string }[] = [
  { value: "idle", label: "At rest", when: "Waiting for a question or listening while you type.", example: "Open the chat and start typing." },
  { value: "greeting", label: "Hello", when: "When the chat opens, or when you tap the welcome mascot.", example: "Tap Zarvis to say hello again." },
  { value: "thinking", label: "Thinking", when: "While processing your question. Also used when a reply is interrupted.", example: "“Finding the right sources…”" },
  { value: "explaining", label: "Explaining", when: "During general answers, and after the latest answer finishes.", example: "How is new ZEC issued?", question: "How is new ZEC issued? Explain briefly." },
  { value: "reading", label: "Reading", when: "For ZIPs and documentation, or while reading public OpenZcash records.", example: "What is ZIP 316?", question: "What is ZIP 316? Explain briefly and link the official source." },
  { value: "exploring", label: "Exploring", when: "For ecosystem questions, or while checking web sources.", example: "Which Zcash wallets can I explore?", question: "Which Zcash wallets can I explore? Give a short overview with sources." },
  { value: "protecting", label: "Privacy", when: "For questions about privacy, security and viewing keys.", example: "What can a viewing key reveal?", question: "What can a Zcash viewing key reveal, and can it spend funds? Answer briefly." },
  { value: "pleased", label: "Complete", when: "For a brief moment after an answer finishes, then back to its topic pose.", example: "Completion, not a guarantee of accuracy." },
];

export function ZarvisIterations() {
  const chat = useZarvis();
  const [selection, setSelection] = useState<ZarvisExpression>("idle");
  const [take, setTake] = useState(0);
  const [followLive, setFollowLive] = useState(false);
  const expression = followLive ? chat.expression : selection;
  function tryQuestion(question: string) {
    chat.setDraft(question);
    document.getElementById("zarvis-live-title")?.scrollIntoView({ block: "start" });
    document.getElementById("zarvis-live-title")?.closest("section")?.querySelector("textarea")?.focus({ preventScroll: true });
  }
  return <div className="zarvis-studio">
    <header className="zarvis-studio-header">
      <div><p className="zarvis-studio-eyebrow">LOCAL PREVIEW</p><h1>Eight poses. One Zarvis.</h1><p>See every pose in motion and when it appears in the chat.</p></div>
      <Link href="/zarvis">Open full chat ↗</Link>
    </header>
    <section className="zarvis-pose-gallery" aria-label="Eight animated pose examples">
      <div className="zarvis-gallery-toolbar"><p>Animated examples · no AI requests</p><button type="button" onClick={chat.toggleMotion}>{chat.motionPaused ? "Resume motion" : "Pause motion"}</button></div>
      <div className="zarvis-pose-grid">{examples.map(({ value, label, when, example, question }, index) => <article className="zarvis-pose-card" key={value} aria-label={`${label} example`}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><h2>{label}</h2></header>
        <div className="zarvis-pose-stage"><ZarvisFigure expression={value} paused={chat.motionPaused}/></div>
        <p>{when}</p>
        {question ? <button className="zarvis-example-question" type="button" onClick={() => tryQuestion(question)} title="Put this example in the chat below">{example}<span aria-hidden="true"> ↗</span></button> : <small>{example}</small>}
      </article>)}</div>
      <p className="zarvis-gallery-note">In a conversation, one pose appears at a time. Example questions fill the chat below; press Send to get a real answer.</p>
    </section>
    <details className="zarvis-studio-comparison">
      <summary>Compare with the previous avatar</summary>
      <section className="zarvis-studio-controls" aria-label="Animation preview controls">
        <div role="group" aria-label="Preview an expression">{states.map(({ value, label }) => <button key={value} type="button" aria-pressed={!followLive && selection === value}
          onClick={() => { setFollowLive(false); setSelection(value); setTake((n) => n + 1); }}>{label}</button>)}</div>
        <div className="zarvis-studio-options"><label><input type="checkbox" checked={followLive} onChange={(event) => setFollowLive(event.target.checked)}/> Follow the live conversation</label></div>
        <p>{followLive ? "The comparison follows the real chat below." : "Expression previews only. These buttons do not send AI requests."}</p>
      </section>
      <section className="zarvis-iteration-grid" aria-label="Mascot iterations">
        <article className="zarvis-iteration-card"><header><span>01</span><h2>Avatar</h2><small>Previous</small></header>
          <div className="zarvis-iteration-stage"><ZarvisMark key={take} className="zarvis-iteration-before" expression={expression} animated paused={chat.motionPaused}/></div>
          <p>Portrait inside a circular frame.</p></article>
        <article className="zarvis-iteration-card zarvis-iteration-current"><header><span>02</span><h2>Free-standing</h2><small>8 poses</small></header>
          <div className="zarvis-iteration-stage"><ZarvisFigure expression={expression} paused={chat.motionPaused}/></div>
          <p>Soft breathing, independent gestures, smooth transitions.</p></article>
      </section>
    </details>
    <section className="zarvis-studio-live" aria-labelledby="zarvis-live-title">
      <header><div><p className="zarvis-studio-eyebrow">REAL INTERACTION</p><h2 id="zarvis-live-title">Talk to Zarvis</h2></div><span>{chat.status ? (chat.status.available ? "OpenAI connected" : "Chat unavailable") : "Checking connection…"}</span></header>
      <p>This is the real chat. Messages are sent to OpenAI and use the configured request limits.</p>
      <ZarvisChat compact/>
    </section>
  </div>;
}
