import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte, lt, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { zcgDisbursements as d } from "@/lib/db/schema";
import { cachedPublic } from "./public-cache";
import { latestImportAt } from "@/lib/zcg/freshness";

export const ledgerQuerySchema=z.object({
  scope:z.enum(["zcg_grants","coinholder_grants","ic_payments","discretionary","monthly"]),
  year:z.number().int().min(2016).max(2100).nullable(),
  search:z.string().max(120),
}).strict();
export type LedgerQuery=z.infer<typeof ledgerQuerySchema>;
export type LedgerSummary={
  filters:LedgerQuery; importedAt:string|null; rows:number; paidEntries:number;
  budgetedUsdOfPaidEntries:string; recordedZecPaid:string;
  paidEntriesMissingUsd:number; paidEntriesMissingZec:number; paidEntriesWithoutDate:number;
  note:string;
};
export function decimalUnits(value:bigint, places:number):string {
  const sign=value<0n?"-":"";const n=value<0n?-value:value;const base=10n**BigInt(places);
  return `${sign}${n/base}.${(n%base).toString().padStart(places,"0")}`;
}
export async function queryLedger(raw:unknown):Promise<LedgerSummary> {
  const filters=ledgerQuerySchema.parse(raw);
  const conditions=[eq(d.sourceSheet,filters.scope==="zcg_grants"?"grants_disbursed":filters.scope),eq(d.isTest,false)];
  if(filters.search) {
    const term=`%${filters.search.replace(/[\\%_]/g,"\\$&")}%`;
    conditions.push(or(ilike(d.project,term),ilike(d.recipientNameRaw,term),ilike(d.milestoneLabel,term))!);
  }
  if(filters.year!==null)conditions.push(gte(d.paidOutDate,`${filters.year}-01-01`),lt(d.paidOutDate,`${filters.year+1}-01-01`));
  const importedAt = await latestImportAt();
  if (!importedAt) throw new Error("LEDGER_NOT_IMPORTED");
  const filterKey = createHash("sha256").update(JSON.stringify(filters)).digest("hex");
  const rows = await cachedPublic(`ledger:${importedAt.toISOString()}:${filterKey}`, 60_000, () => getDb().select({
      rows:sql<number>`count(*)::int`,
      paidEntries:sql<number>`count(*) filter (where ${d.isPaid})::int`,
      usd:sql<string>`coalesce(sum(${d.amountUsdCents}) filter (where ${d.isPaid}),0)::text`,
      zec:sql<string>`coalesce(sum(${d.zecDisbursedZat}) filter (where ${d.isPaid}),0)::text`,
      paidEntriesMissingUsd:sql<number>`count(*) filter (where ${d.isPaid} and ${d.amountUsdCents} is null)::int`,
      paidEntriesMissingZec:sql<number>`count(*) filter (where ${d.isPaid} and ${d.zecDisbursedZat} is null)::int`,
      paidEntriesWithoutDate:sql<number>`count(*) filter (where ${d.isPaid} and ${d.paidOutDate} is null)::int`,
    }).from(d).where(and(...conditions)));
  const row=rows[0];
  return {
    filters,importedAt:importedAt.toISOString(),rows:row.rows,paidEntries:row.paidEntries,
    budgetedUsdOfPaidEntries:decimalUnits(BigInt(row.usd),2),recordedZecPaid:decimalUnits(BigInt(row.zec),8),
    paidEntriesMissingUsd:row.paidEntriesMissingUsd,paidEntriesMissingZec:row.paidEntriesMissingZec,paidEntriesWithoutDate:row.paidEntriesWithoutDate,
    note:"Complete aggregate of the selected ledger population, not a sum of search excerpts. USD is the historical budgeted value of entries marked paid, not current value or bank settlement. ZEC is recorded disbursement, not verified on-chain delivery. Negative returned funds are preserved; test entries are excluded. Programs and operational worksheets are separate and must not be added blindly. Year filters use payment dates and omit undated entries. Import time is not source publication time.",
  };
}
export const ledgerTool={
  type:"function" as const,name:"query_openzcash_ledger",strict:true,
  description:"Calculate complete public-ledger payment totals by program, calendar year and optional project/recipient name. Use this for sums and comparisons; never sum truncated lookup excerpts. zcg_grants excludes coinholder grants and the separate operations/stipend worksheets. year null means all recorded years. A search is a literal name fragment, not the whole question.",
  parameters:{type:"object",properties:{scope:{type:"string",enum:ledgerQuerySchema.shape.scope.options},year:{type:["integer","null"],minimum:2016,maximum:2100},search:{type:"string"}},required:["scope","year","search"],additionalProperties:false},
};
