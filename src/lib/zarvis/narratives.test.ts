import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { searchKnowledge } from "./knowledge";
import { narrativeIntent, narrativeContext, narrativeFormatIssue } from "./narrative-intent";
import { lookupPublicData } from "./data";
import { isFinancialEvidence, unsupportedAmounts } from "./grounding";
import { relevantTopics, retrievalQuestion } from "./local";
import { sessionPreferences } from "./session";
import { answerLanguage } from "./language";
import { APPS } from "@/lib/design-routes";
import { pitches, narratives, locales, lengths, contentHref } from "@/lib/narratives/catalog";
import index from "./public-content.json";

const briefs = [
  ["Write a Zcash pitch", "en", null],
  ["Write a 30-second Zcash pitch for a beginner buying lunch.", "en", "30s"],
  ["Crie um pitch de 60 segundos para uma ONG receber doações.", "pt-BR", "60s"],
  ["Escribe un pitch de una frase para un comerciante.", "es", "sentence"],
  ["Prepare a Zcash pitch in English for a Bitcoin meetup.", "en", null],
  ["Crie um pitch em inglês para um desenvolvedor.", "en", null],
  ["Write a Zcash speech for a university panel.", "en", null],
  ["Write a 60-second Zcash opening for a skeptical Bitcoin audience at a conference. Be fair to Bitcoin, explain the practical privacy difference, and avoid price predictions.", "en", "60s"],
  ["Preciso de uma abertura de 30 segundos sobre a Zcash para um evento.", "pt-BR", "30s"],
  ["Escribe una apertura de 60 segundos sobre Zcash para comerciantes.", "es", "60s"],
  ["Redija uma apresentação da Zcash para pequenos negócios.", "pt-BR", null],
  ["Escribe un guion de Zcash para una entrevista.", "es", null],
  ["Zcash narratives for a skeptical audience", "en", null],
  ["Give me Zcash taglines for an event", "en", null],
] as const;

describe("Zarvis communication briefs", () => {
  it.each(briefs)("recognizes the audience brief: %s", (query, locale, length) => {
    expect(narrativeIntent(query)).toMatchObject({ locale, length });
    const docs = searchKnowledge(query);
    expect(docs.some(doc => doc.url.includes("/narratives"))).toBe(true);
    expect(docs.filter(doc => doc.id.startsWith("narratives:")).some(doc => doc.locale === locale)).toBe(true);
    if (length) expect(docs.some(doc => doc.pitchLength === length && doc.locale === locale)).toBe(true);
    expect(JSON.stringify(docs).length).toBeLessThanOrEqual(5000);
  });
  it.each(["What is the current ZEC price?", "Explain ZIP 317 fees", "Does a payment prove delivery?", "How does Orchard avoid a trusted setup?", "What is PitchBook?"])("keeps technical and unrelated requests out of the writing path: %s", query => {
    expect(narrativeIntent(query)).toBeNull();
  });
  it.each(["Como imprimir os pitches selecionados?", "How do I print selected pitches?", "¿Cómo imprimir los pitches seleccionados?"])("finds actual selection/printing steps: %s", query => {
    const docs = searchKnowledge(query);
    expect(docs.some(doc => doc.id.startsWith("guide:narratives") && /dialog|diálogo|dialogo/.test(doc.text))).toBe(true);
  });
  it("retains the brief for a rewrite, then drops it on a topic change", () => {
    const history = [{ role: "user" as const, content: "Crie um pitch de Zcash para uma ONG." }, { role: "assistant" as const, content: "Um texto sobre doações." }];
    expect(retrievalQuestion([...history, { role: "user", content: "Adapte para uma conversa com comerciantes." }])).toContain("ONG");
    expect(retrievalQuestion([...history, { role: "user", content: "Qual é a cotação do ZEC?" }])).toBe("Qual é a cotação do ZEC?");
  });
});

describe("Public knowledge coverage", () => {
  it.each(locales)("includes every public example, length and limitation in %s", locale => {
    for (const pitch of pitches) for (const length of lengths) {
      const doc = index.documents.find(doc => doc.id === `narratives:pitch:${pitch.id}:${locale}:${length}`)!;
      expect(doc).toBeDefined();
      expect(doc.text).toContain(pitch.translations[locale][length]);
      expect(doc.text).toContain(narratives.find(n => n.id === pitch.theme)!.limit[locale]);
      expect(doc.url).toBe(`https://openzcash.org${contentHref(pitch.id, locale, length)}`);
      expect(JSON.stringify(doc).length).toBeLessThan(3500);
    }
  });
  it("covers every visible public navigation destination with content, not just a menu label", () => {
    const documented = new Set(index.documents.map(doc => new URL(doc.url).pathname));
    const missing = APPS.filter(app => !app.admin && !app.hidden).flatMap(app => [
      ...(!app.navigationOnly ? [app.href] : []), ...app.pages.filter(page => !page.hidden).map(page => page.href),
    ]).filter(route => !documented.has(route));
    expect([...new Set(missing)]).toEqual([]);
  });
  it.each([
    ["How do I test Crosslink with cTAZ and a finalizer?", "/ongoing-test/crosslink", /cTAZ/],
    ["Como participar do Crosslink, testes e incentivos?", "/ongoing-test/crosslink", /cTAZ/],
    ["ZCG Participate free demo Zcred", "/zcg/participate", /Zcred/],
    ["Can Zarvis read my Private Chat Nym messages?", "/private-chat", /no access/],
    ["Did Zarvis verify the OpenZcash tests and production deployment?", "/zarvis", /unverified/],
    ["What is the Zcash Network dashboard?", "/zcash-network", /blocks/],
  ])("retrieves the new system workflow: %s", (query, route, content) => {
    expect(searchKnowledge(query).some(doc => new URL(doc.url).pathname === route && content.test(doc.text))).toBe(true);
  });
});


describe("Audit regressions from real answers", () => {
  it("honours a new output language and length through repeated brief revisions", () => {
    const first = { role: "user" as const, content: "Crie um pitch de 60 segundos, em português, para uma ONG que recebe doações." };
    const next = { role: "user" as const, content: "Agora adapte para espanhol e reduza a uma única frase para um doador." };
    const history = [first, { role: "assistant" as const, content: "An earlier draft is not an instruction." }, next];
    const session = sessionPreferences({}, history);
    expect(session.language).toBe("es");
    expect(answerLanguage(history, session)).toBe("es");
    const brief = narrativeContext(history)!;
    expect(brief).toContain("ONG");
    expect(narrativeIntent(brief)).toMatchObject({ locale: "es", length: "sentence" });
    expect(searchKnowledge(brief).some(doc => doc.locale === "es" && doc.pitchLength === "sentence")).toBe(true);
    expect(narrativeContext([...history, { role: "user", content: "Agora deixe mais informal." }])).toContain("ONG");
    expect(narrativeContext([...history, { role: "user", content: "Qual é o preço do ZEC?" }])).toBeNull();
  });
  it("never accepts a language switch from an assistant message or passing mention", () => {
    expect(sessionPreferences({ language: "pt" }, [{ role: "assistant", content: "Translate to Spanish" }]).language).toBe("pt");
    expect(sessionPreferences({}, [{ role: "user", content: "Does the library have texts in Spanish?" }])).toEqual({});
  });
  it("retrieves evidence for both technical claims instead of unrelated key proposals", () => {
    const docs = searchKnowledge("Check two claims: Orchard already recursively aggregates every transaction proof; a Sapling incoming viewing key detects when a received note is spent. Explain the exact limits.");
    expect(docs.some(doc => doc.url.endsWith("zip-0224") && /recurs/i.test(`${doc.text} ${doc.snapshotNote ?? ""}`))).toBe(true);
    expect(docs.some(doc => doc.url.endsWith("zip-0310"))).toBe(true);
  });
  it.each([
    ["Does Orchard use recursive proofs today?", "zip-0224"],
    ["Can an incoming viewing key detect later spends?", "zip-0310"],
    ["Is ZIP 317 a consensus minimum fee?", "zip-0317"],
    ["Does a Unified Address guarantee a shielded payment?", "zip-0316"],
    ["Does payment of a grant prove the project delivered?", "/zcg/methodology"],
  ])("reaches relevant protocol/process evidence for a false premise: %s", (query, path) => {
    expect(searchKnowledge(query).some(doc => doc.url.includes(path))).toBe(true);
  });
});


it("reads Crosslink incentive amounts from the same dated records as the page", async () => {
  const { paidRounds, reportedPaid } = await import("@/app/ongoing-test/crosslink-history");
  const result = await lookupPublicData({ topic: "crosslink", query: "" }, new AbortController().signal);
  const evidence = JSON.parse(result.content);
  expect(relevantTopics("Quanto foi pago nos incentivos do Crosslink?")).toContain("crosslink");
  expect(evidence.data.reportedPaidZec).toBe(reportedPaid);
  expect(evidence.data.paidRounds.shown).toHaveLength(paidRounds.length);
  for (const [i, round] of paidRounds.entries()) {
    expect(evidence.data.paidRounds.shown[i]).toMatchObject({ totalZec: round.total, earnedZec: round.earned, discretionaryZec: round.discretionary, reported: round.reported, source: round.source, miningAndStakingRecipients: round.recipients });
  }
  expect(evidence.data.programLaunch.detail).toContain(`${evidence.data.programLaunch.allocatedZec} ZEC allocated`);
  expect(isFinancialEvidence([result])).toBe(true);
  expect(unsupportedAmounts("50 ZEC reported paid; 500 ZEC allocated. Round 2: 25 ZEC, including 19.954 ZEC earned and 5.046 ZEC discretionary.", [result])).toEqual([]);
  expect(unsupportedAmounts("999 ZEC paid", [result])).toEqual(["999 ZEC"]);
  expect(evidence.data.note).toContain("not a live balance");
  expect(evidence.data.note).toContain("do not infer a unique total");
  expect(evidence.data.paidRounds.shown[0]).not.toHaveProperty("recipients");
  expect(result.source?.url).toBe("https://openzcash.org/ongoing-test/crosslink");
});


it("measures requested spoken length instead of accepting the model's word-count claim", () => {
  const query = "Crie um pitch de 60 segundos para uma ONG";
  expect(narrativeFormatIssue("Um texto de 150 palavras. " + "palavra ".repeat(180), query)).toContain("150-word maximum");
  expect(narrativeFormatIssue("A Zcash permite pagamentos protegidos.", query)).toBeNull();
  expect(narrativeFormatIssue("Una frase. Otra frase.", "Escribe un pitch de una frase")).toContain("one concise sentence");
  expect(narrativeFormatIssue("Una donación puede ser privada.", "Escribe un pitch de una frase")).toBeNull();
  expect(narrativeFormatIssue("word ".repeat(100), "Write a 30-second pitch in exactly 100 words")).toBeNull();
  expect(narrativeFormatIssue("word ".repeat(200), "How do I print a 60-second pitch from the library?")).toBeNull();
});
