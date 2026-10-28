import { answerPlan } from "./depth";

/** Content for the interactive guide at /zarvis/guide: it teaches the chat interface by showing it. Copy derives from docs/using-zarvis.md and /zarvis/about; quota and capacity numbers stay on the About page, which this guide links to. */
export type GuideRoute = "direct" | "model";
export type GuideQuestion = { question: string; route: GuideRoute; note: string };
/** Every direct entry is a question the hourly canary answers with the model forbidden, so its route is proven; the model entries are the canary's model case and a writing request. */
export const GUIDE_QUESTIONS: GuideQuestion[] = [
  { question: "What is the ZEC price?", route: "direct", note: "Answered by site code from the cached quote, with its time and a stale flag. No model call, and the quota unit is returned." },
  { question: "What are the latest ZCG and Lockbox balances, and how old are the data?", route: "direct", note: "Answered from the site's own treasury records, with the data dates shown." },
  { question: "What is ZIP 317?", route: "direct", note: "Answered from the official ZIP corpus at a pinned revision: title, status, dates, abstract." },
  { question: "What makes a Zcash transaction private? Explain it simply.", route: "direct", note: "Answered from the reviewed protocol FAQ; the same text every visitor gets." },
  { question: "How is the Dev Fund split, and what changes at the next halving?", route: "model", note: "Answered by the configured model from retrieved records; the badge names it and counts the sources." },
  { question: "Write a 30-second Zcash pitch for someone new to crypto. Give me a natural opening and one practical next step.", route: "model", note: "A writing request: the model drafts it from the reviewed pitch library." },
];
/** Trust guidance shown beside the live badge samples, rendered with the same code the chat uses. */
export const BADGE_GUIDANCE: Record<GuideRoute, string> = {
  direct: "The question matched one of the site's own records and was answered by code: no model call, no cost, and the record's date is shown. Trust it as you trust the site's data pages, and check the date.",
  model: "The badge names the model that wrote the answer and counts the sources it used. Open the source list and check them. A numeric guard checks USD, ZEC and percentage figures against the retrieved records and withholds figures it cannot verify, but other answers and currencies are not fully covered, and a matching figure can still be out of context.",
};
/** What opening a question link does; mirrors the wording the chat itself shows under answers. */
export const SHARE_NOTE = "A question link fills the composer with that one question and leaves the address bar; nothing is sent until you press send.";
/** Quick and Deep budgets come from the deployed answer planner, not from prose, so they cannot drift from the chat. */
const QUICK = answerPlan([], "quick");
const DEEP = answerPlan([], "deep");
const seconds = (ms: number) => `${ms / 1000} seconds`;
const count = (n: number) => new Intl.NumberFormat("en-US").format(n);
export const DEPTH_COMPARISON = [
  { label: "Answer written within", quick: seconds(QUICK.timeoutMs), deep: seconds(DEEP.timeoutMs) },
  { label: "Reasoning effort", quick: QUICK.effort, deep: DEEP.effort },
  { label: "Research rounds over the records", quick: String(QUICK.rounds), deep: String(DEEP.rounds) },
  { label: "Reply-length ceiling", quick: `${count(QUICK.outputTokens)} tokens`, deep: `${count(DEEP.outputTokens)} tokens` },
] as const;
export const DEPTH_AUTO_NOTE = "Auto, the default, adapts to the question: analytical requests such as compare, analyse, trade-offs or sensitivity switch to Deep analysis on their own. The selector next to the composer always wins when you choose.";
/** The annotated sample answer. Its figures are era-stable protocol arithmetic; the notice demonstrates what a withheld figure looks like. */
export const ANATOMY = {
  question: "How is the Dev Fund split, and what changes at the next halving?",
  answer: "The block subsidy is split 80% to miners and 20% to the Dev Fund. At the next halving the subsidy itself halves, so every one of those shares scales down together. What the Dev Fund pays for today, and what the rules say about what follows, is on this site's funding pages.",
  withheldFigures: 1,
  retrievedAt: "2026-10-27T12:00:00Z",
  sources: [
    { title: "Funding history · OpenZcash", url: "https://openzcash.org/funding-history" },
    { title: "ZIP 1014 · zips.zcash.org", url: "https://zips.zcash.org/zip-1014" },
  ],
} as const;
export const ANATOMY_LEGEND = [
  "The badge says who wrote the answer: site code, or the named model with its source count.",
  "“N sources consulted” opens the records or pages that were used, each with its retrieval time.",
  "The notice marks figures the numeric guard could not verify; they are left out, never quietly replaced.",
  "Copy answer, Copy with sources and Copy question link sit under every complete answer; a question link only fills a composer, it never sends.",
] as const;
