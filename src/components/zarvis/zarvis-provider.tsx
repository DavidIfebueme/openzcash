"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ZarvisEvent, ZarvisExpression, ZarvisSource, ZarvisStatus } from "@/lib/zarvis/types";
import { MAX_QUESTION_LENGTH } from "@/lib/zarvis/validation";

export type DisplayMessage = {
  id: string; role: "user" | "assistant"; content: string;
  sources?: ZarvisSource[]; incomplete?: boolean;
};
type ChatState = {
  messages: DisplayMessage[]; draft: string; setDraft: (value: string) => void;
  motionPaused: boolean; toggleMotion: () => void;
  busy: boolean; expression: ZarvisExpression; progress: string; error: string | null; status: ZarvisStatus | null;
  send: (question?: string, retry?: boolean) => void;
  stop: () => void; clear: () => void; checkStatus: (force?: boolean) => void;
};
const Context = createContext<ChatState | null>(null);
export function useZarvis() {
  const context = useContext(Context);
  if (!context) throw new Error("Zarvis provider missing");
  return context;
}

export function ZarvisProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [pleased, setPleased] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const pleasedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ZarvisStatus | null>(null);
  const active = useRef<AbortController | null>(null);
  const statusChecked = useRef(false);
  const checkStatus = useCallback((force = false) => {
    if (statusChecked.current && !force) return;
    statusChecked.current = true;
    fetch("/api/zarvis", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    }).catch(() => {
      statusChecked.current = false;
      setError("Zarvis is temporarily unavailable. Please try again shortly.");
    });
  }, []);
  useEffect(() => {
    const visibility = () => setPageHidden(document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      active.current?.abort();
      if (pleasedTimer.current) clearTimeout(pleasedTimer.current);
    };
  }, []);

  function clear() {
    active.current?.abort(); active.current = null;
    setMessages([]); setDraft(""); setError(null); setBusy(false); setReplying(false); setPleased(false); setProgress("");
    if (pleasedTimer.current) clearTimeout(pleasedTimer.current);
    statusChecked.current = false; checkStatus();
  }
  function stop() { active.current?.abort(); }
  async function send(question?: string, retry = false) {
    if (active.current || !status?.available) return;
    const questionText = (question ?? draft).trim();
    if (!retry && (!questionText || questionText.length > MAX_QUESTION_LENGTH)) return;
    let history = messages.filter((m) => !m.incomplete);
    if (retry) {
      const lastUser = messages.findLastIndex((m) => m.role === "user");
      if (lastUser < 0) return;
      history = messages.slice(0, lastUser + 1).filter((m) => !m.incomplete);
    } else {
      history = [...history, { id: crypto.randomUUID(), role: "user", content: questionText }];
    }
    // Keep complete recent turns within the server's context budget.
    let budget = 0;
    const context = history.slice(-12).map((m) => ({ ...m, content: m.content.slice(0, 8_000) })).reverse().filter((m) => {
      budget += m.content.length;
      return budget <= 18_000;
    }).reverse();
    while (context[0]?.role === "assistant") context.shift();
    const id = crypto.randomUUID();
    const controller = new AbortController(); active.current = controller;
    setMessages([...history, { id, role: "assistant", content: "", incomplete: true }]);
    if (pleasedTimer.current) clearTimeout(pleasedTimer.current);
    setPleased(false); setDraft(""); setBusy(true); setReplying(false); setError(null); setProgress("Reading your question…");
    let completed = false;
    const update = (patch: Partial<DisplayMessage>) => setMessages((all) => all.map((m) => m.id === id ? { ...m, ...patch } : m));
    try {
      const response = await fetch("/api/zarvis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: context.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Zarvis could not respond. Please try again.");
      }
      if (!response.body) throw new Error("The connection ended. Please retry.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder(); let buffer = ""; let text = "";
      const receive = (line: string) => {
        if (!line.trim()) return;
        const event: ZarvisEvent = JSON.parse(line);
        if (event.type === "status") { setProgress(event.message); setReplying(false); }
        if (event.type === "delta") { setReplying(true); setProgress("Writing an answer…"); text += event.text; update({ content: text }); }
        if (event.type === "replace") { text = event.text; update({ content: text }); }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") {
          completed = true; update({ sources: event.sources, incomplete: false });
          setPleased(true);
          pleasedTimer.current = setTimeout(() => setPleased(false), 1800);
        }
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (active.current !== controller) return;
          if (done) { buffer += decoder.decode(); if (buffer) receive(buffer); break; }
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 100_000) throw new Error("The response was too large. Please retry.");
          const lines = buffer.split("\n"); buffer = lines.pop()!;
          lines.forEach(receive);
        }
      } finally { reader.releaseLock(); }
      if (!completed) throw new Error("The connection ended before the answer was complete. Please retry.");
    } catch (e) {
      if (active.current !== controller) return;
      setError(controller.signal.aborted ? "Response stopped. You can retry or ask another question." : e instanceof Error ? e.message : "Zarvis could not respond. Please retry.");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); setProgress(""); }
    }
  }
  // Expressions follow actual chat events; completed answers are not verification badges.
  const expression: ZarvisExpression = busy ? (replying ? "explaining" : "thinking")
    : error ? "error" : draft.trim() ? "listening" : pleased ? "pleased" : "idle";
  return <Context.Provider value={{ messages, draft, setDraft, busy, expression, motionPaused: motionPaused || pageHidden, toggleMotion: () => setMotionPaused((paused) => !paused), progress, error, status, send, stop, clear, checkStatus }}>{children}</Context.Provider>;
}
