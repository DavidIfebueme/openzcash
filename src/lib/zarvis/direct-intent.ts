import type { ChatMessage } from "./types";
import type { LedgerQuery } from "./ledger";
import { matchDirectFaq, type FaqId } from "./direct-faq";

export type DirectIntent =
  | { type: "price" }
  | { type: "ledger"; filters: LedgerQuery }
  | { type: "treasury"; fund: "zcg" | "lockbox" | "both" }
  | { type: "faq"; id: FaqId }
  | { type: "zip"; number: number; overview: boolean }
  | { type: "latest_zip" }
  | { type: "courtesy"; thanks: boolean }
  | { type: "preference" };
export const normalizeQuestion = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("’", "'").replace(/[?!]/g, "").replace(/[.,](?!\d)/g, "").replace(/\s+/g, " ").trim();
const canonical = (s: string) => normalizeQuestion(s).replace(/^(?:please |por favor )/, "").replace(/(?: please| por favor)$/, "");
const project = '(?:"[a-z0-9][a-z0-9 -]{0,79}"|zingo|zashi|zec ?hub|zebra|zaino|nighthawk|ywallet|zcash media)';
const ledgerPatterns = [
  new RegExp(`^how much (?:did|has) (zcg|coinholders?) (?:pay|paid) in grants(?: (?:to|for) (${project}))?(?: in (20[0-9]{2})| (all time|in total))?$`),
  new RegExp(`^quanto (?:o |os )?(zcg|coinholders?) (?:pagou|pagaram) em (?:grants|marcos)(?: (?:ao|para) (${project}))?(?: (?:em )?(20[0-9]{2})| (no total|ao todo))?$`),
  new RegExp(`^(zcg|coinholder) (?:grant payments|paid grants)(?: (?:to|for) (${project}))?(?: (?:in|for) (20[0-9]{2})| (all time|in total))?$`),
];
const funds = (q: string): "zcg" | "lockbox" | "both" | undefined => /^(?:zcg (?:and|e|\+) lockbox|lockbox (?:and|e|\+) zcg)$/.test(q) ? "both" : q === "zcg" || q === "lockbox" ? q : undefined;
const keyTopic = (intent?: DirectIntent) => intent?.type === "faq" && ["viewing", "incoming", "full", "outgoing", "key_spend", "key_sender"].includes(intent.id);

function resolve(q: string, previous?: DirectIntent): DirectIntent | undefined {
  if (/^(?:hi|hello|hey|ola|oi|hello zarvis|hi zarvis|ola zarvis|oi zarvis)$/.test(q)) return { type: "courtesy", thanks: false };
  if (/^(?:thanks|thank you|obrigado|obrigada|valeu)$/.test(q)) return { type: "courtesy", thanks: true };
  if (/^(?:(?:answer|reply|respond|responda|responde)(?: to me)? (?:in|em) (?:english|ingles|portuguese|portugues)|(?:use|usar|mostre em|show amounts in) (?:usd|dollars|dolares)|keep answers short|be brief|seja breve|respostas curtas)$/.test(q)) return { type: "preference" };
  if (/^(?:(?:qual (?:e )?(?:o )?(?:preco|cotacao) (?:atual )?d[oa] |quanto (?:esta|custa) (?:o )?)(?:zec|zcash)(?: (?:hoje|agora|em usd|em dolar|em dolares))?|(?:what is|what's|whats) (?:the )?(?:current )?(?:zec|zcash) (?:price|usd price)(?: (?:today|now|in usd))?|(?:zec|zcash) (?:price|preco|cotacao)(?: (?:today|now|hoje|agora))?|how much is (?:one |1 )?(?:zec|zcash)(?: (?:worth|in usd|today|now))?)$/.test(q)) return { type: "price" };
  for (const pattern of ledgerPatterns) {
    const m = q.match(pattern);
    if (m) {
      const year = m[3] ? Number(m[3]) : null;
      if (year !== null && (year < 2016 || year > 2100)) return;
      return { type: "ledger", filters: { scope: m[1] === "zcg" ? "zcg_grants" : "coinholder_grants", year, search: (m[2] ?? "").replaceAll('"', '') } };
    }
  }
  const treasury = q.match(/^(?:(?:what (?:does|do) (.+) hold)|(?:what (?:is|are) (?:the )?(?:(?:latest|current) )?(.+?) (?:treasury|treasury balances?|balances?))|(?:how much(?: zec)? (?:does|do) (.+?) (?:hold|have))|(?:qual (?:e |sao )?(?:o saldo|os saldos)(?: atuais?| mais recentes?)? (?:do |de )?(.+))|(?:quanto (?:o )?(.+?) tem(?: em zec)?))$/);
  const shortTreasury = q.match(/^(?:saldo (?:do|de) (.+)|(.+?) (?:balances?|holdings|treasury))$/);
  const fund = funds(treasury?.slice(1).find(Boolean) ?? shortTreasury?.slice(1).find(Boolean) ?? "");
  if (fund) return { type: "treasury", fund };
  const zip = q.match(/^(?:(?:what is|what's|whats|o que e|explique|explain) zip[ -]*([0-9]{1,6})|zip[ -]*([0-9]{1,6})|(?:what is (?:the )?(?:status|title|created date) of|qual (?:e )?(?:o status|o titulo|a data de criacao) (?:do|de)) zip[ -]*([0-9]{1,6})|when was zip[ -]*([0-9]{1,6}) created)$/);
  if (zip) return { type: "zip", number: Number(zip.slice(1).find(Boolean)), overview: !zip[3] && !zip[4] };
  if (/^(?:qual (?:e )?(?:o )?(?:ultimo|mais recente) zip|(?:what is|what's|whats) (?:the )?(?:latest|newest|last) zip|latest zip|ultimo zip)$/.test(q)) return { type: "latest_zip" };
  const faq = matchDirectFaq(q);
  if (faq) return { type: "faq", id: faq };
  const year = q.match(/^(?:(?:and|e|what about|how about)(?: (?:in|em))? )?(20[0-9]{2})$/);
  if (year && previous?.type === "ledger" && Number(year[1]) >= 2016 && Number(year[1]) <= 2100) return { ...previous, filters: { ...previous.filters, year: Number(year[1]) } };
  const nextFund = q.match(/^(?:and|e|what about|how about) (?:the |o )?(zcg|lockbox)$/);
  if (nextFund && previous?.type === "treasury") return { type: "treasury", fund: nextFund[1] as "zcg" | "lockbox" };
  const nextZip = q.match(/^(?:and|e|what about|how about) (?:o )?zip[ -]*([0-9]{1,6})$/);
  if (nextZip && (previous?.type === "zip" || previous?.type === "latest_zip")) return { type: "zip", number: Number(nextZip[1]), overview: previous.type === "zip" ? previous.overview : true };
  if (previous?.type === "zip" && /^(?:what is its status|and its status|when was it created|qual (?:e )?o status dele|e o status|quando foi criado)$/.test(q)) return { ...previous, overview: false };
  if (previous?.type === "latest_zip" && /^(?:what is its status|and its status|when was it created|qual (?:e )?o status dele|e o status|quando foi criado)$/.test(q)) return previous;
  if (previous?.type === "price" && /^(?:and now|e agora|what about now)$/.test(q)) return previous;
  if (keyTopic(previous)) {
    if (/^(?:can it spend my zec|can it spend|ela pode gastar meus zec|pode gastar meus zec)$/.test(q)) return { type: "faq", id: "key_spend" };
    if (previous?.type === "faq" && ["incoming", "key_sender"].includes(previous.id) && /^(?:can it identify the sender|and the sender|e o remetente)$/.test(q)) return { type: "faq", id: "key_sender" };
    if (/^(?:and (?:the |a )?full viewing key|e (?:a |uma )?fvk)$/.test(q)) return { type: "faq", id: "full" };
  }
}

/** Unknown prior instructions may carry language/format constraints. Do not silently discard them. */
export function directIntent(messages: ChatMessage[]): DirectIntent | undefined {
  if (messages.at(-1)?.role !== "user") return;
  let previous: DirectIntent | undefined;
  let latest: DirectIntent | undefined;
  for (const message of messages) {
    if (message.role !== "user") continue;
    latest = resolve(canonical(message.content), previous);
    if (!latest) return;
    if (latest.type !== "preference" && latest.type !== "courtesy") previous = latest;
  }
  return latest;
}
