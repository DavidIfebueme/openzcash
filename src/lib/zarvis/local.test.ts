import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), ledger: vi.fn() }));
vi.mock("./data", async (original) => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
vi.mock("./ledger", async (original) => ({ ...await original<object>(), queryLedger: mocks.ledger }));
import { directIntent, prepareLocal, retrievalQuestion, lookupLedger } from "./local";
import type { ChatMessage } from "./types";
const user = (content: string): ChatMessage => ({ role: "user", content });
const answer = (content: string): ChatMessage => ({ role: "assistant", content });
const signal = () => new AbortController().signal;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: { quote: { usd: 100, stale: false, quotedAt: "2026-09-27T12:00:00Z" } } }) });
  mocks.ledger.mockResolvedValue({ filters: { scope: "zcg_grants", year: 2025, search: "" }, paidEntries: 89, budgetedUsdOfPaidEntries: "123456.78", paidEntriesMissingUsd: 0, importedAt: "2026-09-26T12:00:00Z" });
});
describe("Precise local answers", () => {
  it.each(["Qual o preço do Zcash?", "Qual é o preço atual do ZEC?", "What is the current ZEC price?", "ZEC price", "Quanto custa o Zcash?"])("recognizes a plain quote: %s", (q) => {
    expect(directIntent([user(q)])).toEqual({ type: "price" });
  });
  it.each(["What is ZEC price in BRL?", "Qual o preço do ZEC ontem?", "Qual o preço do ZEC e o saldo do ZCG?", "What is the ZEC price if it rises 20x?", "Qual o preço de comprar 5% de ZEC?", "Do not tell me the ZEC price", "What is ZEC?", "Qual o Zcash?"])("preserves qualifications instead of taking a shortcut: %s", (q) => {
    expect(directIntent([user(q)])).toBeUndefined();
  });
  it("does not bypass earlier conversation constraints with a local template", () => {
    expect(directIntent([user("Responda em reais e em JSON"), answer("Certo."), user("Qual o preço do ZEC?")])).toBeUndefined();
    expect(directIntent([user("Answer in French"), answer("D'accord."), user("ZCG grant payments in 2025")])).toBeUndefined();
  });
  it("keeps source time and USD units in a local quote", async () => {
    const local = await prepareLocal([user("Qual o preço do ZEC?")], signal());
    expect(local.direct).toContain("100,00"); expect(local.direct).toContain("UTC"); expect(local.direct).toContain("/api/zec-price");
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  it.each([{ usd: 0, stale: false }, { usd: 100, stale: true }, null])("does not present an unavailable/stale quote as current: %j", async (quote) => {
    mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: { quote } }) });
    const text = (await prepareLocal([user("ZEC price")], signal())).direct;
    expect(text).toBeTruthy(); expect(text).not.toContain("1 ZEC =");
  });
  it("keeps scope across a year follow-up and stops doing so after a topic change", () => {
    const history = [user("Quanto o ZCG pagou em grants em 2024?"), answer("A dated total."), user("e em 2025?")];
    expect(directIntent(history)).toEqual({ type: "ledger", filters: { scope: "zcg_grants", year: 2025, search: "" } });
    expect(directIntent([...history, answer("A total."), user("Explique o halving"), answer("Issuance halves."), user("e em 2026?")])).toBeUndefined();
  });
  it("labels the paid grant metric, import date, scope and incomplete USD amounts", async () => {
    const result = await prepareLocal([user("Quanto o ZCG pagou em grants em 2025?")], signal());
    expect(result.direct).toContain("123.456,78"); expect(result.direct).toContain("orçados"); expect(result.direct).toContain("coinholders");
    mocks.ledger.mockResolvedValue({ ...JSON.parse(result.evidence[0].content).data, paidEntriesMissingUsd: 3 });
    expect((await prepareLocal([user("Quanto o ZCG pagou em grants em 2025?")], signal())).direct).toContain("total é incompleto");
  });
  it("does not turn a failed ledger read into zero", async () => {
    mocks.ledger.mockRejectedValue(new Error("Database unavailable"));
    const result = await prepareLocal([user("Quanto o ZCG pagou em grants em 2025?")], signal());
    expect(result.direct).toContain("indisponível"); expect(result.evidence[0].content).toContain("Do not report a zero");
  });
  it("validates program/year/search before any aggregate read", async () => {
    for (const filters of [{ scope: "private_wallet", year: 2025, search: "" }, { scope: "zcg_grants", year: "2025 OR 1=1", search: "" }, { scope: "zcg_grants", year: null, search: "", sql: "drop table" }]) {
      expect((await lookupLedger(filters, signal())).content).toContain("Unsupported");
    }
    expect(mocks.ledger).not.toHaveBeenCalled();
  });
  it("retrieves the previous offer for yes without letting old topics override a new subject", () => {
    const history = [user("What is the latest ZIP?"), answer("I can check its activation status."), user("yes")];
    expect(retrievalQuestion(history)).toContain("activation status");
    expect(retrievalQuestion([...history, answer("Dated source."), user("Explain wallet viewing keys")])).toBe("Explain wallet viewing keys");
  });
  it("does not prefetch irrelevant excerpts when a full payment aggregate is needed", async () => {
    await prepareLocal([user("Quanto foi pago em grants ao Zingo em 2025?")], signal());
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("keeps the preceding language for a bare year follow-up", async () => {
    const result = await prepareLocal([user("ZCG grant payments in 2024"), answer("A dated total."), user("2025")], signal());
    expect(result.direct).toContain("In **2025**");
  });
  it("checks current ZIPs externally after local retrieval and caps automatic public lookups", async () => {
    const result = await prepareLocal([user("What is the latest ZIP?")], signal());
    expect(result.external).toBe(true); expect(mocks.lookup).not.toHaveBeenCalled();
    await prepareLocal([user("Compare treasury balances, meetings, elections and grant recipients")], signal());
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });
});
