import "server-only";
import { lookupPublicData, lookupSchema } from "./data";
import { queryLedger, ledgerQuerySchema, type LedgerSummary } from "./ledger";
import { searchKnowledge } from "./knowledge";
import { getZipCorpus } from "./zips";
import { isZipQuestion, zipCatalogEvidence, latestZipAnswer, requestedZips } from "./zip-catalog";
import { boundedRead } from "./timeout";
import type { ChatMessage, ZarvisSource } from "./types";
import { directIntent, normalizeQuestion } from "./direct-intent";
import { faqAnswer } from "./direct-faq";
import { treasuryAnswer, numberedZipAnswer } from "./direct-data";
import { sessionPreferences, type ZarvisSession } from "./session";
export { directIntent, normalizeQuestion } from "./direct-intent";

export type Evidence = { content: string; source?: ZarvisSource };
export type LocalPlan = { query: string; documents: ReturnType<typeof searchKnowledge>; evidence: Evidence[]; direct?: string; external: boolean };
/** Retrieve for the latest topic; short replies can refer to the preceding answer/offer. */
export function retrievalQuestion(messages: ChatMessage[]): string {
  const latest = messages.at(-1)?.content ?? "";
  if (latest.length <= 70 && /^(?:yes|sim|ok|sure|please|continue|pode|isso|e\b|and\b|what about\b|how about\b|explain(?: (?:that|it|more))?$|explique(?: (?:isso|mais))?$|por que\b|why\b)/i.test(latest.trim())) {
    return `${messages.slice(-3, -1).map((m) => m.content.slice(0, 900)).join("\n")}\n${latest}`;
  }
  return latest;
}
export function portuguese(messages: ChatMessage[]): boolean {
  const last = normalizeQuestion(messages.at(-1)?.content ?? "");
  if (/\b(?:qual|quanto|preco|cotacao|hoje|agora|em|e|sim|explique|pagou|ola|oi|obrigado|obrigada|valeu)\b/.test(last)) return true;
  if (/\b(?:what|how|price|today|and|yes|in|for)\b/.test(last)) return false;
  for (const message of messages.slice(0, -1).reverse()) {
    if (message.role !== "user") continue;
    const previous = normalizeQuestion(message.content);
    if (/\b(?:what|how|price|today|and|yes|in|for)\b/.test(previous)) return false;
    if (/\b(?:qual|quanto|preco|cotacao|pagou|em|sim)\b/.test(previous)) return true;
  }
  return false;
}
const validDate = (value: string | null) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() + 60_000;
const validAmount = (value: string) => typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER / 100;
const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
function date(value: string, pt: boolean): string {
  return new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}
function priceAnswer(evidence: Evidence, pt: boolean): string {
  const unavailable = pt
    ? "Não foi possível consultar a cotação em USD agora. [Abrir o Observatório ZEC](https://openzcash.org/zec-observatory)."
    : "The USD price feed is unavailable right now. [Open the ZEC Observatory](https://openzcash.org/zec-observatory).";
  try {
    const quote = JSON.parse(evidence.content).data?.quote;
    const at = Date.parse(quote?.quotedAt);
    if (!quote || !(quote.usd > 0) || !Number.isFinite(quote.usd) || !Number.isFinite(at) || at > Date.now() + 60000) return unavailable;
    const usd = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(quote.usd);
    if (quote.stale || Date.now() - at >= 10 * 60000) return pt
      ? `Não consegui confirmar a cotação atual. Última referência: **${usd} por ZEC**, de ${date(quote.quotedAt, pt)}; é uma cotação em cache. [Cotação do OpenZcash](https://openzcash.org/api/zec-price).`
      : `I could not confirm the current price. Last saved quote: **${usd} per ZEC**, from ${date(quote.quotedAt, pt)}; this is a cached reference. [OpenZcash price feed](https://openzcash.org/api/zec-price).`;
    return pt
      ? `1 ZEC = **${usd}**. Cotação de ${date(quote.quotedAt, pt)}. [Cotação do OpenZcash](https://openzcash.org/api/zec-price).`
      : `1 ZEC = **${usd}**. Quoted ${date(quote.quotedAt, pt)}. [OpenZcash price feed](https://openzcash.org/api/zec-price).`;
  } catch { return unavailable; }
}
export function ledgerAnswer(data: LedgerSummary, pt: boolean): string | undefined {
  if (!ledgerQuerySchema.safeParse(data.filters).success || data.filters.scope !== "zcg_grants" || data.filters.search || data.filters.year === null || !validDate(data.importedAt) || !validAmount(data.budgetedUsdOfPaidEntries) || !count(data.paidEntries) || !count(data.paidEntriesMissingUsd)) return;
  const value = Number(data.budgetedUsdOfPaidEntries);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) return;
  const usd = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(value);
  const caveat = data.paidEntriesMissingUsd ? (pt ? ` ${data.paidEntriesMissingUsd} registros pagos não têm valor USD; o total é incompleto.` : ` ${data.paidEntriesMissingUsd} paid entries have no USD amount; this total is incomplete.`) : "";
  return pt
    ? `Em **${data.filters.year}**, o registro do ZCG soma **${usd}** em valores orçados de **${data.paidEntries} registros de grants marcados como pagos**.${caveat}\n\nO filtro usa a data de pagamento e exclui registros sem data. Não inclui grants dos coinholders nem planilhas operacionais separadas; não é a cotação atual dos ZEC. Dados importados em ${date(data.importedAt!, pt)}. [Pagamentos do ZCG](https://openzcash.org/zcg/disbursements).`
    : `In **${data.filters.year}**, the ZCG ledger records **${usd}** in budgeted values for **${data.paidEntries} grant entries marked paid**.${caveat}\n\nThis uses payment dates and excludes undated entries. It excludes coinholder grants and separate operational worksheets; it is not today's ZEC valuation. Data imported ${date(data.importedAt!, pt)}. [ZCG payments](https://openzcash.org/zcg/disbursements).`;
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
export async function prepareLocal(messages: ChatMessage[], signal: AbortSignal, priorSession: ZarvisSession = {}): Promise<LocalPlan> {
  signal.throwIfAborted();
  const session = sessionPreferences(priorSession, messages);
  const compatible = (!session.language || session.language === "en" || session.language === "pt") && (!session.currency || session.currency === "USD") && session.detail !== "detailed";
  const intent = compatible ? directIntent(messages) : undefined;
  const pt = session.language ? session.language === "pt" : portuguese(messages);
  const query = intent?.type === "zip" ? `ZIP ${intent.number}` : intent?.type === "latest_zip" ? "What is the latest ZIP?" : retrievalQuestion(messages);
  if (intent?.type === "courtesy" || intent?.type === "preference") {
    const direct = intent.type === "courtesy" ? intent.thanks ? (pt ? "De nada!" : "You're welcome!") : (pt ? "Olá! Sou o Zarvis. Posso ajudar com Zcash e os dados públicos do OpenZcash." : "Hi! I'm Zarvis. I can help with Zcash and OpenZcash's public data.")
      : /^(?:please |por favor )?(?:answer|reply|respond|responda|responde)\b/.test(normalizeQuestion(messages.at(-1)?.content ?? ""))
        ? (pt ? "Combinado. Vou responder em português." : "Understood. I'll answer in English.")
        : /\b(?:usd|dollars|dolares)\b/.test(normalizeQuestion(messages.at(-1)?.content ?? ""))
          ? (pt ? "Combinado. Vou usar USD para valores monetários." : "Understood. I'll use USD for monetary amounts.")
          : (pt ? "Combinado. Vou manter as respostas objetivas." : "Understood. I'll keep answers concise.");
    return { query, documents: [], evidence: [], direct, external: false };
  }
  if (intent?.type === "faq") {
    const answer = faqAnswer(intent.id, pt);
    return { query, documents: [{ id: `direct-${intent.id}`, ...answer.source, text: answer.text, kind: "reference" }], evidence: [], direct: answer.text, external: false };
  }
  const zip = isZipQuestion(query) ? await getZipCorpus(signal) : undefined;
  const documents = searchKnowledge(query, 4, 5000, zip?.corpus);
  if (intent?.type === "ledger") {
    const result = await lookupLedger(intent.filters, signal);
    const data = JSON.parse(result.content).data as LedgerSummary | undefined;
    const direct = (data ? ledgerAnswer(data, pt) ?? ledgerFactsAnswer(data, pt) : undefined) ?? (pt ? "O registro de pagamentos está indisponível agora. Isso não significa que o total seja zero. [Pagamentos do ZCG](https://openzcash.org/zcg/disbursements)." : "The payment ledger is unavailable right now. This does not mean the total is zero. [ZCG payments](https://openzcash.org/zcg/disbursements).");
    return { query, documents, evidence: [result], direct, external: false };
  }
  if (intent?.type === "treasury") {
    const result = await lookupPublicData({ topic: "treasuries", query: "" }, signal);
    return { query, documents, evidence: [result], direct: treasuryAnswer(result.content, intent.fund, pt), external: false };
  }
  const scenarioQuestion = /(?:simul|scenario|cenario|\b[0-9]+\s*[x×]\b)/i.test(query) && /treasur|tesour|cypherpunk|cipherpunk|lockbox|zcg/i.test(query);
  const topics = scenarioQuestion ? [] : intent?.type === "price" ? ["price" as const] : relevantTopics(query);
  const evidence = await Promise.all(topics.map((topic) => lookupPublicData({ topic, query: "" }, signal)));
  if (zip) evidence.push(zipCatalogEvidence(query, zip.corpus, zip.stale));
  signal.throwIfAborted();
  const q = normalizeQuestion(query);
  const currentExternal = /\b(?:latest|newest|current|ultimo|ultima|atual|today|hoje|recent\w*)\b/.test(q)
    && /\b(?:zips?|nu\d+|upgrade|release|protocol|protocolo|versao)\b/.test(q);
  const missingZip = zip && requestedZips(query).some((n) => !zip.corpus.documents.some((d) => d.number === n));
  const external = zip ? !!missingZip || (zip.stale && (currentExternal || intent?.type === "zip")) : currentExternal;
  const direct = intent?.type === "price" ? priceAnswer(evidence[0], pt)
    : intent?.type === "zip" && zip ? numberedZipAnswer(intent.number, intent.overview, zip.corpus, zip.stale, pt)
    : intent?.type === "latest_zip" && zip ? latestZipAnswer("What is the latest ZIP?", zip.corpus, zip.stale, pt) : undefined;
  return { query, documents, evidence, direct, external };
}

export function ledgerFactsAnswer(data: LedgerSummary, pt: boolean): string | undefined {
  if (!validDate(data.importedAt) || !ledgerQuerySchema.safeParse(data.filters).success || !validAmount(data.budgetedUsdOfPaidEntries) || !validAmount(data.recordedZecPaid) || !count(data.paidEntries) || !count(data.paidEntriesMissingUsd) || !count(data.paidEntriesMissingZec)) return;
  const names = { zcg_grants: "ZCG grants", coinholder_grants: "Coinholder grants", ic_payments: "IC payments", discretionary: "Discretionary spending", monthly: "Monthly operations" };
  const scope = names[data.filters.scope]; if (!scope) return;
  const usd = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(Number(data.budgetedUsdOfPaidEntries));
  const zec = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { maximumFractionDigits: 8 }).format(Number(data.recordedZecPaid));
  const project = data.filters.search.replace(/[\[\]()*_`<>\n\r]/g, " ");
  const title = `${scope}${project ? ` · ${pt ? "contendo" : "matching"} “${project}”` : ""} · ${data.filters.year ?? (pt ? "todos os anos" : "all years")}`;
  const missing = data.paidEntriesMissingUsd || data.paidEntriesMissingZec;
  return pt
    ? `**${title}**: **${usd}** em valores orçados de **${data.paidEntries} registros marcados como pagos**; **${zec} ZEC** registrados como desembolsados.${missing ? " Alguns registros não têm valor em USD ou ZEC; os totais dessas colunas são parciais." : ""}\n\nValores históricos do registro, não cotação atual nem confirmação bancária. ${project ? "O filtro busca esse texto em projetos, destinatários e marcos; não confirma uma identidade única. " : ""}${data.filters.year !== null ? "O ano usa a data de pagamento e exclui linhas sem data. " : "Inclui registros sem data. "}Programas e planilhas operacionais são separados. Importado em ${date(data.importedAt!, pt)}. [Registro de pagamentos](https://openzcash.org/zcg/disbursements).`
    : `**${title}**: **${usd}** in budgeted values for **${data.paidEntries} entries marked paid**; **${zec} ZEC** recorded as disbursed.${missing ? " Some entries lack USD or ZEC values; totals for those columns are incomplete." : ""}\n\nHistorical ledger values, not current valuation or bank settlement. ${project ? "The filter matches this text in projects, recipients and milestones; it does not establish a single recipient identity. " : ""}${data.filters.year !== null ? "The year uses payment dates and excludes undated rows. " : "Undated entries are included. "}Programs and operations worksheets are separate. Imported ${date(data.importedAt!, pt)}. [Payment ledger](https://openzcash.org/zcg/disbursements).`;
}
