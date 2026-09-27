import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes } from "mdast";
import type { Evidence } from "./local";

export type NumericFact = { value: number; unit: "USD" | "ZEC" | "%" };
/** Deliberately narrow guard: numeric/unit support, not semantic entailment of every sentence. */
export function numericFacts(evidence: Evidence[]): NumericFact[] {
  const facts: NumericFact[] = [];
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
  for (const item of evidence) { try { read(JSON.parse(item.content).data); } catch { /* no numeric evidence */ } }
  return facts;
}
function decimal(raw: string) {
  const token = raw.replace(/[\s\u00a0]/g, "");
  const lastDot = token.lastIndexOf("."), lastComma = token.lastIndexOf(",");
  let separator = "";
  if (lastDot >= 0 && lastComma >= 0) separator = lastDot > lastComma ? "." : ",";
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
export function unsupportedAmounts(answer: string, evidence: Evidence[]): string[] {
  const facts = numericFacts(evidence);
  const clean = visibleText(fromMarkdown(answer)).replace(/\u2212/g, "-");
  const claims = clean.matchAll(/(?:(US\$|R\$|\$|USD|BRL)\s*)?(-?\d[\d.,]*)(?:\s*(billion|bilhoes|bilhões|million|milhoes|milhões|thousand|mil|[kmb])(?![a-z]))?(?:\s*(USD|BRL|ZEC|%))?/gi);
  const unsupported: string[] = [];
  for (const match of claims) {
    const unit = match[1] ? (/R\$|BRL/i.test(match[1]) ? "BRL" : "USD") : match[4]?.toUpperCase();
    if (!unit) continue;
    const { value, decimals } = decimal(match[2]);
    const suffix = match[3]?.toLowerCase() ?? "";
    const scale = /^(b|billion|bilh)/.test(suffix) ? 1e9 : /^(m$|million|milh)/.test(suffix) ? 1e6 : /^(k|thousand|mil$)/.test(suffix) ? 1e3 : 1;
    const tolerance = 0.500001 * scale / 10 ** decimals;
    if (!facts.some((fact) => fact.unit === unit && Math.abs(fact.value - value * scale) <= tolerance)) unsupported.push(match[0]);
  }
  return unsupported;
}
export function isFinancialEvidence(evidence: Evidence[]) {
  return evidence.some((item) => { try { const data = JSON.parse(item.content).data; return !!(data?.quote || data?.filters || data?.funds || data?.company || /\/(api\/zec-price|zcg\/disbursements|zcg\/treasury-calculator)/.test(JSON.parse(item.content).sourceUrl ?? "")); } catch { return false; } });
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
