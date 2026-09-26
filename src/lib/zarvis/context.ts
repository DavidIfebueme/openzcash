import type { ChatMessage } from "./types";

export const MAX_BODY_BYTES = 32_768;
export const MAX_QUESTION_LENGTH = 2_000;
export const MAX_HISTORY_MESSAGES = 40;
export const MAX_HISTORY_CHARACTERS = 18_000;
export const MAX_MESSAGE_LENGTH = 8_000;
const partialNotice = "[This earlier response was interrupted. The following is partial text, not a completed answer.]\n";
const clippedNotice = "\n[Earlier response shortened for context.]";

/** Keep a contiguous recent conversation, without separating answers from their questions. */
export function conversationContext(history: (ChatMessage & { incomplete?: boolean })[]): ChatMessage[] {
  const turns: ChatMessage[][] = [];
  for (const message of history) {
    if (!message.content.trim()) continue;
    let content = `${message.role === "assistant" && message.incomplete ? partialNotice : ""}${message.content.trim()}`;
    if (content.length > MAX_MESSAGE_LENGTH) content = content.slice(0, MAX_MESSAGE_LENGTH - clippedNotice.length) + clippedNotice;
    const item = { role: message.role, content };
    if (item.role === "user") turns.push([item]);
    else turns.at(-1)?.push(item);
  }
  const encoder = new TextEncoder();
  let context: ChatMessage[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const candidate = [...turns[i], ...context];
    if (candidate.length > MAX_HISTORY_MESSAGES ||
      candidate.reduce((size, message) => size + message.content.length, 0) > MAX_HISTORY_CHARACTERS ||
      encoder.encode(JSON.stringify({ messages: candidate })).byteLength > MAX_BODY_BYTES) break;
    context = candidate;
  }
  return context;
}

/** A short follow-up can name its subject only in the preceding assistant reply. */
export function conversationKnowledge(messages: ChatMessage[]): string {
  return messages.slice(-8).map(({ content }) => content).join("\n");
}
