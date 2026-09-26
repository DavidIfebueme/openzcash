"use client";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { safeSourceUrl, STARTERS } from "@/lib/zarvis/sources";
import { MAX_QUESTION_LENGTH } from "@/lib/zarvis/validation";
import { useZarvis } from "./zarvis-provider";
import { ZarvisMark } from "./zarvis-mark";
import { ZarvisCompanion, ZarvisMotionToggle } from "./zarvis-companion";

export function ZarvisChat({ compact = false }: { compact?: boolean }) {
  const chat = useZarvis();
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const [copied, setCopied] = useState<string | null>(null);
  const empty = chat.messages.length === 0;
  const { checkStatus } = chat;
  useEffect(() => { checkStatus(); }, [checkStatus]);
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = chat.messages.length ? scroll.current.scrollHeight : 0;
  }, [chat.messages, chat.progress]);
  const submit = (question?: string) => { follow.current = true; void chat.send(question); input.current?.focus(); };
  const provider = chat.status?.provider ?? "the AI provider";
  return <section className={`zarvis-chat ${compact ? "zarvis-chat-compact" : ""}`} aria-label="Conversation with Zarvis">
    <div className="zarvis-chat-toolbar">
      <span className="zarvis-chat-name">Zarvis</span>
      <div className="zarvis-toolbar-actions">
      {!empty ? <ZarvisMotionToggle className="zarvis-motion zarvis-motion-toolbar"/> : null}
      <button type="button" onClick={() => { chat.clear(); input.current?.focus(); }} disabled={empty && !chat.draft} className="zarvis-text-button">＋ New chat</button>
      </div>
    </div>
    <div className="zarvis-messages" ref={scroll} onScroll={() => {
      const el = scroll.current!; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    }} tabIndex={0} aria-label="Conversation history">
      {empty ? <div className="zarvis-welcome">
        <ZarvisCompanion/>
        <h2>What would you like to know<br/>about Zcash?</h2>
        <div className="zarvis-starters">{STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => { chat.setDraft(starter.question); input.current?.focus(); }}>
          <span>{starter.label}</span>
        </button>)}</div>
      </div> : <div className="zarvis-thread">{chat.messages.map((message, index) => <article key={message.id} className={`zarvis-message zarvis-message-${message.role}`}>
        <div className="zarvis-message-label">{message.role === "assistant" ? <><ZarvisMark expression={index === chat.messages.length - 1 ? chat.expression : "idle"} animated={index === chat.messages.length - 1} paused={chat.motionPaused}/> Zarvis</> : "You"}</div>
        {message.content ? <div className="zarvis-prose"><Markdown skipHtml allowedElements={["p", "a", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "br", "hr"]} urlTransform={(url) => safeSourceUrl(url) ?? ""} components={{ a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span> }}>{message.content}</Markdown></div> : null}
        {message.role === "assistant" && message.content && !chat.busy && message.incomplete ? <small className="zarvis-incomplete">Incomplete response</small> : null}
        {message.sources?.length ? <details className="zarvis-answer-sources"><summary>{message.sources.length} source{message.sources.length === 1 ? "" : "s"} consulted</summary><ol>{message.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{source.retrievedAt ? <small>Retrieved {new Date(source.retrievedAt).toLocaleString()}</small> : null}</li>)}</ol></details> : null}
        {message.role === "assistant" && message.content && !message.incomplete ? <button className="zarvis-text-button zarvis-copy" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(message.content); setCopied(message.id); } catch { setCopied(null); }
        }}>{copied === message.id ? "Copied" : "Copy answer"}</button> : null}
      </article>)}</div>}
      {chat.busy ? <div className="zarvis-progress" role="status"><ZarvisMark expression={chat.expression} animated paused={chat.motionPaused}/>{chat.progress || "Writing an answer…"}</div> : null}
    </div>
    <div className="zarvis-compose-area">
      {chat.status && !chat.status.available ? <div className="zarvis-notice" role="status">Chat is not connected yet.<button type="button" className="zarvis-text-button" onClick={() => chat.checkStatus(true)}>Retry</button></div> : null}
      {chat.error ? <div className="zarvis-notice" role="alert">{chat.error}{chat.messages.some((m) => m.role === "user") && !chat.busy ? <button type="button" className="zarvis-text-button" onClick={() => { follow.current = true; void chat.send(undefined, true); }}>Retry</button> : null}</div> : null}
      <form className="zarvis-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor={compact ? "zarvis-dock-question" : "zarvis-question"}>Your question</label>
        <textarea ref={input} id={compact ? "zarvis-dock-question" : "zarvis-question"} value={chat.draft} onChange={(e) => chat.setDraft(e.target.value)} maxLength={MAX_QUESTION_LENGTH} rows={2} placeholder="Ask Zarvis about Zcash…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!chat.busy) submit(); } }}/>
        <div className="zarvis-composer-bottom"><span>{chat.draft.length > 1_600 ? `${chat.draft.length} / ${MAX_QUESTION_LENGTH}` : ""}</span>
          {chat.busy ? <button type="button" className="zarvis-send" onClick={chat.stop} aria-label="Stop response">■</button> : <button type="submit" className="zarvis-send" disabled={!chat.status?.available || !chat.draft.trim()} aria-label="Send question">↑</button>}
        </div>
      </form>
      <div className="zarvis-privacy"><span>Zarvis can make mistakes.</span><details><summary>Privacy &amp; data</summary><p>Messages are sent to {provider} to generate answers. OpenZcash keeps this conversation in browser memory; reloading clears it. Questions are not put in page URLs.</p><p>OpenAI response storage is disabled for this integration. Provider safety retention may still apply. <a href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noopener noreferrer">OpenAI’s data policy ↗</a></p><p>Never share recovery phrases, private keys or viewing keys. Hosting access logs and short-lived abuse counters are separate from the conversation.</p></details></div>
    </div>
  </section>;
}

export function ZarvisPage() {
  return <div className="zarvis-page"><h1 className="sr-only">Zarvis · Your Zcash guide</h1><ZarvisChat/></div>;
}
