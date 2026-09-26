import { z } from "zod";

import { MAX_BODY_BYTES, MAX_QUESTION_LENGTH, MAX_HISTORY_MESSAGES, MAX_HISTORY_CHARACTERS, MAX_MESSAGE_LENGTH } from "./context";
export { MAX_BODY_BYTES, MAX_QUESTION_LENGTH } from "./context";
export const chatRequestSchema = z.object({
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

/** Enforce the byte limit while reading, including requests without Content-Length. */
export async function readChatRequest(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("INVALID_REQUEST");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new Error("BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    return chatRequestSchema.parse(JSON.parse(text + decoder.decode()));
  } finally { reader.releaseLock(); }
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
