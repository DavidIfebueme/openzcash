import type { ZarvisSession } from "./session";
import type { DirectLanguage } from "./language";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ZarvisSource = { title: string; url: string; retrievedAt?: string };
/** Where an answer came from: counts and labels only, never withheld text. `language` is the language of the deterministic parts and of the badge: English, Portuguese and Spanish templates exist, so an answer in any other language (`answerLanguage` "other") is labelled in English, the interface language. */
export type AnswerProvenance = { route: "local" | "model"; model: string | null; webSearch: boolean; groundingFallback: boolean; withheldFigures: number; language: DirectLanguage; xResearch?: boolean };
/** `delta` streams model text while no financial figures are being checked; `replace` always follows with the authoritative text (rendered citations, or the checked/repaired answer) and an empty `replace` clears a streamed tool preamble. */
export type ZarvisEvent =
  | { type: "session"; session: ZarvisSession }
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "done"; sources: ZarvisSource[]; provenance: AnswerProvenance; feedbackToken?: string }
  | { type: "error"; message: string };
/** Public provider names: the readiness endpoint, the badge fallback and the retention lookup all use them. */
export type ProviderLabel = "OpenAI" | "xAI (Grok)" | "Anthropic (Claude)";
export type ZarvisStatus = { available: boolean; provider: ProviderLabel; webSearch: boolean; voice?: boolean; xResearch?: boolean };

export type ZarvisExpression = "idle" | "listening" | "thinking" | "explaining" | "error" | "greeting" | "pleased" | "reading" | "exploring" | "protecting" | "comparing" | "uncertain" | "clarifying";
