import { z } from "zod";
import { scenarioAssumptionsSchema } from "./scenario-input";
import type { ChatMessage } from "./types";

export const sessionSchema = z.object({
  language: z.enum(["en", "pt", "es", "fr"]).optional(),
  currency: z.enum(["USD", "BRL", "EUR"]).optional(),
  detail: z.enum(["brief", "detailed"]).optional(),
  scenario: scenarioAssumptionsSchema.optional(),
}).strict();
export type ZarvisSession = z.infer<typeof sessionSchema>;

/** Capture explicit preferences, not summaries invented by a model. Browser-memory only. */
export function sessionPreferences(previous: ZarvisSession = {}, messages: ChatMessage[]): ZarvisSession {
  const result = { ...sessionSchema.parse(previous) };
  for (const message of messages) {
    if (message.role !== "user") continue;
    const q = message.content.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[.!?,]/g, "").replace(/\s+/g, " ").trim().replace(/^(?:please |por favor )/, "").replace(/(?: please| por favor)$/, "");
    const language = q.match(/^(?:please )?(?:answer|reply|respond|responda|responde)(?: to me)? (?:in|em) (english|ingles|portuguese|portugues|spanish|espanhol|french|frances)[.!]?$/);
    if (language) result.language = ({ english: "en", ingles: "en", portuguese: "pt", portugues: "pt", spanish: "es", espanhol: "es", french: "fr", frances: "fr" } as const)[language[1] as "english"];
    if (/^(?:use|usar|mostre em|show amounts in) (usd|dollars|dolares)[.!]?$/.test(q)) result.currency = "USD";
    if (/^(?:use|usar|mostre em|show amounts in) (brl|reais)[.!]?$/.test(q)) result.currency = "BRL";
    if (/^(?:use|usar|mostre em|show amounts in) (eur|euros)[.!]?$/.test(q)) result.currency = "EUR";
    if (/^(?:keep answers short|be brief|seja breve|respostas curtas)[.!]?$/.test(q)) result.detail = "brief";
    if (/^(?:give detailed answers|respostas detalhadas)[.!]?$/.test(q)) result.detail = "detailed";
  }
  return result;
}
