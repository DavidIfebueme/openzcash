import { providerRetention } from "./retention";
export { PROVIDER_RETENTION, providerRetention, type ProviderRetention } from "./retention";
/** Content for the public page /zarvis/about: how Zarvis works, what it costs a visitor, what it keeps and where it failed. No secrets, no counters. */
export type AboutQuotaConfig = { networkWindowLimit: number; networkDailyLimit: number; dailyUsdCap: number | null; quotaPause: { active: boolean; until: string | null } };
export type AboutModelConfig = { providerLabel: string; model: string; webSearch: boolean; enabled: boolean };
const integer = (n: number) => new Intl.NumberFormat("en-US").format(n);
/** Plain sentences a visitor can act on; the site-wide numbers stay internal. */
export function quotaLines(config: AboutQuotaConfig): string[] {
  const lines = [
    `Up to ${integer(config.networkWindowLimit)} questions per 10 minutes and ${integer(config.networkDailyLimit)} per day from one network address; phones on one carrier share an address. Each question needs a quota slot before routing; a completed direct answer gives the unit back. A full request-count cap also blocks direct answers. A refused question says when to retry, and the send button waits.`,
    `Site-wide hourly and daily request caps also apply before routing and can block direct answers.${config.dailyUsdCap ? " A separate daily spending ceiling pauses model answers; direct answers remain available while request-count quota is available." : ""}`,
  ];
  if (config.quotaPause.active && config.quotaPause.until) lines.push(`Per-visitor and site-wide question caps are paused until ${config.quotaPause.until.slice(0, 16).replace("T", " ")} UTC; the spending ceiling still applies.`);
  return lines;
}
export function modelLine(config: AboutModelConfig): string {
  if (!config.enabled) return "Model answers are switched off at the moment; only direct answers from OpenZcash data are available.";
  const api = providerRetention(config.providerLabel)?.api ?? "Responses API";
  const search = config.webSearch ? ", with the provider's hosted web search limited to Zcash ecosystem domains when the evidence on this site is not enough" : ", without web search";
  // Only the Messages API transport has a page-reading tool; it reads a page the question links on the same domains, search on or off.
  const fetch = api === "Messages API" ? "; a page you link on an official or community Zcash domain may be read in full" : "";
  return `${config.model} from ${config.providerLabel}, called through its ${api}${search}${fetch}.`;
}
/** One place that says how old "live" is: sheet/GitHub import cadence, D-1 verdict publication, price cache. Numbers mirror docs/zcg-publication.md and the freshness pipeline. */
export const FRESHNESS_NOTE = "Site records import from the official spreadsheet and GitHub every 6 hours, and pages refresh themselves when a visit arrives after a stale period. Grant verdict changes publish the next day at midnight, Brasilia time. Price quotes are cached for about 10 minutes. When sources disagree, the ZCG Grant Dashboard spreadsheet wins.";
/** Non-affiliation warning without claims about when or where third-party tokens appeared. */
export const TOKEN_DISCLAIMER = {
  title: "No official token",
  body: "There is no official Zarvis token and no official OpenZcash token, coin or memecoin. Any token using the Zarvis or OpenZcash name is not created, endorsed or issued by OpenZcash, and this site is not connected to it. Zarvis is free to use; OpenZcash pays the model.",
} as const;
/** What the server records per request, in the visitor's words: labels and counts, never the text. The topic label comes from the fixed list in topics.ts. */
export const KEPT_AT_OPENZCASH = "no question or answer is written to a database or a log. What is recorded per request is the route, the outcome, the duration, the token counts, the estimated cost, the language of the answer and a coarse topic label chosen from a fixed list of fifteen subjects (price, treasuries, grants, governance, ZIPs, wallets, privacy, mining, communities, news, calculator, history, site help, other), never a word of the question; per day, those counts by route. Feedback sends your rating and, for “Needs work”, an optional reason chosen from a fixed list, without the conversation text. Dictation sends the recording to ElevenLabs to become text; OpenZcash keeps no audio and no transcript, only the outcome, duration, detected language and estimated cost of each recording. Hosting access logs and short-lived abuse counters, keyed by a hash of the network address, are separate.";
/** Direct answers: no model call, no cost, sources from this site's own records. */
export const DIRECT_ROUTES = [
  { label: "Privacy and protocol FAQ", detail: "What makes a transaction private, halving, block subsidy, Dev Fund split, viewing keys, common wallet questions." },
  { label: "Treasuries", detail: "ZCG and Lockbox balances with their data dates, the per-block accrual and the site's own valuation at the current quote." },
  { label: "ZEC price", detail: "The current USD quote with its time and a stale flag; dated daily closes by day, month or year." },
  { label: "Grant ledger sums", detail: "Totals by program, year, project or recipient, computed from the complete ledger rather than excerpts." },
  { label: "Network activity and comparisons", detail: "Supply and pool balances checked across public explorers; monthly activity and calculated changes between closed UTC months. Sources, dates, partial periods and unavailable confirmations stay visible." },
  { label: "ZIPs", detail: "Any numbered ZIP or draft from the official repository at a pinned revision: title, status, dates, abstract." },
  { label: "Arborist calls, wallets, communities, decisions, chain", detail: "The site's own directories and on-chain reader: latest call notes and recordings, wallet and community listings with revision dates, ZCG decisions, tip height and next halving estimate." },
] as const;
export const LIMITATIONS = [
  "Zarvis is a guide, not an official spokesperson for Zcash, its development teams, the Zcash Foundation, ZCG or the Financial Privacy Foundation, and it can be wrong.",
  "For model answers backed by recognized financial evidence, a numeric guard checks USD, ZEC and percentage figures against the retrieved records and protocol constants. Unsupported figures may be restated once, when time permits; those still unsupported are withheld with a notice. Other answers and currencies are not fully covered, and a matching figure can still be out of context. Check the sources.",
  "Calendar dates for future blocks are estimates; ZIP statuses and listed activation heights are not proof that a change is live on the network.",
  "Zarvis reads public records only. It cannot see wallets, private balances or anything you did not type or dictate, and it cannot send, sign or contact anyone.",
  "It stays on Zcash and OpenZcash. Unrelated requests are redirected. Never share recovery phrases, private keys or viewing keys.",
  "Answers follow the language of the question; the interface, the page chrome and this page are in English.",
] as const;
/** The six questions visitors actually bring, answered without drifting numbers: quotas and dates live in the sections above, not here. */
export const FAQ: Array<{ q: string; a: string }> = [
  { q: "Is there a Zarvis or OpenZcash token?", a: "No. See the notice at the top of this page: a token using the Zarvis or OpenZcash name is not created, endorsed or issued by OpenZcash." },
  { q: "Can Zarvis spend my ZEC or see my wallet?", a: "No. Zarvis reads public records only. It cannot see wallets, private balances or anything you did not type or dictate, and it cannot send, sign or contact anyone. Never share recovery phrases, private keys or viewing keys." },
  { q: "How fresh is the data in answers?", a: "Direct answers carry the date of the record they used. The site imports every 6 hours and price quotes are cached for about 10 minutes; see “How fresh is the data?” above." },
  { q: "Why did I get a message about question limits?", a: "Zarvis is free but capacity-limited. The per-network and site-wide caps are listed under “What you may ask” above. Completed direct answers from site data give the quota unit back, but still need an available request-count quota slot before routing." },
  { q: "What languages does Zarvis answer in?", a: "It answers in the language of your question. Direct answers, badges and notices exist in full in English, Portuguese and Spanish; model answers follow the language you wrote in." },
  { q: "How do I report a wrong answer or wrong data?", a: "For a Zarvis answer, use the rating under it and pick what went wrong. For site data, post in the public forum thread linked under “Found something wrong?” below." },
];
export type Incident = { date: string; window: string; title: string; what: string; fix: string };
export const INCIDENTS: Incident[] = [
  { date: "2026-09-28", window: "12:00–14:33 UTC", title: "Launch-day quota exhaustion",
    what: "The hourly and per-network question caps set for a quiet start (30 model answers per hour site-wide) were reached within the first hours after the announcement. About 200 questions were refused with the quota message before anyone noticed, because rejections were not counted anywhere.",
    fix: "A 24-hour quota pause was deployed at 13:09 UTC and the caps were raised afterwards. Rejections, provider errors and cost are now logged and stored daily, a public health endpoint exists, and an hourly canary asks the four starter questions." },
  { date: "2026-09-28", window: "until 14:33 UTC", title: "Treasuries starter answered with a generic notice",
    what: "The starter “Explore the treasuries” produced the fallback text instead of balances: the figure guard rejected the site's own derived numbers (the valuation at the current quote) as unsupported and replaced the whole answer.",
    fix: "That starter is answered directly from the treasury data without a model call; the guard now knows the derived arithmetic and the protocol constants, tolerates rounding, and asks the model to restate an answer instead of discarding it." },
  { date: "2026-09-28", window: "20:15–21:21 UTC", title: "First canary run failed on a stale ZIP corpus",
    what: "Right after a deploy the ZIP catalog was the build-time snapshot, older than its refresh window, so the check “What is ZIP 317?” could not be answered directly and the public health endpoint reported degraded for about an hour although visitors still received model answers.",
    fix: "The corpus is warmed after boot; a stale corpus marks that check as skipped rather than failed, and only three consecutive skipped runs raise an alert." },
];
