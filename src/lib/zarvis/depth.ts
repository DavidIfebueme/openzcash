import type { ChatMessage } from "./types";
export type ResponseDepth = "auto" | "quick" | "deep";
const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Bounded, local intent routing. Explicit user selection always wins. */
export function answerPlan(messages: ChatMessage[], requested: ResponseDepth = "auto") {
  const latest = normalize(messages.findLast((m) => m.role === "user")?.content ?? "");
  const continuation = /^(?:yes|sim|continue|go on|prossiga|e depois|and then)[.!?\s]*$/.test(latest);
  const query = continuation ? messages.slice(-3).map((m) => normalize(m.content)).join(" ") : latest;
  const analytical = /\b(?:analy[sz]e|analysis|analise|analisar|insights?|trade.?offs?|sensitivity|sensibilidade|limitations?|limitacoes|implications?|implicacoes|compare|comparar|contradictions?|contradicoes)\b|attack assumptions|prove.*always|prova.*sempre/.test(query);
  const deep = requested === "deep" || (requested === "auto" && analytical);
  return { depth: deep ? "deep" as const : "quick" as const, analyze: analytical || requested === "deep",
    effort: requested === "deep" ? "high" as const : deep ? "medium" as const : "low" as const,
    timeoutMs: deep ? 110_000 : 55_000, providerTimeoutMs: deep ? 90_000 : 50_000,
    rounds: deep ? 4 : 3, lookups: deep ? 5 : 3, outputTokens: deep ? 6_000 : 3_000 };
}
export type AnswerPlan = ReturnType<typeof answerPlan>;
