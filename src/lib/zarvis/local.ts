import "server-only";
import { lookupPublicData, lookupSchema } from "./data";
import { queryLedger, ledgerQuerySchema, type LedgerQuery, type LedgerSummary } from "./ledger";
import { searchKnowledge } from "./knowledge";
import { boundedRead } from "./timeout";
import type { ChatMessage, ZarvisSource } from "./types";

export type Evidence = { content: string; source?: ZarvisSource };
export type LocalPlan = { query: string; documents: ReturnType<typeof searchKnowledge>; evidence: Evidence[]; direct?: string; external: boolean };
type Intent = { type: "price" } | { type: "ledger"; filters: LedgerQuery };
export const normalizeQuestion = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[?!.,]/g, "").replace(/\s+/g, " ").trim();

/** Only complete, unambiguous grammars bypass the model. Added qualifiers must fall through. */
export function directIntent(messages: ChatMessage[]): Intent | undefined {
  const latest = messages.at(-1);
  if (latest?.role !== "user") return;
  const q = normalizeQuestion(latest.content);
  if (messages.length === 1 && /^(?:(?:qual (?:e )?(?:o )?(?:preco|cotacao) (?:atual )?d[oa] |quanto (?:esta|custa) (?:o )?)(?:zec|zcash)(?: (?:hoje|agora|em usd|em dolar|em dolares))?|(?:what is|what's|whats) (?:the )?(?:current )?(?:zec|zcash) (?:price|usd price)(?: (?:today|now|in usd))?|(?:zec|zcash) (?:price|preco|cotacao)(?: (?:today|now|hoje|agora))?)$/.test(q)) return { type: "price" };
  const year = q.match(/\b(20\d{2})\b/);
  if (messages.length === 1 && year && /^(?:(?:quanto (?:o )?zcg pagou em (?:grants|marcos)(?: em)?|how much did zcg pay in grants in|zcg (?:paid grants|grant payments) (?:in|for)) 20\d{2})$/.test(q)) {
    return { type: "ledger", filters: { scope: "zcg_grants", year: Number(year[1]), search: "" } };
  }
  if (year && /^(?:(?:and|e)(?: (?:in|em))? )?20\d{2}$/.test(q)) {
    const precedingUser = messages.slice(0, -1).findLastIndex((m) => m.role === "user");
    if (precedingUser >= 0) {
      const prior = directIntent(messages.slice(0, precedingUser + 1));
      if (prior?.type === "ledger") return { type: "ledger", filters: { ...prior.filters, year: Number(year[1]) } };
    }
  }
}

/** Retrieve for the latest topic; short replies can refer to the preceding answer/offer. */
export function retrievalQuestion(messages: ChatMessage[]): string {
  const latest = messages.at(-1)?.content ?? "";
  if (latest.length <= 70 && /^(?:yes|sim|ok|sure|please|continue|pode|isso|e\b|and\b|what about\b|how about\b|explain(?: (?:that|it|more))?$|explique(?: (?:isso|mais))?$|por que\b|why\b)/i.test(latest.trim())) {
    return `${messages.slice(-3, -1).map((m) => m.content.slice(0, 900)).join("\n")}\n${latest}`;
  }
  return latest;
}
function portuguese(messages: ChatMessage[]): boolean {
  const last = normalizeQuestion(messages.at(-1)?.content ?? "");
  if (/\b(?:qual|quanto|preco|cotacao|hoje|agora|em|e|sim|explique|pagou)\b/.test(last)) return true;
  if (/\b(?:what|how|price|today|and|yes|in|for)\b/.test(last)) return false;
  for (const message of messages.slice(0, -1).reverse()) {
    if (message.role !== "user") continue;
    const previous = normalizeQuestion(message.content);
    if (/\b(?:what|how|price|today|and|yes|in|for)\b/.test(previous)) return false;
    if (/\b(?:qual|quanto|preco|cotacao|pagou|em|sim)\b/.test(previous)) return true;
  }
  return false;
}
function date(value: string, pt: boolean): string {
  return new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}
function priceAnswer(evidence: Evidence, pt: boolean): string | undefined {
  try {
    const parsed = JSON.parse(evidence.content);
    const quote = parsed.data?.quote;
    if (!quote || !(quote.usd > 0) || !Number.isFinite(quote.usd) || quote.stale || !Number.isFinite(Date.parse(quote.quotedAt))) return;
    const usd = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(quote.usd);
    return pt
      ? `1 ZEC = **${usd}**. Cotação de ${date(quote.quotedAt, pt)}. [Cotação do OpenZcash](https://openzcash.org/api/zec-price).`
      : `1 ZEC = **${usd}**. Quoted ${date(quote.quotedAt, pt)}. [OpenZcash price feed](https://openzcash.org/api/zec-price).`;
  } catch { return; }
}
function ledgerAnswer(data: LedgerSummary, pt: boolean): string | undefined {
  if (data.filters.scope !== "zcg_grants" || data.filters.search || data.filters.year === null || !data.importedAt) return;
  const value = Number(data.budgetedUsdOfPaidEntries);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) return;
  const usd = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(value);
  const caveat = data.paidEntriesMissingUsd ? (pt ? ` ${data.paidEntriesMissingUsd} registros pagos não têm valor USD; o total é incompleto.` : ` ${data.paidEntriesMissingUsd} paid entries have no USD amount; this total is incomplete.`) : "";
  return pt
    ? `Em **${data.filters.year}**, o registro do ZCG soma **${usd}** em valores orçados de **${data.paidEntries} registros de grants marcados como pagos**.${caveat}\n\nO filtro usa a data de pagamento e exclui registros sem data. Não inclui grants dos coinholders nem planilhas operacionais separadas; não é a cotação atual dos ZEC. Dados importados em ${date(data.importedAt, pt)}. [Pagamentos do ZCG](https://openzcash.org/zcg/disbursements).`
    : `In **${data.filters.year}**, the ZCG ledger records **${usd}** in budgeted values for **${data.paidEntries} grant entries marked paid**.${caveat}\n\nThis uses payment dates and excludes undated entries. It excludes coinholder grants and separate operational worksheets; it is not today's ZEC valuation. Data imported ${date(data.importedAt, pt)}. [ZCG payments](https://openzcash.org/zcg/disbursements).`;
}
export async function lookupLedger(args: unknown, signal: AbortSignal): Promise<Evidence> {
  const url = "https://openzcash.org/zcg/disbursements";
  const parsed = ledgerQuerySchema.safeParse(args);
  if (!parsed.success) return { content: JSON.stringify({ error: "Unsupported ledger filters." }) };
  try {
    signal.throwIfAborted();
    const data = await boundedRead(() => queryLedger(parsed.data), signal);
    signal.throwIfAborted();
    const retrievedAt = new Date().toISOString();
    return { content: JSON.stringify({ sourceUrl: url, retrievedAt, data }), source: { title: "OpenZcash · ZCG payment ledger", url, retrievedAt } };
  } catch { signal.throwIfAborted(); return { content: JSON.stringify({ sourceUrl: url, error: "Ledger data unavailable. Do not report a zero total." }) }; }
}

export function relevantTopics(query: string): Array<typeof lookupSchema._output.topic> {
  const q = normalizeQuestion(query);
  // A payment total needs the complete ledger tool, not large ecosystem/grant excerpts.
  if (/\b(?:paid|payments|pagou|pagos?|pagamentos|gastos|gastou)\b/.test(q) && /\b(?:grants?|zcg)\b/.test(q) && !/\b(?:treasury|tesouro|balance|saldo)\b/.test(q)) return [];
  const matches: Array<[RegExp, typeof lookupSchema._output.topic]> = [
    [/\b(?:price|preco|cotacao)\b/, "price"],
    [/\b(?:treasur\w*|tesour\w*|balances?|saldos?|holdings?|lockbox)\b/, "treasuries"],
    [/\b(?:meetings?|reunioes|reuniao)\b/, "meetings"],
    [/\b(?:elections?|committee|eleicoes|eleicao|comite|membros)\b/, "elections"],
    [/\b(?:scheduled?|upcoming payments|agendad\w*)\b/, "schedule"],
    [/\b(?:maya|investments?|investimentos?)\b/, "investments"],
    [/\b(?:monthly|mensal|relatorios?)\b/, "monthly"],
    [/\b(?:zec?hub)\b/, "zechub"],
    [/\b(?:coinholder)\b/, "coinholder"],
    [/\b(?:news|noticias)\b/, "news"],
    [/\b(?:grant applications?|funding proposals?|propostas de grants)\b/, "proposals"],
    [/\b(?:ecosystem|repositori\w*|ecossistema|zebra|zaino|zingo|wallets?|carteiras?)\b/, "ecosystem"],
    [/\b(?:funding history|historico de financiamento)\b/, "funding_history"],
    [/\b(?:recipients?|beneficiarios?)\b/, "recipients"],
    [/\b(?:grants?|zcg)\b/, "grants"],
  ];
  return [...new Set(matches.filter(([pattern]) => pattern.test(q)).map(([, topic]) => topic))].slice(0, 2);
}
export async function prepareLocal(messages: ChatMessage[], signal: AbortSignal): Promise<LocalPlan> {
  signal.throwIfAborted();
  const query = retrievalQuestion(messages);
  const documents = searchKnowledge(query);
  const intent = directIntent(messages);
  const pt = portuguese(messages);
  if (intent?.type === "ledger") {
    const result = await lookupLedger(intent.filters, signal);
    const data = JSON.parse(result.content).data as LedgerSummary | undefined;
    return { query, documents, evidence: [result], direct: data ? ledgerAnswer(data, pt) : undefined, external: false };
  }
  const topics = intent?.type === "price" ? ["price" as const] : relevantTopics(query);
  const evidence = await Promise.all(topics.map((topic) => lookupPublicData({ topic, query: "" }, signal)));
  signal.throwIfAborted();
  const q = normalizeQuestion(query);
  // Dated local notes do not establish current protocol status, releases or the newest ZIP.
  const external = /\b(?:latest|newest|current|ultimo|ultima|atual|today|hoje|recent\w*)\b/.test(q)
    && /\b(?:zips?|nu\d+|upgrade|release|protocol|protocolo|versao)\b/.test(q);
  return { query, documents, evidence, direct: intent?.type === "price" ? priceAnswer(evidence[0], pt) : undefined, external };
}
