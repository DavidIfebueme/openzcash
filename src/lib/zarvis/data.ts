import "server-only";
import { z } from "zod";
import { terms } from "./sources";
import { boundedRead } from "./timeout";
import type { ZarvisSource } from "./types";
import type { Catalog } from "@/lib/ecosystem/types";
import { valueReportedDevFund, type DevFundReportedData } from "@/lib/treasury/dev-fund";
import { BLOCK_SUBSIDY_ZEC, LOCKBOX_ZEC_PER_BLOCK, MINER_ZEC_PER_BLOCK, THIRD_HALVING_HEIGHT, ZCG_ZEC_PER_BLOCK } from "@/lib/zcash/lockbox";

export const lookupSchema = z.object({
  topic: z.enum(["mining", "price", "treasuries", "markets", "grants", "recipients", "disbursements", "proposals", "decisions", "coinholder", "zechub", "ecosystem", "wallets", "communities", "arborist", "news", "forum", "zechub_dao", "funding_history", "price_history", "chain", "site", "meetings", "elections", "totals", "schedule", "investments", "governance", "monthly"]),
  query: z.string().max(120),
}).strict();
export const lookupTool = {
  type: "function" as const, name: "lookup_openzcash",
  description: "Read current public OpenZcash records with source dates. Use mining for the current network solrate estimate from ZcashInfo (20-block average with heights, block timestamps and freshness, not historical or pool-share data). Use price for the current ZEC/USD quote, including its timestamp and freshness. Use markets for market volumes, trading venues, supply and public holdings, not the simple ZEC price. Use chain for the current block height, next-halving height/estimated date and node supply pools (shielded/transparent/lockbox) with their times. Use price_history for dated Bitfinex daily closes (query a day, month or year such as 2026-01); it ends at the dataset's through date. Use arborist for Zcash Arborist engineering calls: number, meeting date, moderator, agenda, notes and recording links (query a call number, month or agenda word). Use wallets for the curated wallet catalog with platforms and shielded level (query a name, platform or level) and communities for the global community directory with country, language and ZCG funding (query a name, country or region); both carry revision dates. Use forum to search the Zcash Community Forum (Discourse): thread titles, authors, dates and post excerpts for the query words, or the first post and early replies of one thread when the query is a forum URL or topic number; posts are third-party announcements, questions and opinions, never decisions. Use zechub_dao for ZecHub DAO on-chain proposals with status, date and vote tallies (query a proposal number such as A161, a status word or title words). Use decisions for dated ZCG/coinholder verdicts (approved, rejected, filtered, vetoed, withdrawn) with application and minutes links (query an outcome, year, program or title); proposals returns only applications currently under review. Use site to search local documentation/methodology/ceremony pages, meetings/elections for ZCG governance, totals for published pivots, schedule for future payments, investments for Maya transfers, governance for dated protocol records, monthly for published reading sets; site for indexed PDF/document excerpts. Other topics cover treasury balances, ZCG grants, recipients, news and the ecosystem. The proposals and decisions topics contain funding applications to ZCG, NOT Zcash Improvement Proposals (ZIPs). Use site for indexed ZIP document snapshots. Current protocol status still requires official-source verification. query: optional short name, number, date or filter word to narrow records, or empty for overview. Results may be partial. Does not access private wallets, private records, user pages or arbitrary URLs.",
  strict: true,
  parameters: {
    type: "object", properties: {
      topic: { type: "string", enum: lookupSchema.shape.topic.options },
      query: { type: "string", description: "Project, grant, recipient, wallet or community name, call number, date (2026-01), outcome or platform word, forum subject words or a forum topic URL/number, DAO proposal number, or empty string" },
    }, required: ["topic", "query"], additionalProperties: false,
  },
};
export const links: Record<z.infer<typeof lookupSchema>["topic"], string> = {
  mining: "https://api.zcashinfo.com/api/v1/mining/overview", price: "/api/zec-price", treasuries: "/zcg/treasury-calculator", markets: "/zec-observatory",
  grants: "/api/zcg/data/grants", recipients: "/api/zcg/data/recipients",
  disbursements: "/api/zcg/data/disbursements", proposals: "/api/zcg/office", decisions: "/zcg/participate?view=history",
  coinholder: "/api/zcg/coinholder/round", zechub: "/api/zechub/treasury",
  ecosystem: "/api/ecosystem", wallets: "/wallets/find", communities: "/communities", arborist: "/arborist",
  news: "/news", forum: "https://forum.zcashcommunity.com", zechub_dao: "https://daodao.zone/dao/juno1nktrulhakwm0n3wlyajpwxyg54n39xx4y8hdaqlty7mymf85vweq7m6t0y", funding_history: "/api/funding/history", price_history: "/funding-history", chain: "/zec-observatory",
  site: "/zcg/methodology", meetings: "/zcg/meetings", elections: "/zcg/committee", totals: "/zcg/totals",
  schedule: "/zcg/schedule", investments: "/zcg/investments", governance: "/governance", monthly: "/monthly",
};

/** Directory and history topics return short pre-filtered rows, so they may show more than the default six. */
const ROW_LIMITS: Partial<Record<z.infer<typeof lookupSchema>["topic"], number>> = { wallets: 24, communities: 10, arborist: 8, decisions: 10, price_history: 40, forum: 8, zechub_dao: 12 };
/** The directories carry their whole inventory ahead of the rows, so they get room for several rows after it. */
const CHAR_BUDGETS: Partial<Record<z.infer<typeof lookupSchema>["topic"], number>> = { wallets: 7_000, communities: 7_000, forum: 7_000 };
export const charBudget = (topic: z.infer<typeof lookupSchema>["topic"]) => CHAR_BUDGETS[topic] ?? 5_000;
export const rowLimit = (topic: z.infer<typeof lookupSchema>["topic"]) => ROW_LIMITS[topic] ?? 6;
/** A hard serialized budget, with dates/units preserved ahead of long record arrays. */
export function compactData(data: unknown, query = "", charBudget = 5_000, rowLimit = 6) {
  let remaining = Math.max(0, charBudget - 320);
  let partial = false;
  const tokens = terms(query);
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  // "unit" must not catch "communities", and an "allX" inventory key is provenance too.
  const provenance = (key: string) => /(?:date|time|at$|stale|height|block|note|interpretation|^units?$|total|checked|snapshot|source|status|revised|verified|through)/i.test(key) || /^all[A-Z]/.test(key);
  function relevance(value: unknown) {
    const body = normalize(JSON.stringify(value, (_, x) => typeof x === "bigint" ? x.toString() : x) ?? "");
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const title = normalize([row.name, row.title, row.fullName, row.id].filter((v) => typeof v === "string").join(" "));
    return tokens.reduce((score, token) => score + Number(body.includes(token)) + 4 * Number(title.includes(token)), 0);
  }
  function visit(value: unknown, depth: number): unknown {
    if (remaining < 100 || depth > 9) { partial = true; return undefined; }
    if (typeof value === "bigint") value = value.toString();
    if (value instanceof Date) value = value.toISOString();
    if (value === null || typeof value === "boolean" || typeof value === "number") { remaining -= 30; return value; }
    if (typeof value === "string") {
      let text = value.length > 1000 ? `${value.slice(0, 980)} [truncated]` : value;
      while (JSON.stringify(text).length > remaining - 10 && text.length > 20) text = `${text.slice(0, Math.floor(text.length / 2))} [truncated]`;
      partial ||= text !== value;
      remaining -= JSON.stringify(text).length + 10;
      return text;
    }
    if (Array.isArray(value)) {
      remaining -= 100;
      const scored = tokens.length ? value.map((v, i) => ({ v, i, score: relevance(v) })).sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.v) : value;
      const shown: unknown[] = [];
      for (const row of scored.slice(0, rowLimit)) {
        const item = visit(row, depth + 1);
        if (item === undefined) break;
        // A row the budget could only partly serialize is dropped and counted, never shown as an empty record.
        if (row && typeof row === "object" && !Array.isArray(row) && item && typeof item === "object" && Object.keys(item).length < Object.values(row as Record<string, unknown>).filter((v) => v !== undefined).length) { partial = true; break; }
        shown.push(item);
      }
      partial ||= value.length > shown.length;
      return { totalRows: value.length, shown, subset: value.length > shown.length };
    }
    if (value && typeof value === "object") {
      remaining -= 4;
      const output: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => Number(provenance(b)) - Number(provenance(a)));
      for (const [key, item] of entries) {
        if (item === undefined) continue;
        if (remaining < key.length + 120) { partial = true; break; }
        remaining -= JSON.stringify(key).length + 4;
        const selected = visit(item, depth + 1);
        if (selected !== undefined) output[key] = selected;
      }
      return output;
    }
    remaining -= 4;
    return null;
  }
  const result = { data: visit(data, 0) ?? null, partial: false, note: "Arrays may be ranked excerpts, not exhaustive matches. Never total a subset. Tool time is not the reporting date." };
  result.partial = partial;
  return result;
}

/** Put snapshot provenance before excerpts so context truncation cannot hide its age. */
export function ecosystemContext({ registry, snapshot }: Catalog) {
  return {
    registryCheckedAt: registry.checkedAt,
    repositorySnapshotAt: snapshot.collectedAt,
    totals: { projects: registry.projects.length, organizations: registry.organizations.length, repositories: snapshot.repositories.length, selectedRepositories: snapshot.selectedRepositoryCount },
    coverageNotes: registry.coverageNotes,
    collectionProblems: snapshot.problems,
    projects: registry.projects,
    repositories: snapshot.repositories.map(({ fullName, url, description, archived, disabled, pushedAt, activity }) => ({
      fullName, url, description, archived, disabled, pushedAt,
      activityCheckedAt: activity?.checkedAt ?? null,
      latestRelease: activity?.latestRelease ?? null,
    })),
    organizations: registry.organizations,
    note: "Checked public snapshots, not live GitHub activity. Use the snapshot dates above; excerpts are not the complete ecosystem.",
  };
}

/** Keep a block-accrued estimate separate from the date of its source anchor. */
export function treasuryContext(funds: DevFundReportedData) {
  const lockbox = funds.lockbox;
  return {
    zcg: funds.zcg ? {
      ...funds.zcg,
      interpretation: "zec and cashUsd are reported holdings at snapshotAt. cashUsd is USD cash, not grant spending and not a converted ZEC value. paidMilestonesUsd is cumulative historical spending, not available cash.",
    } : null,
    lockbox: lockbox ? {
      estimatedZec: lockbox.zec,
      estimateThroughBlock: lockbox.height,
      sourceAnchorBlock: lockbox.baselineHeight,
      sourceAnchorDate: lockbox.snapshotAt,
      importedAt: lockbox.importedAt,
      updatesRequired: lockbox.updatesRequired,
      sourceUrl: lockbox.sourceUrl,
      interpretation: "estimatedZec adds scheduled block accruals since the source anchor. It is an estimate through estimateThroughBlock, NOT a balance reported at sourceAnchorDate. This is not a fresh wallet-balance reading; later outflows may require reconciliation.",
    } : null,
  };
}

/** The footer's arithmetic on the reported figures as typed facts, so an answer quoting it is verifiable; never zero for missing data. */
export function derivedTreasuryFacts(funds: DevFundReportedData, price: { cents: number } | null, supply: { zec: number } | null) {
  const usd = price && Number.isInteger(price.cents) && price.cents > 0 ? price.cents / 100 : null;
  const zcgZec = funds.zcg?.zec ?? null, cash = funds.zcg?.cashUsd ?? null, lockboxZec = funds.lockbox?.zec ?? null;
  const value = (zec: number | null) => usd !== null && zec !== null && zec >= 0 ? Math.round(zec * usd * 100) / 100 : null;
  const sum = (a: number | null, b: number | null) => a === null || b === null ? null : Math.round((a + b) * 100) / 100;
  const share = (part: number | null, whole: number | null) => part === null || whole === null || !(whole > 0) ? null : Math.round(part / whole * 10_000) / 100;
  const zcgValueUsd = value(zcgZec), lockboxValueUsd = value(lockboxZec), zcgTotalUsd = sum(zcgValueUsd, cash);
  const combinedZec = zcgZec === null || lockboxZec === null ? null : zcgZec + lockboxZec;
  const combinedGrossValueUsd = usd === null ? null : valueReportedDevFund(funds, usd);
  const supplyZec = supply && Number.isFinite(supply.zec) && supply.zec > 0 ? supply.zec : null;
  return {
    zcgValueUsd, zcgTotalUsd, lockboxValueUsd, combinedZec, combinedZecValueUsd: sum(zcgValueUsd, lockboxValueUsd), combinedGrossValueUsd,
    zcgShareOfCombinedPercent: share(zcgZec, combinedZec), lockboxShareOfCombinedPercent: share(lockboxZec, combinedZec),
    zcgShareOfGrossValuePercent: share(zcgTotalUsd, combinedGrossValueUsd), lockboxShareOfGrossValuePercent: share(lockboxValueUsd, combinedGrossValueUsd),
    zcgShareOfSupplyPercent: share(zcgZec, supplyZec), lockboxShareOfSupplyPercent: share(lockboxZec, supplyZec), combinedShareOfSupplyPercent: share(combinedZec, supplyZec),
    note: "Site arithmetic at the market quote: each pool's ZEC × price rounded to cents, like the footer; gross value adds ZCG cash. Not spendable cash and not one pool. Shares of supply use the quoted circulating supply.",
  };
}
const percent = (zec: number) => Math.round(zec / BLOCK_SUBSIDY_ZEC * 100);
export const BLOCK_SUBSIDY_ALLOCATION = {
  blockSubsidyZec: BLOCK_SUBSIDY_ZEC, zcgPerBlockZec: ZCG_ZEC_PER_BLOCK, lockboxPerBlockZec: LOCKBOX_ZEC_PER_BLOCK, minerPerBlockZec: MINER_ZEC_PER_BLOCK,
  zcgPercent: percent(ZCG_ZEC_PER_BLOCK), lockboxPercent: percent(LOCKBOX_ZEC_PER_BLOCK), devFundPercent: percent(ZCG_ZEC_PER_BLOCK + LOCKBOX_ZEC_PER_BLOCK), minerPercent: percent(MINER_ZEC_PER_BLOCK),
  untilBlock: THIRD_HALVING_HEIGHT, note: "ZIP 1015 block-subsidy split in force through the third halving: protocol rules, not balances.",
};

async function readPublicData(topic: z.infer<typeof lookupSchema>["topic"], query: string, signal: AbortSignal): Promise<unknown> {
  // Explicit handlers only: no tool-controlled imports, hostnames, SQL or paths.
  if (topic === "mining") return (await import("./mining")).readMiningSnapshot(signal);
  const request = new Request(`https://openzcash.org${links[topic]}${query ? `?search=${encodeURIComponent(query)}` : ""}`);
  switch (topic) {
    case "site": { const { searchKnowledge, knowledgeCoverage } = await import("./knowledge"); return { coverage: knowledgeCoverage, documents: searchKnowledge(query, 5, 5000), note: "Reviewed references and static site documentation excerpts, not current account balances. Navigation labels do not establish page contents. Source revisions do not establish reporting dates." }; }
    case "meetings": return { meetings: await (await import("@/lib/zcg/governance-repo")).getMeetings() };
    case "elections": return { elections: await (await import("@/lib/zcg/governance-repo")).getElections() };
    case "totals": { const { grandTotal, categoryTotals } = await import("@/lib/zcg/totals-repo"); return { sheetTotals: await grandTotal(), categories: await categoryTotals(), note: "Published spreadsheet pivots, not ledger-derived annual payment totals. Do not add overlapping totals and categories." }; }
    case "schedule": return (await import("@/lib/zcg/schedule-repo")).getPaymentSchedule();
    case "investments": { const { mayaTransfers } = await import("@/lib/zcg/snapshots-repo"); return { transfers: await mayaTransfers(), note: "Reported Maya transfers, not present-day investment value or return." }; }
    case "governance": { const { default: record } = await import("@/data/governance/record.json"); const { UPGRADES, PENDING_TOPICS } = await import("@/lib/governance/upgrades"); return { record, upgrades: UPGRADES.map((item)=>({ ...item, topics: undefined })), pending: PENDING_TOPICS.map((item)=>({ ...item, topics: undefined })), note: "The site's dated governance record. Check official sources for changes since its reporting dates." }; }
    case "monthly": return { readingSets: (await import("@/lib/monthly/catalog")).monthlyReadingSets, note: "Published report metadata and reading sets. Partial periods are not full calendar months. This lookup does not extract full PDF contents." };
    case "price": return (await (await import("@/app/api/zec-price/route")).GET()).json();
    case "treasuries": {
      const [{ reportedDevFundData }, { currentZecUsdQuote }, { currentZecCirculatingSupply }] = await Promise.all([
        import("@/lib/treasury/dev-fund-data"), import("@/lib/pricing/live-price"), import("@/lib/pricing/circulating-supply"),
      ]);
      const [funds, price, supply] = await Promise.all([reportedDevFundData(), currentZecUsdQuote(), currentZecCirculatingSupply()]);
      return { funds: treasuryContext(funds), derived: derivedTreasuryFacts(funds, price, supply), allocation: BLOCK_SUBSIDY_ALLOCATION, price, supply, units: "funds: ZEC and USD; price.cents: USD cents per ZEC; supply.zec: ZEC", note: "The market quote is separate from the source report: do not call it the report price. Preserve reporting dates, estimate block, quote time and stale flags. ZCG and Lockbox have separate spending restrictions." };
    }
    case "markets": return (await (await import("@/app/api/markets/route")).GET()).json();
    case "grants": return (await (await import("@/app/api/zcg/data/grants/route")).GET(request)).json();
    case "recipients": return (await (await import("@/app/api/zcg/data/recipients/route")).GET(request)).json();
    case "disbursements": return (await (await import("@/app/api/zcg/data/disbursements/route")).GET(request)).json();
    case "proposals": return (await (await import("@/app/api/zcg/office/route")).GET()).json();
    case "coinholder": return (await (await import("@/app/api/zcg/coinholder/round/route")).GET()).json();
    case "zechub": return (await (await import("@/app/api/zechub/treasury/route")).GET()).json();
    case "ecosystem": return ecosystemContext((await import("@/lib/ecosystem/data")).loadEcosystemCatalog());
    case "news": {
      const { getNews, newsFetchedAt } = await import("@/lib/news/feed");
      const items = await getNews();
      return { items, feedFetchedAt: newsFetchedAt(), note: "Feed headlines are not full articles. Community posts are not official protocol decisions." };
    }
    case "funding_history": return (await (await import("@/app/api/funding/history/route")).GET(request)).json();
    case "price_history": { const { default: days } = await import("@/data/funding/days.json"); return (await import("./chain")).priceHistoryContext(query, days as unknown as import("./chain").DaysDoc); }
    case "chain": {
      const [{ cachedChainTip }, { chainSupplyFeed }, { currentZecCirculatingSupply }, { chainContext }] = await Promise.all([import("@/lib/zcash/lockbox-live"), import("@/lib/markets/sources"), import("@/lib/pricing/circulating-supply"), import("./chain")]);
      const [height, supply, circulating] = await Promise.all([cachedChainTip().catch(() => 0), chainSupplyFeed().catch(() => null), currentZecCirculatingSupply().catch(() => null)]);
      return chainContext({ height: height > 0 ? height : null, readAt: new Date().toISOString(), supply: supply?.data ? { ...supply.data, fetchedAt: supply.fetchedAt, stale: supply.stale } : null, circulating });
    }
    case "arborist": { const { getArboristCalls, arboristFetchedAt, ARBORIST_REPO_URL, ARBORIST_YOUTUBE_URL } = await import("@/lib/arborist/notes"); return (await import("./arborist")).arboristContext(await getArboristCalls(), query, { fetchedAt: arboristFetchedAt(), repository: ARBORIST_REPO_URL, recordings: ARBORIST_YOUTUBE_URL }); }
    case "forum": return (await import("./forum")).forumContext(query, signal);
    case "zechub_dao": { const { getZechubProposals, ZECHUB_DAO_URL } = await import("@/lib/dao/zechub"); return (await import("./dao")).daoContext(await getZechubProposals(50), query, { url: ZECHUB_DAO_URL, fetchedAt: new Date().toISOString() }); }
    case "wallets": return (await import("./directory")).walletsContext(query);
    case "communities": {
      const [{ communitiesContext }, { getCommunitiesFunding }] = await Promise.all([import("./directory"), import("@/lib/communities/funding")]);
      return communitiesContext(query, await getCommunitiesFunding());
    }
    case "decisions": {
      const [{ listProposals }, { getMeetings }, { listGrants }, { cached, LEDGER_TTL_MS }, { publicationDay }, { decisionsContext }] = await Promise.all([import("@/lib/zcg/proposals-repo"), import("@/lib/zcg/governance-repo"), import("@/lib/zcg/grants-repo"), import("@/lib/cache/memo"), import("@/lib/zcg/publication-policy"), import("./decisions")]);
      const day = publicationDay();
      // Minutes and grant pages are enrichment: a failed reader is reported, never silently shown as absent links.
      const unavailable: string[] = [];
      const soft = <T,>(name: string, read: Promise<T[]>) => read.catch((): T[] => { unavailable.push(name); return []; });
      const [proposals, meetings, grants] = await Promise.all([cached(`listProposals:all:${day}`, LEDGER_TTL_MS, () => listProposals({})), soft("meetings", getMeetings()), soft("grants", cached("grants:list", LEDGER_TTL_MS, () => listGrants()))]);
      return decisionsContext(proposals, meetings, grants.map((g) => g.grantKey), query, { publishedThrough: day, unavailable });
    }
  }
}

export async function lookupPublicData(args: unknown, signal: AbortSignal): Promise<{ content: string; source?: ZarvisSource }> {
  const parsed = lookupSchema.safeParse(args);
  if (!parsed.success) return { content: JSON.stringify({ error: "Unsupported public-data lookup." }) };
  const { topic, query } = parsed.data;
  const url = links[topic].startsWith("https://") ? links[topic] : `https://openzcash.org${links[topic]}`;
  try {
    signal.throwIfAborted();
    const data = await boundedRead(() => readPublicData(topic, query, signal), signal);
    signal.throwIfAborted();
    const retrievedAt = new Date().toISOString();
    let ledgerImportedAt: string | null | undefined;
    if (["grants", "recipients", "disbursements"].includes(topic)) {
      try { ledgerImportedAt = (await (await import("@/lib/zcg/freshness")).latestImportAt())?.toISOString() ?? null; } catch { ledgerImportedAt = null; }
    }
    return { content: JSON.stringify({ sourceUrl: url, retrievedAt, ledgerImportedAt, ...compactData(data, query, charBudget(topic), rowLimit(topic)) }), source: { title: topic === "mining" ? "ZcashInfo · mining snapshot" : topic === "forum" ? "Zcash Community Forum" : topic === "zechub_dao" ? "ZecHub DAO · DAO DAO" : `OpenZcash · ${topic.replaceAll("_", " ")}`, url, retrievedAt } };
  } catch {
    signal.throwIfAborted();
    return { content: JSON.stringify({ sourceUrl: url, error: "Public data temporarily unavailable. Do not invent current figures; direct the user to this page." }) };
  }
}
