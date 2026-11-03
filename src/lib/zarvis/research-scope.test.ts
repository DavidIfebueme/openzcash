import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { researchScope, needsMiningResearch } from "./research-scope";
import { searchKnowledge } from "./knowledge";
import { safeSourceUrl } from "./sources";
import { directIntent } from "./direct-intent";
import { faqAnswer } from "./direct-faq";
const user = (content: string) => ({ role: "user" as const, content });

describe("Sources match the question's subject", () => {
  it.each(["Quem é Zooko?", "Who is Zooko Wilcox?", "Conte a biografia de Zooko"])("retrieves an actual biography and site history for %s", (query) => {
    const docs = searchKnowledge(query);
    expect(docs.some(d => d.url.endsWith("/ceremony/road"))).toBe(true);
    expect(docs.some(d => d.url.endsWith("/ceremony/people"))).toBe(true);
    expect(docs.some(d => d.id === "zooko-background")).toBe(true);
    expect(docs.every(d => !d.id.startsWith("reference:zip-"))).toBe(true);
    expect(JSON.stringify(docs)).toContain("DigiCash");
    expect(JSON.stringify(docs)).toContain("December 2023");
    expect(JSON.stringify(docs)).not.toContain("Two days later, in the same thread, he");
    expect(JSON.stringify(docs)).toContain("Chief Product Officer");
    expect(JSON.stringify(docs)).toContain("Identity publicly disclosed");
    expect(JSON.stringify(docs).length).toBeLessThanOrEqual(5000);
  });
  it.each(["Who is Edward Snowden?", "Quem foi David Chaum?", "Who was Hal Finney?"])("also retrieves history for other people: %s", (query) => {
    const docs = searchKnowledge(query);
    expect(docs.some(d => d.url.includes("/ceremony/"))).toBe(true);
    expect(docs[0].id).not.toMatch(/^reference:zip-/);
  });
  it("keeps explicit ZIP questions scoped to the actual specification", () => {
    expect(researchScope("O que Zooko propôs no ZIP 234?")).toBe("zip");
    expect(searchKnowledge("O que Zooko propôs no ZIP 234?")[0].url).toContain("zip-0234");
  });
  it("does not mistake shielded value pools for mining pools", () => {
    expect(researchScope("What is the Orchard shielded pool balance?")).toBe("general");
    expect(researchScope("Who is Zooko?")).toBe("history");
    expect(researchScope("ZcashInfo and ZecStats hashrates")).toBe("mining");
  });
  it("routes funding, governance and news questions to their own five-domain lists", () => {
    for (const q of ["How is the Dev Fund split after NU6.1?", "Quem vota nas propostas do ZCG?", "What did the coinholder poll decide?"]) expect(researchScope(q)).toBe("governance");
    for (const q of ["Latest Zcash news", "Quais as notícias do Zcash esta semana?", "Zebra release announcement"]) expect(researchScope(q)).toBe("news");
    expect(researchScope("What is a Unified Address?")).toBe("general");
  });
  it.each(["Mining pool shares over the last 24 hours", "Hashrate in 2020"])("requests fresh research for changing mining facts: %s", query => {
    expect(needsMiningResearch(query)).toBe(true);
    expect(directIntent([user(query)])).toBeUndefined();
  });
  it.each(["Qual é o hashrate atual do Zcash?", "What is Zcash network hashrate?", "Qual é o hashrate atual da rede Zcash? Cite a fonte, a data e a janela de medição."])("uses the validated public snapshot for a plain current reading: %s", query => {
    expect(directIntent([user(query)])).toEqual({ type: "mining" });
  });
  it("retrieves both independent methodologies without claiming live readings", () => {
    const docs = searchKnowledge("ZcashInfo and ZecStats show different hashrates");
    expect(docs.some(d => d.url.startsWith("https://zcashinfo.com/"))).toBe(true);
    expect(docs.some(d => d.url.startsWith("https://zecstats.com/"))).toBe(true);
    expect(JSON.stringify(docs)).toContain("observation");
  });
  it("allows the reviewed sources but blocks lookalike and credential-bearing URLs", () => {
    for (const url of ["https://zcashinfo.com/pools/", "https://zecstats.com/chart/hashrate"]) expect(safeSourceUrl(url)).toBe(url);
    for (const url of ["https://zcashinfo.com.evil.org", "https://zecstats.com@evil.org", "http://zecstats.com", "https://user@zcashinfo.com/", "https://zecstats.com:8443/"]) expect(safeSourceUrl(url)).toBeNull();
  });
  it("can cite current builders and their repositories without admitting lookalike hosts or unrelated GitHub owners", () => {
    for (const url of ["https://zakura.com/announcements/", "https://zodl.com/about/", "https://zcashlabs.org/", "https://tachyon.z.cash/", "https://valargroup.dev/", "https://qed-it.com/", "https://github.com/zakura-core/zakura", "https://github.com/tachyon-zcash/ragu", "https://github.com/zcashlabs/"]) expect(safeSourceUrl(url)).toBe(url);
    for (const url of ["https://zakura.com.attacker.test/", "https://zcashlabs.org@attacker.test/", "https://github.com/zakura-core-fake/zakura"]) expect(safeSourceUrl(url)).toBeNull();
  });
  it.each([
    ["What is solrate?", "hashrate"], ["O que é hashrate?", "hashrate"],
    ["What is a mining pool?", "mining_pool"], ["O que é um pool de mineração?", "mining_pool"],
    ["Does mining pool share mean ZEC ownership?", "pool_ownership"],
    ["Where can I find Zcash mining data?", "mining_sources"],
    ["Por que ZcashInfo e ZecStats mostram hashrates diferentes?", "mining_comparison"],
    ["O ZcashInfo e o ZecStats mostram hashrates diferentes. Isso significa que um está errado? Como comparar os dois corretamente?", "mining_comparison"],
    ["ZcashInfo and ZecStats show different hashrates. Does that mean one is wrong? How do I compare them correctly?", "mining_comparison"],
  ] as const)("uses reviewed facts only for the complete simple question: %s", (q, id) => {
    expect(directIntent([user(q)])).toEqual({ type: "faq", id });
    expect(faqAnswer(id, "pt").text).toMatch(/https:\/\/(?:zcashinfo|zecstats)\.com/);
    expect(faqAnswer(id, "es").text).toMatch(/https:\/\/(?:zcashinfo|zecstats)\.com/);
  });
  it.each(["What is hashrate and calculate my profit at 5 cents per kWh?", "Qual é o hashrate atual?", "Compare today's hashrates on ZecStats and ZcashInfo", "ZcashInfo and ZecStats show different hashrates; calculate today's difference", "Who is Zooko and what is his current job?"])("retains analysis and current-fact requirements: %s", q => {
    expect(directIntent([user(q)])).toBeUndefined();
  });
});
