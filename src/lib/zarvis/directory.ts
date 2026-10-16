import {
  HARDWARE,
  SOFTWARE,
  WALLET_CATALOG_REVISED_ON,
  walletPrivacy,
  type Wallet,
} from "@/app/wallets/catalog-data";
import {
  COMMUNITIES,
  COMMUNITIES_VERIFIED_ON,
  LEDGER_FALLBACK_AS_OF,
  type Community,
} from "@/lib/communities/data";
import type { CommunitiesFunding } from "@/lib/communities/ledger-funding";
import { daoGrants, type DaoSource } from "@/lib/communities/dao-funding";
import {
  DAO_SHEET_FALLBACK_AS_OF,
  type DaoGrant,
} from "@/lib/communities/dao-proposals";
import { terms } from "./sources";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const PLATFORMS: Array<[RegExp, string]> = [
  [/\b(?:ios|iphone|ipad|apple)\b/, "iOS"],
  [/\bandroid\b/, "Android"],
  [/\b(?:desktop|linux|windows|macos|mac|pc|computador)\b/, "Desktop"],
  [/\b(?:browser|extension|extensao|navegador)\b/, "Browser extension"],
  [/\bweb\b/, "Web"],
  [/\bhardware\b/, "Hardware"],
];
const NOISE = new Set(
  "wallet wallets carteira carteiras support supports supported suporta suportam which what quais qual list lista best melhor recommended recomendada use usar shielded blindada blindadas transparent transparente partial parcial full completa hardware software ios android desktop browser extension web app apps mobile open source audit audited audits safe secure cold privacy private available version".split(
    " ",
  ),
);
const shieldedLevel = (q: string) =>
  /\b(?:transparent\w*|t-?addr\w*)\b/.test(q) && !/\bshielded|blindad/.test(q)
    ? "transparent"
    : /\b(?:partial\w*|parcia\w*)\b/.test(q)
      ? "partial"
      : /\b(?:shielded|blindad\w*|orchard|sapling|z-?addr\w*|privat\w*)\b/.test(
            q,
          )
        ? "full"
        : null;
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A former name in the note ("Formerly Zashi") is still how people ask for the wallet. */
const formerName = (w: Wallet) =>
  w.note.match(/\bformerly ([\p{L}\p{N}!]+)/iu)?.[1] ?? "";
/** A name word must start a word of the name, maker or former name, so "so" never selects "Brave Software" and "safe" never selects ChainSafe's wallet. */
const namesWallet = (t: string, w: Wallet) =>
  t.length >= 3 &&
  new RegExp(`\\b${escape(t)}`).test(
    normalize(`${w.name} ${w.maker} ${formerName(w)}`),
  );

/** The wallet catalog with the question's platform, shielded level and name filters applied; the full inventory stays listed, and comes before the rows so the serialized budget cuts rows first. */
export function walletsContext(query: string) {
  const q = normalize(query);
  const all = [
    ...SOFTWARE.map((w) => ({ w, kind: "software" })),
    ...HARDWARE.map((w) => ({ w, kind: "hardware" })),
  ];
  const platform = PLATFORMS.find(([pattern]) => pattern.test(q))?.[1] ?? null;
  const shielded = shieldedLevel(q);
  const kind = /\bhardware\b/.test(q)
    ? "hardware"
    : /\bsoftware|app\b/.test(q)
      ? "software"
      : null;
  const words = terms(q).filter((t) => !NOISE.has(t));
  const named = all.filter(({ w }) => words.some((t) => namesWallet(t, w)));
  const pool = named.length ? named : all;
  const matched = pool.filter(
    ({ w, kind: k }) =>
      (!platform || named.length > 0 || w.platforms.includes(platform)) &&
      (!shielded || walletPrivacy(w.name, platform ?? "").level === shielded) &&
      (!kind || k === kind),
  );
  const row = ({ w }: { w: Wallet }) => ({
    name: w.name,
    maker: w.maker,
    platforms: w.platforms.join(", "),
    shielded: walletPrivacy(w.name, platform ?? "").level,
    availability: walletPrivacy(w.name, platform ?? "").availability,
    ...(w.tag ? { status: w.tag } : {}),
    note: w.note,
    site: w.url,
    ...(w.source ? { sourceCode: w.source } : {}),
    ...(w.audit ? { auditReport: w.audit } : {}),
  });
  return {
    catalogRevisedOn: WALLET_CATALOG_REVISED_ON,
    totalWallets: all.length,
    fullShielded: all.filter(({ w }) => walletPrivacy(w.name, platform ?? "").level === "full").length,
    hardwareWallets: HARDWARE.length,
    allWallets: all.map(({ w }) => `${w.name}:${walletPrivacy(w.name, platform ?? "").level}`).join(", "),
    note: "catalogRevisedOn is the last edit, not a review of every wallet. Privacy labels/count use platform-specific evidence: full = available with shielded send and receive on the same selected platform (any confirmed platform if none selected); transparent requires explicit evidence; unknown/unavailable never imply transparent. Named wallets remain visible to explain platform uncertainty. Absent from allWallets = not catalogued, not nonexistent. Not an audit or endorsement; consult /wallets/find for source dates and limits.",
    filter: { platform, shielded, kind, names: named.map(({ w }) => w.name) },
    matched: matched.length,
    wallets: matched.map(row),
  };
}

const ALIASES: Record<string, string[]> = {
  brasil: ["brazil"],
  brazilian: ["brazil"],
  brasileira: ["brazil"],
  espanol: ["espanol", "spanish", "hispanic"],
  espanhol: ["spanish"],
  hispano: ["hispanic"],
  latam: ["latin"],
  latina: ["latin"],
  turkey: ["turkiye"],
  turquia: ["turkiye"],
  mexico: ["mexico"],
  venezuela: ["venezuela"],
  africa: ["africa"],
  asia: ["asia"],
  europe: ["europe"],
  europa: ["europe"],
  eua: ["united states"],
  usa: ["united states"],
  america: ["america"],
  russia: ["russia"],
  russian: ["russia"],
  korea: ["korea"],
  coreia: ["korea"],
  japao: ["japan"],
  india: ["india"],
  indonesia: ["indonesia"],
  nigeria: ["nigeria"],
  ghana: ["ghana"],
  tanzania: ["tanzania"],
  ukraine: ["ukraine"],
  ucrania: ["ukraine"],
  china: ["china"],
  germany: ["germany"],
  alemanha: ["germany"],
  france: ["france"],
  franca: ["france"],
  spain: ["spain"],
  espanha: ["spain"],
  arabia: ["arabia", "mena"],
  arabic: ["arabia"],
  portugues: ["portuguese"],
  ambassador: ["ambassador"],
  embaixador: ["ambassador"],
  global: ["global"],
};
/** Words that name the ZecHub DAO itself, not a community. */
const DAO_WORDS = new Set(["zechub", "dao", "daodao"]);
/** Question words that name no community, including the Portuguese and Spanish forms Zarvis is asked in. */
const COMMUNITY_NOISE = new Set(
  "community communities comunidade comunidades group groups grupo grupos zcash there any which what quais qual by are exist existem funded funds fund funding financia financiam financian financiou financiaram financiaron financiada financiadas financiado financiados zcg grant grants receive recebem list lista sao pela pelo pelos pelas la las el los del al".split(
    " ",
  ),
);
const forum = (id: number) => `https://forum.zcashcommunity.com/t/${id}`;
const FORUM_TOPICS = 2;
/** Latest DAO grants spelled out per row; older ones are listed by ref only. */
const DAO_GRANTS = 2;
/** Grant detail only for the best matches of a focused question (at most this many); broad lists keep the flag, DAO questions the latest grant, so more rows fit. */
const FOCUSED_ROWS = 3;
type DaoDetail = "none" | "flag" | "latest" | "full";
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
/** "A178 Oct–Nov 2026: $5,800; $1,500 paid, $4,300 outstanding"; a dated copy standing in for a live sheet row says so. */
const daoGrantLine = (g: DaoGrant, source: DaoSource) => {
  const payout = g.payout === "unlisted" ? [] : [g.paidUsd !== undefined ? `${usd(g.paidUsd)} paid` : "", g.outstandingUsd ? `${usd(g.outstandingUsd)} outstanding` : ""].filter(Boolean);
  const dated = payout.length && source === "sheet" && g.payout === "fallback" ? ` (sheet as of ${g.sheetAsOf})` : "";
  return `${g.ref} ${g.period}: ${g.requested}${payout.length ? `; ${payout.join(", ")}${dated}` : ""}`;
};
interface DaoRowFields {
  zechubDaoFunded?: true;
  zechubDaoLatest?: string;
  zechubDaoGrants?: string;
  zechubDaoEarlierGrants?: string;
  zechubDaoNote?: string;
}
/** One string per field, not arrays: the serialized budget charges every array. */
const daoFields = (c: Community, source: DaoSource, detail: DaoDetail): DaoRowFields => {
  const grants = daoGrants(c.zcg);
  if (!grants.length || detail === "none") return {};
  if (detail === "flag") return { zechubDaoFunded: true };
  if (detail === "latest") return { zechubDaoFunded: true, zechubDaoLatest: daoGrantLine(grants.at(-1)!, source) };
  const earlier = grants.slice(0, -DAO_GRANTS).map((g) => g.ref);
  return {
    zechubDaoFunded: true,
    zechubDaoGrants: grants.slice(-DAO_GRANTS).map((g) => daoGrantLine(g, source)).join(" | "),
    ...(earlier.length ? { zechubDaoEarlierGrants: earlier.join(", ") } : {}),
    ...(c.zcg.zechubDao?.note ? { zechubDaoNote: c.zcg.zechubDao.note } : {}),
  };
};
/** Forum topics only for the focused rows (detail "full"): a list keeps its budget for more rows. */
const row = (c: Community, daoSource: DaoSource, detail: DaoDetail) => ({
  name: c.name,
  country: c.country,
  region: c.region,
  language: c.language,
  ...(c.since ? { since: c.since } : {}),
  about: c.about,
  zcgFunded: c.zcg.funded,
  ...(c.zcg.funded
    ? {
        zcgLedgerRecipient: c.zcg.recipient ?? null,
        zcgBudgetedUsd: c.zcg.budgetedUsd ?? null,
        ...(c.zcg.paidUsd !== undefined ? { zcgPaidUsd: c.zcg.paidUsd } : {}),
        zcgGrants: c.zcg.grants ?? null,
        lastPaidDate: c.zcg.lastPaid ?? null,
      }
    : {}),
  ...daoFields(c, daoSource, detail),
  ...(c.zcg.note ? { fundingNote: c.zcg.note } : {}),
  site: c.links.site ?? null,
  forumUser: c.links.forumUser ?? null,
  ...(detail === "full"
    ? {
        forumTopics: c.forumTopics
          .slice(0, FORUM_TOPICS)
          .map((t) => `${t.kind}: ${t.title} ${forum(t.id)}`),
      }
    : {}),
});
/** Without a ledger read: the curated directory with its dated fallback funding. */
const CURATED: CommunitiesFunding = { communities: COMMUNITIES, source: "fallback" };
/** The global-communities directory, filtered by name, country, region or language words; every name stays listed by region, ahead of the rows, so the serialized budget cuts rows first. Funding comes from the ledger overlay /communities uses (getCommunitiesFunding), or the dated fallback. */
export function communitiesContext(query: string, funding: CommunitiesFunding = CURATED) {
  const list = funding.communities;
  const daoSource: DaoSource = funding.dao?.source ?? "fallback";
  const words = [
    ...new Set(
      terms(normalize(query))
        .filter((t) => !COMMUNITY_NOISE.has(t))
        .flatMap((t) => [t, ...(ALIASES[t] ?? [])]),
    ),
  ];
  const isDao = (c: Community) => (c.zcg.zechubDao?.proposals.length ?? 0) > 0;
  // A whole word of a community's name, country, region or language ("ghana", "korean"), never a stray "la" or "financia".
  const identities = list.map((c) =>
    normalize(`${c.name} ${c.localName ?? ""} ${c.country} ${c.region} ${c.language} ${c.zcg.recipient ?? ""}`),
  );
  const namesCommunity = (t: string) =>
    identities.some((id) => new RegExp(`\\b${escape(t)}\\b`).test(id));
  const daoQuestion = /\bdao\b/.test(normalize(query));
  const naming = words.some((t) => !DAO_WORDS.has(t) && namesCommunity(t));
  // "Which communities does the ZecHub DAO fund?", in any language: the DAO words are the filter unless another word names a community.
  const daoOnly = daoQuestion && !naming;
  // "Does the ZecHub DAO fund Zcash Ghana?": the named community decides, so the DAO words do not rank ZecHub itself first.
  const keys = daoQuestion && naming ? words.filter((t) => !DAO_WORDS.has(t)) : words;
  const score = (c: Community) => {
    const hay = normalize(
      `${c.name} ${c.localName ?? ""} ${c.country} ${c.region} ${c.language} ${c.about} ${c.zcg.recipient ?? ""}`,
    );
    return keys.reduce((n, t) => n + Number(hay.includes(t)), 0);
  };
  const funded = /\b(?:funded|financiad\w*|grants?|zcg)\b/.test(
    normalize(query),
  );
  const ranked = list.map((c) => ({ c, s: score(c) }))
    .filter(({ c, s }) =>
      daoOnly
        ? isDao(c)
        : (keys.length ? s > 0 : true) &&
          (!funded || keys.length || c.zcg.funded),
    )
    .sort((a, b) => b.s - a.s);
  // Full DAO detail for the best-scoring rows of a named question ("Zcash Korea", "Club Zcash Querétaro"), never for a broad list.
  const best = ranked[0]?.s ?? 0;
  const focused = (s: number) =>
    keys.length > 0 && s === best && ranked.filter((r) => r.s === best).length <= FOCUSED_ROWS;
  const fundedOnly = funded && !keys.length && !daoOnly;
  const byRegion: Record<string, string> = {};
  for (const c of list)
    byRegion[c.region] = [byRegion[c.region], c.name]
      .filter(Boolean)
      .join(", ");
  return {
    verifiedOn: COMMUNITIES_VERIFIED_ON,
    totalCommunities: list.length,
    zcgFundedCommunities: list.filter((c) => c.zcg.funded).length,
    zechubDaoFundedCommunities: list.filter(isDao).length,
    fundingSource: funding.source,
    ...(funding.source === "fallback" ? { fallbackLedgerAsOf: LEDGER_FALLBACK_AS_OF } : {}),
    daoPayouts: `ZecHub treasury sheet of ${funding.dao?.sheetAsOf ?? DAO_SHEET_FALLBACK_AS_OF}${daoSource === "sheet" ? "" : ", dated copy"}`,
    allCommunitiesByRegion: byRegion,
    allZcgFunded: list.filter((c) => c.zcg.funded).map((c) => c.name).join(", "),
    allZechubDaoFunded: list.filter(isDao).map((c) => c.name).join(", "),
    note: "OpenZcash's curated community directory, links verified on verifiedOn. ZCG figures are read from the audited ZCG ledger, as on /zcg/recipients (fundingSource ledger); fundingSource fallback means the ledger was unreachable and the figures are the dated snapshot of fallbackLedgerAsOf, not current: say so. zcgBudgetedUsd is budgeted USD, not paid (zcgPaidUsd is the settled part); zcgFunded false means no ledger rows, not that the group is unfunded elsewhere (see fundingNote). zechubDao*: ZecHub DAO grants, paid per daoPayouts (dated copy: say so). allZcgFunded and allZechubDaoFunded name every community on each channel (some are on both), even when the rows are a subset. Social links, live forum and YouTube activity are on https://openzcash.org/communities, not in this excerpt. A group absent from allCommunitiesByRegion is not in the directory.",
    filter: { words: keys, fundedOnly },
    matched: ranked.length,
    // A ZCG-only list (fundedOnly) answers a ZCG question: no DAO fields; a DAO question gets each row's latest grant.
    communities: ranked.map(({ c, s }) => row(c, daoSource, focused(s) && !daoOnly ? "full" : daoQuestion ? "latest" : fundedOnly ? "none" : "flag")),
  };
}
