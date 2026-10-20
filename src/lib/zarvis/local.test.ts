import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), ledger: vi.fn() }));
vi.mock("./data", async (original) => ({ ...await original<object>(), lookupPublicData: mocks.lookup }));
vi.mock("./ledger", async (original) => ({ ...await original<object>(), queryLedger: mocks.ledger }));
vi.mock("./zips", async () => {
  const { bundledZipCorpus } = await import("./knowledge");
  return { getZipCorpus: vi.fn().mockResolvedValue({ corpus: bundledZipCorpus, stale: false }) };
});
import { getZipCorpus } from "./zips";
import { bundledZipCorpus } from "./knowledge";
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
  it.each(["What is ZEC price in BRL?", "Qual o preço do ZEC ontem?", "Qual o preço do ZEC e o saldo do ZCG?", "What is the ZEC price if it rises 20x?", "Qual o preço de comprar 5% de ZEC?", "Do not tell me the ZEC price", "Qual o Zcash?"])("preserves qualifications instead of taking a shortcut: %s", (q) => {
    expect(directIntent([user(q)])).toBeUndefined();
  });
  it("does not bypass earlier conversation constraints with a local template", () => {
    expect(directIntent([user("Responda em reais e em JSON"), answer("Certo."), user("Qual o preço do ZEC?")])).toBeUndefined();
    expect(directIntent([user("Answer in French"), answer("D'accord."), user("ZCG grant payments in 2025")])).toBeUndefined();
  });
  it.each(["¿Cuál es el precio del ZEC?", "¿Cuánto vale un ZEC?", "Precio del ZEC", "Cotización del ZEC, por favor"])("recognizes a plain Spanish quote: %s", (q) => expect(directIntent([user(q)])).toEqual({ type: "price" }));
  it("answers a Spanish quote in Spanish with the same figure, time and link, and a Spanish outage without a number", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-27T12:05:00Z") });
    try {
      const local = await prepareLocal([user("¿Cuál es el precio del ZEC?")], signal());
      expect(local.direct).toMatch(/^1 ZEC = \*\*USD\s100\.00\*\*\. Cotización del 27 sept 2026, 12:00 p\.m\. UTC\. \[Cotización de OpenZcash\]\(https:\/\/openzcash\.org\/api\/zec-price\)\.$/);
      expect(mocks.lookup).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
    mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: { quote: { usd: 100, stale: true, quotedAt: "2026-09-27T12:00:00Z" } } }) });
    expect((await prepareLocal([user("¿Cuánto vale un ZEC?")], signal())).direct).toMatch(/^No pude confirmar la cotización actual\. Última referencia guardada: \*\*USD\s100\.00 por ZEC\*\*/);
    mocks.lookup.mockResolvedValue({ content: JSON.stringify({ data: { quote: null } }) });
    const outage = (await prepareLocal([user("Precio del ZEC")], signal())).direct;
    expect(outage).toContain("La cotización en USD no está disponible"); expect(outage).not.toContain("1 ZEC =");
  });
  it("labels the Spanish ledger answer with the same metric, import date and scope", async () => {
    const result = await prepareLocal([user("¿Cuánto pagó ZCG en grants en 2025?")], signal());
    expect(result.direct).toMatch(/USD\s123,456\.78/); expect(result.direct).toContain("presupuestados"); expect(result.direct).toContain("coinholders"); expect(result.direct).toContain("Datos importados el 26 sept 2026");
    mocks.ledger.mockResolvedValue({ ...JSON.parse(result.evidence[0].content).data, paidEntriesMissingUsd: 3 });
    expect((await prepareLocal([user("¿Cuánto pagó ZCG en grants en 2025?")], signal())).direct).toContain("3 registros pagados no tienen valor en USD; el total es incompleto.");
    mocks.ledger.mockRejectedValue(new Error("Database unavailable"));
    expect((await prepareLocal([user("¿Cuánto pagó ZCG en 2025?")], signal())).direct).toContain("no está disponible en este momento. Eso no significa que el total sea cero.");
  });
  it("keeps the preceding Spanish for a bare year follow-up and honours a stored Spanish preference", async () => {
    expect((await prepareLocal([user("¿Cuánto pagó ZCG en grants en 2024?"), answer("Un total."), user("2025")], signal())).direct).toContain("En **2025**, el registro de ZCG");
    expect((await prepareLocal([user("ZCG grant payments in 2025")], signal(), { language: "es" })).direct).toContain("En **2025**, el registro de ZCG");
    expect((await prepareLocal([user("ZCG grant payments in 2025")], signal(), { language: "fr" })).direct).toBeUndefined();
  });
  it("answers Spanish courtesies and preferences in Spanish", async () => {
    expect((await prepareLocal([user("¡Hola!")], signal())).direct).toBe("¡Hola! Soy Zarvis. Puedo ayudarte con Zcash y los datos públicos de OpenZcash.");
    expect((await prepareLocal([user("Muchas gracias")], signal())).direct).toBe("¡De nada!");
    expect((await prepareLocal([user("Responde en español")], signal())).direct).toBe("Entendido. Responderé en español.");
    expect((await prepareLocal([user("Responde en inglés")], signal())).direct).toBe("Understood. I'll answer in English.");
    expect((await prepareLocal([user("Responde en portugués")], signal())).direct).toBe("Combinado. Vou responder em português.");
    expect((await prepareLocal([user("Usa dólares")], signal())).direct).toBe("Entendido. Usaré USD para los montos monetarios.");
    expect((await prepareLocal([user("Sé breve")], signal())).direct).toBe("Entendido. Mantendré las respuestas concisas.");
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("acknowledges \"Use dólares\" in Portuguese, because use/usar and dólares are Portuguese too", async () => {
    expect((await prepareLocal([user("Qual o preço do ZEC?"), answer("US$ 100"), user("Use dólares")], signal())).direct).toBe("Combinado. Vou usar USD para valores monetários.");
    expect((await prepareLocal([user("Use dólares")], signal())).direct).toBe("Combinado. Vou usar USD para valores monetários.");
    expect((await prepareLocal([user("Usar dólares")], signal())).direct).toBe("Combinado. Vou usar USD para valores monetários.");
    expect((await prepareLocal([user("Use USD")], signal())).direct).toBe("Understood. I'll use USD for monetary amounts.");
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
  it("keeps explicit ZIP explanations and short confirmations on internal evidence", async () => {
    const result = await prepareLocal([user("Explain ZIP 259"), answer("ZIP 259 is a draft about NU7. I can explain it."), user("sim")], signal());
    expect(result.external).toBe(false); expect(result.direct).toBeUndefined();
    expect(result.documents.some((d) => d.url.endsWith("zip-0259"))).toBe(true);
  });
  it("allows external verification when a requested ZIP is absent or current evidence is stale", async () => {
    expect((await prepareLocal([user("Explain ZIP 99999")], signal())).external).toBe(true);
    vi.mocked(getZipCorpus).mockResolvedValueOnce({ corpus: bundledZipCorpus, stale: true });
    const result = await prepareLocal([user("What is the latest ZIP?")], signal());
    expect(result.external).toBe(true); expect(result.direct).toBeUndefined();
    expect(JSON.parse(result.evidence[0].content).data.stale).toBe(true);
  });
  it("uses the fresh complete ZIP catalog before external research and caps automatic public lookups", async () => {
    const result = await prepareLocal([user("What is the latest ZIP?")], signal());
    expect(result.external).toBe(false); expect(result.direct).toContain("Created"); expect(result.evidence[0].content).toContain("official_zip_catalog"); expect(mocks.lookup).not.toHaveBeenCalled();
    await prepareLocal([user("Compare treasury balances, meetings, elections and grant recipients")], signal());
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });
});


it("reads current network measurements directly while keeping comparisons local", async () => {
  const current = await prepareLocal([user("Qual é o hashrate atual da rede Zcash? Cite a data e a janela.")], signal());
  expect(current.external).toBe(false); expect(current.direct).toContain("Não consegui confirmar");
  expect(mocks.lookup).toHaveBeenCalledWith({ topic: "mining", query: "" }, expect.any(AbortSignal));
  const methodology = await prepareLocal([user("O ZcashInfo e o ZecStats mostram hashrates diferentes. Como comparar corretamente?")], signal());
  expect(methodology.external).toBe(false);
  expect(methodology.documents.some(d => d.url.includes("zecstats.com"))).toBe(true);
});

it("keeps the person in short requests for more depth", () => {
  const query = retrievalQuestion([user("Quem é Zooko?"), answer("Zooko ajudou a criar o Zcash."), user("Conte mais.")]);
  expect(query).toContain("Zooko"); expect(query).toContain("Conte mais");
});


it("does not prefetch price data from a writing brief that excludes price predictions", async () => {
  const result = await prepareLocal([user("Write a 60-second Zcash opening for a skeptical Bitcoin audience at a conference. Be fair to Bitcoin, explain the practical privacy difference, and avoid price predictions.")], signal());
  expect(result.direct).toBeUndefined();
  expect(result.documents.some(doc => doc.id.startsWith("narratives:") && doc.pitchLength === "60s")).toBe(true);
  expect(mocks.lookup).not.toHaveBeenCalled();
});
