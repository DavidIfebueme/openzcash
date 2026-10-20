import { z } from "zod";
import { scenarioAssumptionsSchema } from "./scenario-input";
import type { ChatMessage } from "./types";
import { normalizeQuestion, requestedOutputLanguage } from "./language";

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
    const q = normalizeQuestion(message.content).replace(/^(?:please |por favor )/, "").replace(/(?: please| por favor)$/, "");
    const language = requestedOutputLanguage(q);
    if (language) result.language = language;
    if (/^(?:use|usar|usa|mostre em|muestra en|show amounts in) (usd|dollars|dolares)[.!]?$/.test(q)) result.currency = "USD";
    if (/^(?:use|usar|usa|mostre em|muestra en|show amounts in) (brl|reais|reales)[.!]?$/.test(q)) result.currency = "BRL";
    if (/^(?:use|usar|usa|mostre em|muestra en|show amounts in) (eur|euros)[.!]?$/.test(q)) result.currency = "EUR";
    if (/^(?:keep answers short|be brief|seja breve|respostas curtas|se breve|respuestas cortas)[.!]?$/.test(q)) result.detail = "brief";
    if (/^(?:give detailed answers|respostas detalhadas|respuestas detalladas)[.!]?$/.test(q)) result.detail = "detailed";
  }
  return result;
}
