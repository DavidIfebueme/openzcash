import "server-only";
import { z } from "zod";
import { terms } from "./sources";
import type { ZarvisSource } from "./types";
import type { Catalog } from "@/lib/ecosystem/types";
import type { DevFundReportedData } from "@/lib/treasury/dev-fund";

export const lookupSchema = z.object({
  topic: z.enum(["treasuries", "markets", "grants", "recipients", "disbursements", "proposals", "coinholder", "zechub", "ecosystem", "news", "funding_history"]),
  query: z.string().max(120),
}).strict();
export const lookupTool = {
  type: "function" as const, name: "lookup_openzcash",
  description: "Read current public OpenZcash records with source dates. Use for amounts, balances, grants, recipients, proposals, prices, news and the ecosystem. query: optional short project/person name to narrow records, or empty for overview. Results may be partial. Does not access wallets, private records, user pages or arbitrary URLs.",
  strict: true,
  parameters: {
    type: "object", properties: {
      topic: { type: "string", enum: lookupSchema.shape.topic.options },
      query: { type: "string", description: "Project, grant or recipient name, or empty string" },
    }, required: ["topic", "query"], additionalProperties: false,
  },
};
const links: Record<z.infer<typeof lookupSchema>["topic"], string> = {
  treasuries: "/zcg/treasury-calculator", markets: "/zec-observatory",
  grants: "/api/zcg/data/grants", recipients: "/api/zcg/data/recipients",
  disbursements: "/api/zcg/data/disbursements", proposals: "/api/zcg/office",
  coinholder: "/api/zcg/coinholder/round", zechub: "/api/zechub/treasury",
  ecosystem: "/api/ecosystem", news: "/news", funding_history: "/api/funding/history",
};

/** Bound arrays/strings while retaining the original object structure and dates. */
export function compactData(data: unknown, query = "", charBudget = 13_000) {
  let remaining = charBudget;
  let partial = false;
  const tokens = terms(query);
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  function relevance(value: unknown) {
    const body = normalize(JSON.stringify(value, (_, x) => typeof x === "bigint" ? x.toString() : x) ?? "");
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const title = normalize([row.name, row.title, row.fullName, row.id].filter((v) => typeof v === "string").join(" "));
    return tokens.reduce((score, token) => score + Number(body.includes(token)) + 4 * Number(title.includes(token)), 0);
  }
  function visit(value: unknown, depth: number): unknown {
    if (remaining <= 0 || depth > 9) { partial = true; return "[omitted: context limit]"; }
    if (typeof value === "bigint") return value.toString();
    if (value === null || typeof value === "boolean" || typeof value === "number") { remaining -= 24; return value; }
    if (typeof value === "string") {
      const max = Math.min(1_400, remaining);
      remaining -= Math.min(value.length, max);
      if (value.length > max) { partial = true; return `${value.slice(0, max)} [truncated]`; }
      return value;
    }
    if (Array.isArray(value)) {
      const scored = tokens.length ? value.map((v, i) => ({ v, i, score: relevance(v) })).sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.v) : value;
      const selected = scored.slice(0, 16);
      if (value.length > selected.length) partial = true;
      return { totalRows: value.length, shown: selected.map((v) => visit(v, depth + 1)), subset: value.length > selected.length };
    }
    if (typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, v]) => { remaining -= key.length + 6; return [key, visit(v, depth + 1)]; }));
    }
    return null;
  }
  const result = visit(data, 0);
  return { data: result, partial, note: "Arrays may be excerpts ranked by query, not exhaustive matches. Never treat a subset as a total. retrievedAt is tool time, not the underlying reporting date." };
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
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const data = await Promise.race([
      readPublicData(topic, query),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("timeout")), 12_000); }),
    ]).finally(() => clearTimeout(timeout));
    signal.throwIfAborted();
    const retrievedAt = new Date().toISOString();
    let ledgerImportedAt: string | null | undefined;
    if (["grants", "recipients", "disbursements"].includes(topic)) {
      try { ledgerImportedAt = (await (await import("@/lib/zcg/freshness")).latestImportAt())?.toISOString() ?? null; } catch { ledgerImportedAt = null; }
    }
    return { content: JSON.stringify({ sourceUrl: url, retrievedAt, ledgerImportedAt, ...compactData(data, query) }), source: { title: `OpenZcash · ${topic.replaceAll("_", " ")}`, url, retrievedAt } };
  } catch {
    return { content: JSON.stringify({ sourceUrl: url, error: "Public data temporarily unavailable. Do not invent current figures; direct the user to this page." }) };
  }
}
