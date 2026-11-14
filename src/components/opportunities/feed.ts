import { type CatalogItem, type SourceState, platformFor } from "./catalog";
import { suggestedCover } from "./covers";
import { validCountry, validLanguage } from "./locales";

type JsonObject = Record<string, unknown>;
const object = (v: unknown): JsonObject => v && typeof v === "object" && !Array.isArray(v) ? v as JsonObject : {};
const string = (v: unknown, max = 1000) => typeof v === "string" ? v.trim().slice(0, max) : "";
export function normalizeBounty(value: unknown, checkedAt: string, now = Date.now()): CatalogItem | null {
  const row = object(value);
  const id = string(row.id, 100);
  const title = string(row.title, 240);
  const deadline = string(row.timeToComplete, 40);
  // Only public, approved, unassigned mainnet listings. Never infer eligibility
  // from a participant's profile or expose the raw API object to the client.
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !title || row.chain !== "MAIN" || row.isPrivate !== false || row.isApproved !== true) return null;
  if (!["TO_DO", "IN_PROGRESS"].includes(String(row.status)) || row.assignee || (Array.isArray(row.assignees) && row.assignees.length) || row.suggestionReviewStatus) return null;
  if (deadline && (!Number.isFinite(Date.parse(deadline)) || Date.parse(deadline) <= now)) return null;
  const amount = typeof row.bountyAmount === "number" ? row.bountyAmount : typeof row.bountyAmount === "string" && row.bountyAmount.trim() ? Number(row.bountyAmount) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  const category = string(row.categoryId, 100) || "Contribution";
  const description = string(row.description, 18000);
  const summary = description.replace(/<[^>]*>/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 170);
  const categoryCover = /design/i.test(category) ? "Design" : /writing|research/i.test(category) ? "Content" : "Development";
  return {
    id: `zec-${id}`, provider: "zec-bounties", title, summary: summary || "Read the scope and requirements on ZEC Bounties.", description,
    kind: "Bounty", category, organizer: string(object(row.team).name, 120) || "ZEC Bounties",
    art: suggestedCover(categoryCover, title), sourceUrl: `https://bounties.zechub.wiki/bounties/${id}`, actionUrl: `https://bounties.zechub.wiki/bounty/${id}`, actionLabel: "View on ZEC Bounties",
    rewardLabel: `${amount.toLocaleString("en-US", { maximumFractionDigits: 8 })} ZEC`, rewardZec: amount,
    deadline: deadline || undefined, language: validLanguage(row.language) ? row.language : undefined, country: validCountry(row.country) ? row.country : undefined,
    sourceUpdatedAt: typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt)) ? row.updatedAt : undefined,
    checkedAt, status: "Listed", steps: platformFor("zec-bounties").steps,
  };
}
export type FetchJson = (url: string) => Promise<unknown>;
export async function loadBounties(fetchJson: FetchJson, now = Date.now()): Promise<{ items: CatalogItem[]; source: SourceState }> {
  const checkedAt = new Date(now).toISOString();
  const items = new Map<string, CatalogItem>();
  let partial = false;
  const readPage = async (page: number) => {
    const body = object(await fetchJson(`https://zechub.zone/api/bounties?page=${page}&limit=50&chain=MAIN`));
    if (!Array.isArray(body.data) || typeof body.total !== "number" || !Number.isFinite(body.total) || body.total < 0 || body.page !== page || body.limit !== 50) throw new Error("Invalid bounty feed");
    for (const row of body.data) {
      const item = normalizeBounty(row, checkedAt, now);
      if (item) items.set(item.id, item);
    }
    return body.total;
  };
  try {
    const total = await readPage(1);
    const pages = Math.min(Math.ceil(total / 50), 40);
    partial = total > 2000;
    for (let first = 2; first <= pages; first += 4) {
      const results = await Promise.allSettled(Array.from({ length: Math.min(4, pages - first + 1) }, (_, i) => readPage(first + i)));
      if (results.some((r) => r.status === "rejected")) { partial = true; break; }
    }
    return { items: [...items.values()], source: { id: "zec-bounties", status: partial ? "partial" : "available", checkedAt } };
  } catch {
    return { items: [], source: { id: "zec-bounties", status: "unavailable", checkedAt } };
  }
}
