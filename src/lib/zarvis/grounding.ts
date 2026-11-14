import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes } from "mdast";
import type { Evidence } from "./local";
import { locale, pick, type DirectLanguage } from "./language";
import { LOCKBOX_START_HEIGHT, NU7_HEIGHT, THIRD_HALVING_HEIGHT, blockRewardsAt } from "@/lib/zcash/lockbox";

export type NumericFact = { value: number; unit: "USD" | "ZEC" | "%" };
type GuardDocument = { text: string };
/** Consensus constants the reviewed notes state: the guard only checks currency, ZEC and percent claims, so heights, seconds and block counts are listed for completeness but never flagged. */
const rewardFacts = (height: number): NumericFact[] => {
  const r = blockRewardsAt(height);
  return [r.subsidyZec, r.zcgZec, r.lockboxZec, r.minerZec].map((value) => ({ unit: "ZEC" as const, value }));
};
/** Per-block figures before NU7 (still true history) and since NU7 (ZIP 218: a third of each). */
export const PROTOCOL_FACTS: NumericFact[] = [
  { unit: "ZEC", value: 21_000_000 }, { unit: "ZEC", value: 1_050_000 }, { unit: "%", value: 5 },
  ...rewardFacts(NU7_HEIGHT - 1), ...rewardFacts(NU7_HEIGHT),
  { unit: "%", value: 8 }, { unit: "%", value: 12 }, { unit: "%", value: 20 }, { unit: "%", value: 80 }, { unit: "%", value: 25 }, { unit: "%", value: 100 },
];
export const PROTOCOL_CONSTANTS = { maxSupplyZec: 21_000_000, fivePercentOfMaxSupplyZec: 1_050_000, targetBlockSpacingSeconds: 25, halvingIntervalBlocks: 5_040_000, nu7Height: NU7_HEIGHT, lockboxStartHeight: LOCKBOX_START_HEIGHT, thirdHalvingHeight: THIRD_HALVING_HEIGHT };
/** Typed figures from tool evidence, the protocol constants and every unit-bearing number in the reviewed documents selected for the answer. Deliberately narrow: numeric/unit support, not semantic entailment of every sentence. */
export function numericFacts(evidence: Evidence[], documents: GuardDocument[] = []): NumericFact[] {
  const facts: NumericFact[] = [...PROTOCOL_FACTS];
  function read(value: unknown, key = "") {
    if (value && typeof value === "object") { for (const [name, item] of Object.entries(value)) read(item, name); return; }
    if (value === null || value === "" || typeof value === "boolean") return;
    const n = Number(value); if (!Number.isFinite(n)) return;
    if (/cents$/i.test(key)) facts.push({ unit: "USD", value: n / 100 });
    else if (/zat(?:oshis)?$/i.test(key)) facts.push({ unit: "ZEC", value: n / 1e8 });
    else if (/usd|^(?:cash|price)$/i.test(key)) facts.push({ unit: "USD", value: n });
    else if (/zec/i.test(key)) facts.push({ unit: "ZEC", value: n });
    else if (/percent/i.test(key)) facts.push({ unit: "%", value: n });
  }
  for (const item of evidence) {
    try {
      const data = JSON.parse(item.content).data;
      // Supply readings are diagnostic evidence; only reconciliation's selection can support a figure.
      if (data?.metric === "supply") {
        if (data.status !== "mismatch") read(data.selected);
      } else read(data);
    } catch { /* no numeric evidence */ }
  }
  for (const document of documents) for (const claim of amountClaims(document.text)) {
    if (claim.unit !== "BRL") for (const reading of claim.readings) facts.push({ unit: claim.unit, value: reading.value * claim.scale });
  }
  return facts;
}
/** Both readings of an ambiguous token: "3.396" is 3,396 (grouping) by default, but 3.396 before a scale word ("$3.396 million"); the other reading stays available in case it is the one the evidence supports. */
function readings(raw: string, scaled: boolean): Array<{ value: number; decimals: number }> {
  const token = raw.replace(/[\s\u00a0]/g, "");
  const single = token.match(/^(-?\d{1,3})[.,](\d{3})$/);
  const grouping = decimal(token), fraction = single ? { value: Number(`${single[1]}.${single[2]}`), decimals: 3 } : undefined;
  return fraction ? scaled ? [fraction, grouping] : [grouping, fraction] : [grouping];
}
function decimal(raw: string) {
  const token = raw.replace(/[\s\u00a0]/g, "");
  const lastDot = token.lastIndexOf("."), lastComma = token.lastIndexOf(",");
  let separator = "";
  // A leading zero is never a thousands group: "0.125" and "0,125" are fractions, not 125.
  if (/^-?0[.,]\d+$/.test(token)) separator = lastDot >= 0 ? "." : ",";
  else if (lastDot >= 0 && lastComma >= 0) separator = lastDot > lastComma ? "." : ",";
  else if (/[.,]\d{1,2}$/.test(token) || /[.,]\d{4,}$/.test(token)) separator = lastDot >= 0 ? "." : ",";
  const normalized = separator ? token.slice(0, token.lastIndexOf(separator)).replace(/[.,]/g, "") + "." + token.slice(token.lastIndexOf(separator) + 1) : token.replace(/[.,]/g, "");
  return { value: Number(normalized), decimals: separator ? token.length - token.lastIndexOf(separator) - 1 : 0 };
}
/** Check visible Markdown text, including link labels, escapes and decoded entities. */
function visibleText(node: Nodes): string {
  if (["html", "definition", "image", "imageReference"].includes(node.type)) return "";
  if (node.type === "break") return "\n";
  if ("children" in node) return node.children.map(visibleText).join("") + (["paragraph", "heading", "listItem"].includes(node.type) ? "\n" : "");
  return "value" in node ? node.value : "";
}
export type AmountClaim = { text: string; unit: "USD" | "BRL" | "ZEC" | "%"; scale: number; approximate: boolean; readings: Array<{ value: number; decimals: number }> };
// A number ends in a digit, so sentence punctuation is never read as a separator ("$1,593.38." is 1,593.38). An approximation word widens the tolerance to three significant digits.
const CLAIM = /(?:(about|roughly|approximately|around|nearly|almost|approx\.?|circa|cerca de|aproximadamente|quase|em torno de|por volta de|~)\s*)?(?:(US\$|R\$|\$|USD|BRL)\s*)?(-?\d(?:[\d.,]*\d)?)(?:\s*(billion|bilhoes|bilhões|million|milhoes|milhões|thousand|mil|[kmb])(?![a-z]))?(?:\s*(USD|BRL|ZEC|%))?/gi;
/** Every currency, ZEC or percent figure in the visible text, with the readings and tolerance the guard will apply. */
export function amountClaims(markdown: string): AmountClaim[] {
  const clean = visibleText(fromMarkdown(markdown)).replace(/\u2212/g, "-");
  const claims: AmountClaim[] = [];
  for (const match of clean.matchAll(CLAIM)) {
    const unit = match[2] ? (/R\$|BRL/i.test(match[2]) ? "BRL" : "USD") : match[5]?.toUpperCase() as "USD" | "BRL" | "ZEC" | "%" | undefined;
    if (!unit) continue;
    const suffix = match[4]?.toLowerCase() ?? "";
    const scale = /^(b|billion|bilh)/.test(suffix) ? 1e9 : /^(m$|million|milh)/.test(suffix) ? 1e6 : /^(k|thousand|mil$)/.test(suffix) ? 1e3 : 1;
    claims.push({ text: match[0], unit, scale, approximate: !!match[1], readings: readings(match[3], scale > 1) });
  }
  return claims;
}
/** A claim is supported when a fact, read at the claim's own precision, rounds to it; "about" also accepts rounding to three significant digits. Only an unscaled currency or ZEC figure may be an integer truncation of a cents/fraction value. */
function supports(fact: NumericFact, claim: AmountClaim): boolean {
  if (claim.unit === "BRL" || fact.unit !== claim.unit) return false;
  return claim.readings.some(({ value, decimals }) => {
    const stated = value * claim.scale;
    if (stated !== 0 && fact.value !== 0 && Math.sign(stated) !== Math.sign(fact.value)) return false;
    const step = claim.scale / 10 ** decimals;
    const magnitude = stated === 0 ? 0 : 10 ** (Math.floor(Math.log10(Math.abs(stated))) - 2);
    const slack = claim.approximate ? Math.max(step, magnitude) : step;
    const difference = Math.abs(fact.value) - Math.abs(stated);
    // Rounding puts the fact within half a step either way. Truncation (up to one step above) is only how "$1,592" states 1,592.80: a scaled or percent figure one step low ("$3.3M" for 3.39M, "37%" for 37.99%) is wrong, not truncated.
    const truncation = claim.scale === 1 && claim.unit !== "%" && !claim.approximate && !Number.isInteger(fact.value);
    return difference >= -0.5 * slack * (1 + 1e-9) && difference <= (truncation ? slack * (1 - 1e-9) : 0.5 * slack * (1 + 1e-9));
  });
}
/** Figures in the answer that no fact supports, for facts computed once per answer. */
export function unsupportedFigures(answer: string, facts: NumericFact[]): string[] {
  return amountClaims(answer).filter((claim) => !facts.some((fact) => supports(fact, claim))).map((claim) => claim.text);
}
export function unsupportedAmounts(answer: string, evidence: Evidence[], documents: GuardDocument[] = []): string[] {
  return unsupportedFigures(answer, numericFacts(evidence, documents));
}
/** The sentences whose figures all verified, or undefined when no dated or numeric sentence survives; never a sentence with a withheld figure. */
export function verifiedSentences(answer: string, facts: NumericFact[]): string | undefined {
  const lines = answer.split("\n").map((line) => line.split(/(?<=[.!?])\s+(?=[^a-z\s])/).filter((sentence) => !unsupportedFigures(sentence, facts).length).join(" "));
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text || unsupportedFigures(text, facts).length) return;
  return /(?:\$|US\$)\s*\d|\d\s*(?:%|ZEC|USD)\b|\b(?:19|20)\d{2}\b/i.test(text) ? text : undefined;
}
/** Money, treasury, grant and price questions are guarded before any evidence arrives, so a preamble guess is never streamed. */
export function isFinancialQuestion(query: string): boolean {
  const q = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return /\b(?:how much|quanto|price|preco|cotacao|cost|custa|worth|vale|treasur\w*|tesour\w*|balances?|saldos?|holdings?|lockbox|zcg|grants?|paid|pay|pays|paying|payments?|paga\w*|pagou|pagos?|pagamentos?|spent|gastou|gastos?|disburse\w*|desembols\w*|fund(?:ed|ing|s)?|financi\w*|fees?|taxas?|rewards?|recompensas?|salar\w*|earn\w*|ganh\w*|sold|sell|selling|vend\w*|bought|buy|buying|compr\w*|budget|orcamento|usd|dollars?|dolar\w*|brl|reais|revenue|receita|valuation|valor\w*|supply|oferta|scenario|cenario|halving|subsidy|subsidio|dev ?fund|coverage|cobertura|runway|market ?cap|volume)\b|\$|\b\d+\s*[x×]\b/.test(q);
}
export function isFinancialEvidence(evidence: Evidence[]) {
  return evidence.some((item) => { try { const data = JSON.parse(item.content).data; return !!(data?.kind === "crosslink_incentives" || data?.kind === "project_history" || data?.kind === "monthly_project_activity" || data?.metric === "supply" || data?.metric === "monthly_activity" || data?.metric === "monthly_comparison" || data?.quote || data?.filters || data?.funds || data?.company || /\/(api\/zec-price|zcg\/disbursements|zcg\/treasury-calculator)/.test(JSON.parse(item.content).sourceUrl ?? "")); } catch { return false; } });
}

/** Compare complete ledger populations only; never add excerpt rows or overlapping scopes. */
export function ledgerComparisonEvidence(evidence: Evidence[]): Evidence | undefined {
  const ledgers = evidence.flatMap((item) => { try { const data = JSON.parse(item.content).data; return data?.filters && data?.importedAt ? [data] : []; } catch { return []; } });
  if (ledgers.length !== 2) return;
  const [a, b] = ledgers.sort((x, y) => x.filters.year - y.filters.year);
  if (a.filters.year === null || b.filters.year === null || a.filters.year === b.filters.year || a.filters.scope !== b.filters.scope || a.filters.search !== b.filters.search || a.importedAt !== b.importedAt) return;
  if (a.paidEntriesMissingUsd || b.paidEntriesMissingUsd) return;
  const fromUsd = Number(a.budgetedUsdOfPaidEntries), toUsd = Number(b.budgetedUsdOfPaidEntries);
  if (![fromUsd, toUsd].every((n) => Number.isFinite(n) && Math.abs(n) < Number.MAX_SAFE_INTEGER / 100)) return;
  const differenceUsd = (Math.round(toUsd * 100) - Math.round(fromUsd * 100)) / 100;
  return { content: JSON.stringify({ data: { fromYear: a.filters.year, toYear: b.filters.year, scope: a.filters.scope, search: a.filters.search, fromUsd, toUsd, differenceUsd, absoluteDifferenceUsd: Math.abs(differenceUsd), changePercent: fromUsd > 0 ? differenceUsd / fromUsd * 100 : null, importedAt: a.importedAt, note: "Computed comparison of the same ledger population across payment years. Historical budget values of paid entries; not bank settlement. Percent change is undefined for a zero/negative starting value." } }) };
}

/** Keep verified arithmetic when a model answer fails the financial-figure guard. */
export function ledgerComparisonAnswer(evidence: Evidence[], lang: DirectLanguage): string | undefined {
  const comparison = ledgerComparisonEvidence(evidence);
  if (!comparison) return;
  const data = JSON.parse(comparison.content).data;
  const usd = new Intl.NumberFormat(locale(lang), { style: "currency", currency: "USD", signDisplay: "exceptZero" }).format(data.differenceUsd);
  const percent = data.changePercent === null ? pick(lang, { en: "percent change undefined", pt: "variação percentual indefinida", es: "variación porcentual indefinida" })
    : new Intl.NumberFormat(locale(lang), { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(data.changePercent / 100);
  return pick(lang, {
    en: `**${data.fromYear} → ${data.toYear}**: change of **${usd} (${percent})**, using the same ledger scope and import.`,
    pt: `**${data.fromYear} → ${data.toYear}**: variação de **${usd} (${percent})**, usando o mesmo escopo do registro e a mesma importação.`,
    es: `**${data.fromYear} → ${data.toYear}**: variación de **${usd} (${percent})**, usando el mismo alcance del registro y la misma importación.`,
  });
}
