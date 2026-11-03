"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeSourceUrl, STARTERS } from "@/lib/zarvis/sources";
import { fallbackNotice, provenanceLabel, retrievedLabel } from "@/lib/zarvis/provenance";
import { MAX_QUESTION_LENGTH } from "@/lib/zarvis/context";
import { answerClipboard, questionLink, sharedQuestion, withoutSharedQuestion } from "@/lib/zarvis/share";
import { FEEDBACK_REASONS, type FeedbackReason } from "@/lib/zarvis/feedback";
import { PROVIDER_RETENTION, providerRetention } from "@/lib/zarvis/retention";
import type { AnswerProvenance } from "@/lib/zarvis/types";
import { MAX_RECORDING_SECONDS, clockLabel, mergeTranscript } from "@/lib/zarvis/voice-client";
import { portugueseBrowser, useZarvis, type DisplayMessage } from "./zarvis-provider";
import { ZarvisFigure } from "./zarvis-figure";
import { ZarvisWordmark } from "./zarvis-wordmark";
import { ZarvisDepthSelect } from "./zarvis-depth-select";
import { ZarvisCompanion, ZarvisMotionToggle } from "./zarvis-companion";
import { useVoiceInput, type VoiceInput } from "./use-voice-input";

function answerHref(href: string) {
  // Scenario links stay on this deployment, including a local preview. Ordinary citations keep their canonical source.
  try { const url = new URL(href); if (url.hostname === "openzcash.org" && url.pathname === "/zcg/treasury-calculator" && url.searchParams.get("zarvis") === "1") return url.pathname + url.search; } catch { /* invalid links are filtered before rendering */ }
  return href;
}
// A static note, not a live region: the notice arrives together with its text, which screen readers would not announce as a status anyway.
const notice = (p: AnswerProvenance) => { const text = fallbackNotice(p); return text ? <span className="zarvis-provenance-notice" role="note">{text}</span> : null; };
const retrieved = (iso?: string) => { const text = iso ? retrievedLabel(iso) : undefined; return text ? <small>{text}</small> : null; };
/** Answer text as Markdown: GFM tables for comparisons, links only to allowlisted sources, no raw HTML. */
export function AnswerMarkdown({ children }: { children: string }) {
  return <Markdown skipHtml remarkPlugins={[remarkGfm]} allowedElements={["p", "a", "strong", "em", "del", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "br", "hr", "table", "thead", "tbody", "tr", "th", "td"]} urlTransform={(url) => safeSourceUrl(url) ?? ""} components={{ a: ({ href, children }) => href ? <a href={answerHref(href)} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span> }}>{children}</Markdown>;
}
const MicIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="5.5" y="1.75" width="5" height="8" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2"/></svg>;
/** Takes the textarea's place while dictating: live loudness and the clock, or the wait for the transcript. */
function VoiceStrip({ voice }: { voice: VoiceInput }) {
  const busy = voice.phase === "transcribing";
  return <div className="zarvis-voice-strip" data-busy={busy || undefined}>
    {busy ? <span className="zarvis-voice-label"><span className="zarvis-voice-spinner" aria-hidden="true"/>Transcribing…</span>
      : <><span className="zarvis-voice-dot" aria-hidden="true"/><span className="zarvis-voice-time">{clockLabel(voice.seconds)} <small>/ {clockLabel(MAX_RECORDING_SECONDS)}</small></span></>}
    <span className="zarvis-voice-bars" aria-hidden="true">{voice.levels.map((level, i) => <i key={i} style={{ transform: `scaleY(${(0.1 + level * 0.9).toFixed(3)})` }}/>)}</span>
  </div>;
}

export function ZarvisChat({ compact = false }: { compact?: boolean }) {
  const chat = useZarvis();
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "unhelpful" | "sending" | "error" | "reason">>({});
  const sendFeedback = async (message: DisplayMessage, helpful: boolean, reason?: FeedbackReason) => {
    setFeedback((all) => ({ ...all, [message.id]: "sending" }));
    try {
      const result = await fetch("/api/zarvis/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: message.feedbackToken, helpful, ...(reason ? { reason } : {}) }) });
      if (!result.ok) throw new Error();
      setFeedback((all) => ({ ...all, [message.id]: helpful ? "helpful" : "unhelpful" }));
    } catch { setFeedback((all) => ({ ...all, [message.id]: "error" })); }
  };
  // Browser language is read after hydration; the server render stays English.
  const pt = useSyncExternalStore(() => () => {}, portugueseBrowser, () => false);
  const waiting = chat.retryAt !== null;
  const empty = chat.messages.length === 0;
  const { checkStatus } = chat;
  useEffect(() => { checkStatus(); }, [checkStatus]);
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = chat.messages.length ? scroll.current.scrollHeight : 0;
  }, [chat.messages, chat.progress]);
  const submit = (question?: string) => { follow.current = true; void chat.send(question); input.current?.focus(); };
  // Dictation fills the composer; the visitor reviews the text and sends it as usual.
  const { setDraft } = chat;
  const latestDraft = useRef(chat.draft);
  useEffect(() => { latestDraft.current = chat.draft; }, [chat.draft]);
  const voice = useVoiceInput(useCallback((text: string) => {
    const next = mergeTranscript(latestDraft.current, text);
    latestDraft.current = next; setDraft(next);
    // On a phone the keyboard would cover the answer area; the send button is already in reach.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    requestAnimationFrame(() => { const field = input.current; if (field) { field.focus(); field.setSelectionRange(next.length, next.length); } });
  }, [setDraft]));
  const dictating = voice.phase === "recording" || voice.phase === "transcribing";
  // Closing the dock must not leave the microphone on behind it.
  const section = useRef<HTMLElement>(null);
  const { cancel: cancelVoice } = voice;
  useEffect(() => {
    const dock = section.current?.closest("dialog");
    dock?.addEventListener("close", cancelVoice);
    return () => dock?.removeEventListener("close", cancelVoice);
  }, [cancelVoice]);
  const canDictate = voice.supported && Boolean(chat.status?.voice);
  const provider = chat.status?.provider ?? "the AI provider";
  // The policy link follows the provider the readiness endpoint reports; the OpenAI entry stands in until that status has loaded.
  const retention = providerRetention(chat.status?.provider) ?? PROVIDER_RETENTION.OpenAI;
  // Empty state: the mascot and title sit above the composer, the starters below it, all centred as one group.
  return <section ref={section} className={`zarvis-chat ${compact ? "zarvis-chat-compact" : ""}`} data-empty={empty || undefined} aria-label="Conversation with Zarvis">
    <div className="zarvis-chat-toolbar">
      <ZarvisWordmark className="zarvis-chat-name"/>
      <div className="zarvis-toolbar-actions">
      <ZarvisMotionToggle className="zarvis-motion zarvis-motion-toolbar"/>
      <button type="button" onClick={() => { chat.clear(); input.current?.focus(); }} disabled={empty && !chat.draft} className="zarvis-text-button">＋ New chat</button>
      </div>
    </div>
    <div className="zarvis-messages" ref={scroll} onScroll={() => {
      const el = scroll.current!; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    }} tabIndex={empty ? undefined : 0} role={empty ? undefined : "region"} aria-label={empty ? undefined : "Conversation history"}>
      {empty ? <div className="zarvis-welcome">
        <ZarvisCompanion/>
        <h2>What would you like to know about Zcash?</h2>
      </div> : <div className="zarvis-thread">{chat.messages.map((message, index) => <article key={message.id} className={`zarvis-message zarvis-message-${message.role}`} aria-label={message.role === "assistant" ? "Zarvis response" : "Your message"}>
        {message.role === "assistant" ? <ZarvisFigure className="zarvis-answer-figure"
          expression={index === chat.messages.length - 1 && chat.expression !== "idle" ? chat.expression : message.pose ?? "explaining"}
          animated={index === chat.messages.length - 1} paused={chat.motionPaused} settled={!chat.busy && !message.incomplete}/> : null}
        <div className="zarvis-message-body">
        {message.role === "assistant" && index === chat.messages.length - 1 && chat.busy ? <div className="zarvis-message-heading">
          <div className="zarvis-progress" role="status">{chat.progress || "Writing an answer…"}</div>
        </div> : null}
        {message.content ? <div className="zarvis-prose"><AnswerMarkdown>{message.content}</AnswerMarkdown></div> : null}
        {message.role === "assistant" && message.content && !chat.busy && message.incomplete ? <small className="zarvis-incomplete">Incomplete response</small> : null}
        {message.role === "assistant" && message.provenance && !message.incomplete ? <div className="zarvis-provenance">
          <span className={`zarvis-provenance-badge zarvis-provenance-${message.provenance.route}`}>{provenanceLabel(message.provenance, message.sources?.length ?? 0, chat.status?.provider)}</span>
          {notice(message.provenance)}
        </div> : null}
        {message.sources?.length ? <details className="zarvis-answer-sources"><summary>{message.sources.length} source{message.sources.length === 1 ? "" : "s"} consulted</summary><ol>{message.sources.map((source) => <li key={source.url}><a href={answerHref(source.url)} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>{retrieved(source.retrievedAt)}</li>)}</ol></details> : null}
        {message.role === "assistant" && message.content && !message.incomplete ? <span className="zarvis-share">
          <button className="zarvis-text-button zarvis-copy" type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(message.content); setCopied(`${message.id}:text`); } catch { setCopied(null); }
          }}>{copied === `${message.id}:text` ? "Copied" : "Copy answer"}</button>
          <button className="zarvis-text-button zarvis-copy" type="button" onClick={async () => {
            const question = chat.messages.slice(0, index).findLast((m) => m.role === "user")?.content;
            try { await navigator.clipboard.writeText(answerClipboard({ question, content: message.content, sources: message.sources, provenance: message.provenance, provider: chat.status?.provider, askedAt: new Date().toISOString() })); setCopied(`${message.id}:sources`); } catch { setCopied(null); }
          }}>{copied === `${message.id}:sources` ? "Copied with sources" : "Copy with sources"}</button>
          {(() => { const question = chat.messages.slice(0, index).findLast((m) => m.role === "user")?.content ?? ""; const link = questionLink(question, typeof window === "undefined" ? undefined : `${window.location.origin}/zarvis`); return link ? <button className="zarvis-text-button zarvis-copy" type="button" title="A link that opens Zarvis with this question ready to send" onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(`${message.id}:link`); } catch { setCopied(null); }
          }}>{copied === `${message.id}:link` ? "Link copied" : "Copy question link"}</button> : null; })()}
        </span> : null}
        {message.feedbackToken && !message.incomplete ? <span className="zarvis-feedback" aria-label="Rate this answer">
          {feedback[message.id] === "helpful" || feedback[message.id] === "unhelpful" ? <small>Thanks for your feedback</small>
          : feedback[message.id] === "reason" ? <span className="zarvis-feedback-reasons" role="group" aria-label="What needs work?">
            <small>What needs work?</small>
            {FEEDBACK_REASONS.map((reason) => <button key={reason.id} className="zarvis-text-button" type="button" onClick={() => void sendFeedback(message, false, reason.id)}>{reason.label}</button>)}
            <button className="zarvis-text-button" type="button" onClick={() => void sendFeedback(message, false)}>Skip</button>
          </span> : <>
            <button className="zarvis-text-button" type="button" disabled={feedback[message.id] === "sending"} aria-label="Helpful answer" onClick={() => void sendFeedback(message, true)}>Useful</button>
            <button className="zarvis-text-button" type="button" disabled={feedback[message.id] === "sending"} aria-label="Unhelpful answer" onClick={() => setFeedback((all) => ({ ...all, [message.id]: "reason" }))}>Needs work</button>
            {feedback[message.id] === "error" ? <small role="status">Feedback unavailable</small> : null}
          </>}
        </span> : null}
        </div>
      </article>)}</div>}
    </div>
    <div className="zarvis-compose-area">
      {chat.status && !chat.status.available ? <div className="zarvis-notice" role="status">Chat is not connected yet.<button type="button" className="zarvis-text-button" onClick={() => chat.checkStatus(true)}>Retry</button></div> : null}
      {chat.degraded && chat.status?.available ? <div className="zarvis-notice" role="status">{pt ? "Zarvis está com problemas. Algumas respostas podem falhar; as fontes públicas continuam disponíveis." : "Zarvis is having trouble. Some answers may fail; the public sources remain available."}</div> : null}
      {voice.error ? <div className="zarvis-notice" role="alert">{voice.error}{voice.retryable ? <button type="button" className="zarvis-text-button" onClick={voice.start}>Try again</button> : null}</div> : null}
      {chat.error ? <div className="zarvis-notice" role="alert">{chat.error}{chat.messages.some((m) => m.role === "user") && !chat.busy ? <button type="button" className="zarvis-text-button" disabled={waiting} onClick={() => { follow.current = true; void chat.send(undefined, true); }}>Retry</button> : null}</div> : null}
      <form className="zarvis-composer" data-dictating={dictating || undefined} onSubmit={(e) => { e.preventDefault(); if (!dictating) submit(); }}>
        <label className="sr-only" htmlFor={compact ? "zarvis-dock-question" : "zarvis-question"}>Your question</label>
        {dictating ? <VoiceStrip voice={voice}/> : <textarea ref={input} id={compact ? "zarvis-dock-question" : "zarvis-question"} value={chat.draft} onChange={(e) => { chat.setDraft(e.target.value); if (voice.error) voice.dismiss(); }} maxLength={MAX_QUESTION_LENGTH} rows={2} placeholder="Ask Zarvis about Zcash, in any language…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!chat.busy) submit(); } }}/>}
        <div className="zarvis-composer-bottom"><div className="zarvis-depth-control">
          <ZarvisDepthSelect value={chat.depth} disabled={chat.busy} onChange={chat.setDepth}/>
          <span className="zarvis-character-count">{chat.draft.length > 1_600 ? `${chat.draft.length} / ${MAX_QUESTION_LENGTH}` : ""}</span></div>
          <div className="zarvis-composer-actions">
          {dictating || voice.phase === "starting" ? <button type="button" className="zarvis-text-button" onClick={voice.cancel}>Cancel</button> : null}
          {voice.phase === "recording" ? <button type="button" className="zarvis-voice-stop" onClick={voice.stop} aria-label="Stop and transcribe" title="Stop and transcribe">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2"/></svg>
          </button> : <>
          {canDictate ? <button type="button" className="zarvis-mic" onClick={voice.start} disabled={!chat.status?.available || chat.busy || voice.phase !== "idle"} aria-busy={voice.phase === "starting" || undefined} aria-label="Dictate a question" title="Dictate a question"><MicIcon/></button> : null}
          {chat.busy ? <button type="button" className="zarvis-stop" onClick={chat.stop} aria-label="Stop response" title="Stop response">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>
          </button> : <button type="submit" className="zarvis-send" disabled={!chat.status?.available || !chat.draft.trim() || waiting || dictating} aria-label="Send question">↑</button>}
          </>}
          </div>
        </div>
      </form>
      {dictating ? <p className="zarvis-voice-note">Your recording is sent to ElevenLabs to turn it into text. OpenZcash keeps no audio.</p> : null}
      <span className="sr-only" aria-live="polite">{voice.phase === "recording" ? "Recording. Use Stop and transcribe when you finish." : voice.phase === "transcribing" ? "Transcribing your question." : ""}</span>
      {empty ? <>
        <div className="zarvis-starters">{STARTERS.map((starter) => <button key={starter.label} type="button" title={starter.question} disabled={dictating} onClick={() => { chat.setDraft(starter.question); input.current?.focus(); }}>
          {starter.label}
        </button>)}</div>
        <p className="zarvis-welcome-note">Answers in Portuguese, Spanish, English and more, with sources. <a href="/zarvis/about">How Zarvis works →</a></p>
      </> : null}
    </div>
      <div className="zarvis-privacy"><span>Zarvis can make mistakes.</span><details onToggle={(e) => { if (e.currentTarget.open) e.currentTarget.scrollIntoView({ block: "nearest" }); }}><summary>Privacy &amp; data</summary><p>Simple data lookups can be answered by OpenZcash. When AI is needed, recent messages and relevant public data are sent to {provider}. OpenZcash keeps this conversation in browser memory; reloading clears it. Zarvis never writes your question into the page address; a link you copy with “Copy question link” carries that one question, and opening it only fills the composer. Shared calculator links contain only scenario assumptions. Feedback sends your rating, and for “Needs work” an optional reason from a fixed list, without the conversation text.</p>{chat.status?.voice ? <p>With the microphone, your recording goes to ElevenLabs to become text, and the text lands in the composer for you to check. OpenZcash keeps no audio. <a href="https://elevenlabs.io/privacy-policy" target="_blank" rel="noopener noreferrer">ElevenLabs privacy policy ↗</a></p> : null}<p>{retention.api === "Responses API" ? "Provider response storage is disabled for this integration. " : ""}Provider retention policies may still apply. <a href={retention.url} target="_blank" rel="noopener noreferrer">Provider data policy ↗</a></p>{chat.status?.xResearch ? <p>Research on X uses xAI with a predefined Zcash topic, without sending your question or conversation history to that search service. Public results may be cached for 30 minutes. <a href={PROVIDER_RETENTION["xAI (Grok)"].url} target="_blank" rel="noopener noreferrer">xAI data policy ↗</a></p> : null}<p>Never share recovery phrases, private keys or viewing keys. Hosting access logs and short-lived abuse counters are separate from the conversation. <a href="/zarvis/about">About Zarvis: routes, limits, retention, incidents</a></p></details></div>
  </section>;
}

/** A shared link (/zarvis?q=…) fills the composer once and leaves the address bar; nothing is sent until the visitor decides. */
function SharedQuestion() {
  const { setDraft } = useZarvis();
  useEffect(() => {
    const question = sharedQuestion(window.location.search);
    if (!question) return;
    setDraft(question);
    window.history.replaceState(window.history.state, "", withoutSharedQuestion(window.location.href));
    document.getElementById("zarvis-question")?.focus();
  }, [setDraft]);
  return null;
}
export function ZarvisPage() {
  return <div className="zarvis-page"><h1 className="sr-only">Zarvis · Your Zcash guide</h1><SharedQuestion/><ZarvisChat/></div>;
}
