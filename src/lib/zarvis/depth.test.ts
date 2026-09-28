import { describe, expect, it } from "vitest";
import { answerPlan } from "./depth";
import { chatRequestSchema } from "./validation";
const ask = (content: string) => [{ role: "user" as const, content }];
describe("Bounded response depth", () => {
  it.each(["Analyze the fixed-budget hypothesis and limitations", "Compare as premissas e faça uma análise de sensibilidade"])("recognizes analytical intent: %s", (q) => {
    expect(answerPlan(ask(q))).toMatchObject({ depth: "deep", effort: "medium", analyze: true, timeoutMs: 110000 });
  });
  it("keeps simple lookups quick and honors explicit overrides", () => {
    expect(answerPlan(ask("Agora aplique um halving, mantendo as outras premissas.")).depth).toBe("quick");
    expect(answerPlan(ask("What is the ZEC price?"))).toMatchObject({ depth: "quick", effort: "low", analyze: false, timeoutMs: 55000 });
    expect(answerPlan(ask("Compare the treasury scenarios"), "quick")).toMatchObject({ depth: "quick", effort: "low", analyze: true });
    expect(answerPlan(ask("Explain ZIP 317"), "deep")).toMatchObject({ depth: "deep", effort: "high", analyze: true });
  });
  it("resolves a short acceptance without making unrelated later questions deep", () => {
    const history = [...ask("Analyze the assumptions"), { role: "assistant" as const, content: "I can compare the scenarios." }];
    expect(answerPlan([...history, ...ask("sim")]).depth).toBe("deep");
    expect(answerPlan([...history, ...ask("What is a zatoshi?")]).depth).toBe("quick");
  });
  it("accepts only named modes, never caller-controlled resource budgets", () => {
    expect(chatRequestSchema.safeParse({ messages: ask("hello"), depth: "deep" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ messages: ask("hello"), depth: "unlimited" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ messages: ask("hello"), timeoutMs: 999999 }).success).toBe(false);
  });
});
