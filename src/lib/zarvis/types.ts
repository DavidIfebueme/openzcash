export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ZarvisSource = { title: string; url: string; retrievedAt?: string };
export type ZarvisEvent =
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "done"; sources: ZarvisSource[] }
  | { type: "error"; message: string };
export type ZarvisStatus = { available: boolean; provider: "OpenAI"; webSearch: boolean };
