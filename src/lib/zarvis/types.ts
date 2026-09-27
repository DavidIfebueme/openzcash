import type { ZarvisSession } from "./session";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ZarvisSource = { title: string; url: string; retrievedAt?: string };
export type ZarvisEvent =
  | { type: "session"; session: ZarvisSession }
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "done"; sources: ZarvisSource[]; feedbackToken?: string }
  | { type: "error"; message: string };
export type ZarvisStatus = { available: boolean; provider: "OpenAI" | "xAI (Grok)"; webSearch: boolean };

export type ZarvisExpression = "idle" | "listening" | "thinking" | "explaining" | "error" | "greeting" | "pleased" | "reading" | "exploring" | "protecting";
