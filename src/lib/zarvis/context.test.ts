import { describe, expect, it } from "vitest";
import { conversationContext, conversationKnowledge, MAX_BODY_BYTES, MAX_HISTORY_MESSAGES } from "./context";
import { chatRequestSchema } from "./validation";
import { selectKnowledge } from "./sources";
import type { ChatMessage } from "./types";

describe("Zarvis conversation continuity", () => {
  it("keeps the original subject after more than six short exchanges", () => {
    const history: ChatMessage[] = [{ role: "user", content: "Use 20% Dev Fund and a fixed annual budget for this scenario." }];
    for (let i = 0; i < 7; i++) history.push({ role: "assistant", content: `Scenario detail ${i}.` }, { role: "user", content: i === 6 ? "And if that doubles?" : `Explain detail ${i}.` });
    const context = conversationContext(history);
    expect(context).toEqual(history);
    expect(chatRequestSchema.safeParse({ messages: context }).success).toBe(true);
  });

  it("drops complete old turns instead of leaving an answer without its question", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "First question" }, { role: "assistant", content: "a".repeat(8_000) },
      { role: "user", content: "Second question" }, { role: "assistant", content: "b".repeat(8_000) },
      { role: "user", content: "Third question" }, { role: "assistant", content: "c".repeat(8_000) },
      { role: "user", content: "Explain the last answer." },
    ];
    const context = conversationContext(history);
    expect(context).toEqual(history.slice(2));
    expect(chatRequestSchema.safeParse({ messages: context }).success).toBe(true);
  });

  it("retains partial reply text so continue can refer to what the user actually saw", () => {
    const context = conversationContext([
      { role: "user", content: "Explain ZIP 316." },
      { role: "assistant", content: "A Unified Address combines receiver types.", incomplete: true },
      { role: "user", content: "Continue from there." },
    ]);
    expect(context).toHaveLength(3);
    expect(context[1].content).toContain("interrupted");
    expect(context[1].content).toContain("combines receiver types");
    expect(context[2].content).toBe("Continue from there.");
  });

  it("respects the actual UTF-8 request limit and the message-count limit", () => {
    const long: ChatMessage[] = Array.from({ length: 8 }, () => [
      { role: "user" as const, content: "More detail" },
      { role: "assistant" as const, content: "🔐".repeat(2_500) },
    ]).flat();
    long.push({ role: "user", content: "And then?" });
    const context = conversationContext(long);
    expect(new TextEncoder().encode(JSON.stringify({ messages: context })).byteLength).toBeLessThanOrEqual(MAX_BODY_BYTES);
    expect(chatRequestSchema.safeParse({ messages: context }).success).toBe(true);
    expect(context[0].role).toBe("user");
    const many: ChatMessage[] = Array.from({ length: 30 }, () => [
      { role: "user" as const, content: "A question" }, { role: "assistant" as const, content: "An answer" },
    ]).flat();
    many.push({ role: "user", content: "What about that?" });
    const recent = conversationContext(many);
    expect(recent.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(recent[0].role).toBe("user");
    expect(recent.at(-1)?.content).toBe("What about that?");
  });

  it("keeps short confirmations and uses subjects introduced in an assistant reply for grounding", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Which keys are involved?" },
      { role: "assistant", content: "An incoming viewing key and a full viewing key; I can explain the difference." },
      { role: "user", content: "yes" },
    ];
    expect(conversationContext(history)).toEqual(history);
    expect(selectKnowledge(conversationKnowledge(history)).map(note => note.id)).toContain("viewing-keys");
  });
});
