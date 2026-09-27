import "server-only";
import { z } from "zod";
import { terms } from "./sources";
import { boundedRead } from "./timeout";
import type { ZarvisSource } from "./types";
import type { Catalog } from "@/lib/ecosystem/types";
import type { DevFundReportedData } from "@/lib/treasury/dev-fund";

export const lookupSchema = z.object({
  topic: z.enum(["price", "treasuries", "markets", "grants", "recipients", "disbursements", "proposals", "coinholder", "zechub", "ecosystem", "news", "funding_history", "site", "meetings", "elections", "totals", "schedule", "investments", "governance", "monthly"]),
  query: z.string().max(120),
}).strict();
export const lookupTool = {
  type: "function" as const, name: "lookup_openzcash",
  description: "Read current public OpenZcash records with source dates. Use price for the current ZEC/USD quote, including its timestamp and freshness. Use markets for market volumes, trading venues, supply and public holdings, not the simple ZEC price. Use site to search local documentation/methodology/ceremony pages, meetings/elections for ZCG governance, totals for published pivots, schedule for future payments, investments for Maya transfers, governance for dated protocol records, monthly for published reading sets; site for indexed PDF/document excerpts. Other topics cover treasury balances, ZCG grants, recipients, grant applications, news and the ecosystem. The proposals topic contains funding applications to ZCG, NOT Zcash Improvement Proposals (ZIPs). Use site for indexed ZIP document snapshots. Current protocol status still requires official-source verification. query: optional short project/person name to narrow records, or empty for overview. Results may be partial. Does not access wallets, private records, user pages or arbitrary URLs.",
  strict: true,
  parameters: {
    type: "object", properties: {
      topic: { type: "string", enum: lookupSchema.shape.topic.options },
      query: { type: "string", description: "Project, grant or recipient name, or empty string" },
    }, required: ["topic", "query"], additionalProperties: false,
  },
};
export const links: Record<z.infer<typeof lookupSchema>["topic"], string> = {
  price: "/api/zec-price", treasuries: "/zcg/treasury-calculator", markets: "/zec-observatory",
  grants: "/api/zcg/data/grants", recipients: "/api/zcg/data/recipients",
  disbursements: "/api/zcg/data/disbursements", proposals: "/api/zcg/office",
  coinholder: "/api/zcg/coinholder/round", zechub: "/api/zechub/treasury",
  ecosystem: "/api/ecosystem", news: "/news", funding_history: "/api/funding/history",
  site: "/zcg/methodology", meetings: "/zcg/meetings", elections: "/zcg/committee", totals: "/zcg/totals",
  schedule: "/zcg/schedule", investments: "/zcg/investments", governance: "/governance", monthly: "/monthly",
};

/** A hard serialized budget, with dates/units preserved ahead of long record arrays. */
export function compactData(data: unknown, query = "", charBudget = 5_000, rowLimit = 6) {
  let remaining = Math.max(0, charBudget - 320);
  let partial = false;
  const tokens = terms(query);
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const provenance = /(?:date|time|at$|stale|height|block|note|interpretation|unit|total|checked|snapshot|source|status)/i;
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
        shown.push(item);
      }
      partial ||= value.length > shown.length;
      return { totalRows: value.length, shown, subset: value.length > shown.length };
    }
    if (value && typeof value === "object") {
      remaining -= 4;
      const output: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => Number(provenance.test(b)) - Number(provenance.test(a)));
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

async function readPublicData(topic: z.infer<typeof lookupSchema>["topic"], query: string): Promise<unknown> {
  // Explicit handlers only: no tool-controlled imports, hostnames, SQL or paths.
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
      return { funds: treasuryContext(funds), price, supply, units: "funds: ZEC and USD; price.cents: USD cents per ZEC; supply.zec: ZEC", note: "The market quote is separate from the source report: do not call it the report price. Preserve reporting dates, estimate block, quote time and stale flags. ZCG and Lockbox have separate spending restrictions." };
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
  }
}

export async function lookupPublicData(args: unknown, signal: AbortSignal): Promise<{ content: string; source?: ZarvisSource }> {
  const parsed = lookupSchema.safeParse(args);
  if (!parsed.success) return { content: JSON.stringify({ error: "Unsupported public-data lookup." }) };
  const { topic, query } = parsed.data;
  const url = `https://openzcash.org${links[topic]}`;
  try {
    signal.throwIfAborted();
    const data = await boundedRead(() => readPublicData(topic, query), signal);
    signal.throwIfAborted();
    const retrievedAt = new Date().toISOString();
    let ledgerImportedAt: string | null | undefined;
    if (["grants", "recipients", "disbursements"].includes(topic)) {
      try { ledgerImportedAt = (await (await import("@/lib/zcg/freshness")).latestImportAt())?.toISOString() ?? null; } catch { ledgerImportedAt = null; }
    }
    return { content: JSON.stringify({ sourceUrl: url, retrievedAt, ledgerImportedAt, ...compactData(data, query) }), source: { title: `OpenZcash · ${topic.replaceAll("_", " ")}`, url, retrievedAt } };
  } catch {
    signal.throwIfAborted();
    return { content: JSON.stringify({ sourceUrl: url, error: "Public data temporarily unavailable. Do not invent current figures; direct the user to this page." }) };
  }
}
