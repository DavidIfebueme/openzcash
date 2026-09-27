import { APPS } from "@/lib/design-routes";
import type { ZarvisSource } from "./types";

export const SEARCH_DOMAINS = [
  "z.cash", "zips.z.cash", "zcash.github.io", "zcash.readthedocs.io",
  "zfnd.org", "zcashfoundation.org", "electriccoin.co", "zechub.wiki",
  "forum.zcashcommunity.com", "shieldedlabs.net", "openzcash.org",
];

export function safeSourceUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    if (SEARCH_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`)))
      return u.href;
    if (u.hostname === "github.com" && /^\/(zcash|zcashfoundation|zechub|zingolabs|shieldedlabs)\//i.test(u.pathname))
      return u.href;
    return null;
  } catch { return null; }
}

export type KnowledgeNote = ZarvisSource & { id: string; keywords: string; text: string; reviewedOn: string };
const reviewedOn = "2026-09-25";
export const KNOWLEDGE: KnowledgeNote[] = [
  {
    id: "privacy", title: "Zcash: using shielded transactions", url: "https://z.cash/learn/how-to-use-zcash/",
    keywords: "privacy shielded transparent privacidade blindada transacao transaction beginner basics zcash",
    text: "Zcash supports transparent and shielded transfers. Shielded transfers use zero-knowledge proofs to validate encrypted transaction data. Privacy depends on which receivers and pools are used, the wallet, and the surrounding activity. Do not promise complete anonymity, invisible network traffic, or that every Zcash transaction is shielded. Transparent activity is public. Network metadata and exchanges can reveal information outside the chain.", reviewedOn,
  },
  {
    id: "viewing-keys", title: "ZIP 310: Sapling viewing-key privacy properties", url: "https://zips.z.cash/zip-0310",
    keywords: "viewing key ivk fvk ufvk uivk sender recipient spending chave visualizacao remetente destinatario",
    text: "Viewing keys never grant spending authority. An incoming viewing key reveals received note amounts, recipient addresses and memos; it does not by itself identify the shielded sender or track whether those notes were spent. A full viewing key additionally lets a scanner detect spending of known notes and recover outgoing payment details when the sender uses the expected outgoing viewing key. Do not promise that any viewing key reveals every transaction or all counterparties. A memo can claim a sender identity, but that claim is not automatically authenticated. ZIP 310 documents Sapling properties; unified viewing keys bundle the supported components, as defined in ZIP 316. Explain the distinction between incoming and full keys when relevant, and cite the specification.", reviewedOn: "2026-09-26",
  },
  {
    id: "addresses", title: "ZIP 316: Unified Addresses and viewing keys", url: "https://zips.z.cash/zip-0316",
    keywords: "wallet address unified orchard sapling receiver viewing key carteira endereco chave",
    text: "Unified Addresses can bundle receivers for different transfer protocols. A Unified Address alone does not guarantee every payment will use a shielded receiver; sender support and the selected receiver matter. Viewing keys can reveal private transaction information without granting spending authority; never ask users to paste them or a seed phrase into chat. A spending key or recovery phrase controls funds.", reviewedOn,
  },
  {
    id: "issuance", title: "Zcash protocol specification", url: "https://zips.z.cash/protocol/protocol.pdf",
    keywords: "mining miner halving supply issuance inflation mineracao oferta emissao 21 million",
    text: "The nominal maximum supply is 21 million ZEC. Five percent of that maximum is 1,050,000 ZEC. A percentage of circulating supply has a different, changing denominator. After Blossom, the target block spacing is 75 seconds and halving intervals span 1,680,000 blocks. Halving dates are estimates based on block progress, not fixed calendar deadlines. Block subsidy excludes transaction fees. Use a fresh chain/supply reading for present-day amounts.", reviewedOn,
  },
  {
    id: "funding", title: "ZIP 214: development funding rules", url: "https://zips.z.cash/zip-0214",
    keywords: "dev fund development lockbox funding zcg mining reward fundo subsidio alocacao",
    text: "Funding rules have changed across upgrades. OpenZcash's current consensus model uses 8% of block subsidy for ZCG and 12% for the Lockbox in the NU6/NU6.1 era, ending at height 4,406,400. Continued funding after that is a scenario, not guaranteed policy. A 20% allocation leaves 80% of subsidy for miners; removing it would increase miners' subsidy from 80 to 100, a 25% relative increase, not a 20% increase. Verify activation/status against current sources: a ZIP page marked Proposed is not itself proof of activation. Transaction fees are separate.", reviewedOn,
  },
  {
    id: "ledger", title: "OpenZcash sources and methodology", url: "https://openzcash.org/zcg/methodology",
    keywords: "grant ledger paid usd budget cost spend recipient zcg grantee gasto pago orcamento beneficiario",
    text: "OpenZcash mirrors public records, with source links and import dates. Budgeted USD, the historical budget value of paid milestones, actual ZEC disbursements and current USD valuation are different measures. Payment is not proof of delivery. importedAt is collection time, not publication or payment time. A source row URL may change after a spreadsheet edit. Explicitly label partial results; never total a subset as if it were the entire ledger.", reviewedOn,
  },
  {
    id: "calculator", title: "Treasury calculator: adjustable scenarios", url: "https://openzcash.org/zcg/treasury-calculator",
    keywords: "treasury cypherpunk cipherpunk company calculator years 5% 20x tesouro calculadora anos target",
    text: "The calculator compares a circulating-supply target with a fixed maximum-supply target. Mining projections include halvings and assume the company's mining share remains constant. A mining-only ceiling is conditional on that model, not proof that a company can never reach its target; purchases or a changing mining share can change the result. 'Mine, then buy' is a single purchase of the remaining ZEC at the chosen future price, not an annual expense. Mining costs, price impact and future spending growth are excluded. ZCG + Lockbox coverage values dated balances at a scenario price against a fixed annual USD budget; separate legal restrictions still apply. The share of spending funded by ZEC sales is an assumption, not evidence that all grant recipients sell their ZEC. Never recycle 4.24% or another historic output as a current prediction.", reviewedOn,
  },
  {
    id: "governance", title: "OpenZcash governance and decision homes", url: "https://openzcash.org/governance",
    keywords: "governance vote voting decision upgrade poll zip nu6 nu7 governanca votacao decisao",
    text: "Separate a proposal, sentiment poll, funding decision, software release and activated consensus rule. Forum discussion is not binding protocol policy. ZCG, coinholder-directed funding, Zcash Foundation, development organizations and node operators have distinct responsibilities. Link to the relevant decision venue and dated announcement; do not infer motives or consensus from a single comment.", reviewedOn,
  },
  {
    id: "ecosystem", title: "OpenZcash ecosystem directory", url: "https://openzcash.org/ecosystem",
    keywords: "ecosystem wallet developer zebra zaino zingo zodl zashi shielded labs tachyon zakura roadmap carteira projeto",
    text: "OpenZcash organizes public projects, organizations, wallet information and development links. Directory inclusion is not a security audit or endorsement. Check the project's primary source for current supported platforms, receiving protocols, release versions and upgrade status. Never invent a download link or tell a user a wallet recovery phrase is safe to share.", reviewedOn,
  },
  {
    id: "history", title: "Zcash's Since block zero", url: "https://openzcash.org/funding-history",
    keywords: "history founders genesis zero emission issuance funding historia fundador desde",
    text: "OpenZcash's funding history computes non-miner allocations using consensus rules and historical block heights. Historical USD at receipt uses each day's close; it is not current treasury value. Distinguish total coins allocated over time from the coins still held today. Reclassifying or transferring funds must not create new issuance or double-count a treasury.", reviewedOn,
  },
  {
    id: "community", title: "ZecHub community learning library", url: "https://zechub.wiki/",
    keywords: "learn community education tutorial beginner zechub comunidade aprender portugues spanish",
    text: "ZecHub provides community-maintained Zcash education. Explain concepts in the question's language, with concise examples and links. Community explanations complement the protocol specification and primary project documentation. Distinguish ZecHub's own treasury from ZCG and the Lockbox.", reviewedOn,
  },
];

export function publicSiteGuide(): string {
  return APPS.filter((app) => !app.admin).map((app) =>
    `${app.label}: https://openzcash.org${app.href} — ${app.sub}\n` +
    app.pages.filter((p) => !p.hidden).map((p) => `  ${p.label}: https://openzcash.org${p.href}`).join("\n"),
  ).join("\n");
}

const STOP = new Set("the a an of on in at from into then than when where why to and or is are how what which with for does do can would about em de da do dos das os as que como qual quais para por um uma no na e o a eu me my it this zcash zec openzcash".split(" "));
export function terms(value: string): string[] {
  return [...new Set(value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].filter((t) => !STOP.has(t));
}
export function selectKnowledge(question: string): KnowledgeNote[] {
  const tokens = terms(question);
  const scored = KNOWLEDGE.map((note, index) => ({ note, index, score: tokens.reduce((n, t) => n + Number(`${note.keywords} ${note.title}`.toLowerCase().includes(t)), 0) }));
  const matches = scored.filter((n) => n.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 6).map((n) => n.note);
  return matches.length ? matches : KNOWLEDGE.filter((n) => ["privacy", "ecosystem", "ledger"].includes(n.id));
}

export const STARTERS = [
  { label: "Understand Zcash", question: "What makes a Zcash transaction private? Explain it simply." },
  { label: "Explore the treasuries", question: "What do the latest ZCG and Lockbox balances tell us, and how old are the data?" },
  { label: "Follow the funding", question: "How is the Dev Fund split, and what changes at the next halving?" },
  { label: "Test a hypothesis", question: "If ZEC rises 20×, what changes in the company and community treasury scenarios?" },
];
