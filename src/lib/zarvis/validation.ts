import { z } from "zod";
import { sessionSchema } from "./session";
import { readBoundedJson } from "./request-body";

import { MAX_BODY_BYTES, MAX_QUESTION_LENGTH, MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARACTERS, MAX_MESSAGE_LENGTH } from "./context";
export { MAX_BODY_BYTES, MAX_QUESTION_LENGTH } from "./context";
export const chatRequestSchema = z.object({
  session: sessionSchema.optional(),
  depth: z.enum(["auto", "quick", "deep"]).optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  }).strict()).min(1).max(MAX_HISTORY_MESSAGES),
}).strict().superRefine(({ messages }, ctx) => {
  const last = messages.at(-1)!;
  if (last.role !== "user" || last.content.length > MAX_QUESTION_LENGTH)
    ctx.addIssue({ code: "custom", message: "End with a question of up to 2,000 characters." });
  if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_HISTORY_CHARACTERS)
    ctx.addIssue({ code: "custom", message: "Start a new conversation to continue." });
});

/** Enforce byte and read-time limits before validating chat roles and history. */
export async function readChatRequest(request: Request) {
  return chatRequestSchema.parse(await readBoundedJson(request, MAX_BODY_BYTES));
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const incoming = new URL(origin);
    // Next can expose its internal listener URL behind Railway's TLS proxy.
    // Pin the production origin instead of trusting forwarded host headers.
    const target = new URL(process.env.ZARVIS_ORIGIN || (process.env.NODE_ENV === "production"
      ? "https://openzcash.org"
      : request.url));
    return origin === incoming.origin && incoming.origin === target.origin &&
      request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
}
