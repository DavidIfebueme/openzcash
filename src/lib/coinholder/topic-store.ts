import "server-only";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { coinholderTopicCache as t } from "@/lib/db/schema";
import type { TopicAnalysis } from "./proposal-topics";
import { topicAnalysisSchema } from "./topic-model";

export interface TopicStore {
  read(hashes: string[]): Promise<Map<string, TopicAnalysis>>;
  claim(hash: string, number: number, lease: string, at: number): Promise<boolean>;
  complete(hash: string, lease: string, analysis: TopicAnalysis | null, at: number): Promise<boolean>;
}
const timeout = (tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) => tx.execute(sql`set local statement_timeout = '3000ms'`);
export const topicStore: TopicStore = {
  async read(hashes) {
    if (!hashes.length) return new Map();
    return getDb().transaction(async (tx) => {
      await timeout(tx);
      const rows = await tx.select({ hash: t.inputHash, analysis: t.analysis }).from(t).where(inArray(t.inputHash, hashes));
      const result = new Map<string, TopicAnalysis>();
      for (const row of rows) {
        const parsed = topicAnalysisSchema.safeParse(row.analysis);
        if (parsed.success) result.set(row.hash, parsed.data);
      }
      return result;
    });
  },
  async claim(hash, number, lease, at) {
    return getDb().transaction(async (tx) => {
      await timeout(tx);
      const now = new Date(at), until = new Date(at + 120_000);
      const claimed = await tx.insert(t).values({ inputHash: hash, proposalNumber: number, leaseId: lease, leaseUntil: until, retryAfter: now, attempts: 1, updatedAt: now })
        .onConflictDoUpdate({ target: t.inputHash,
          set: { leaseId: lease, leaseUntil: until, attempts: sql`${t.attempts} + 1`, updatedAt: now },
          setWhere: and(isNull(t.analysis), lte(t.retryAfter, now), or(isNull(t.leaseUntil), lte(t.leaseUntil, now))),
        }).returning({ hash: t.inputHash });
      return claimed.length === 1;
    });
  },
  async complete(hash, lease, analysis, at) {
    return getDb().transaction(async (tx) => {
      await timeout(tx);
      const now = new Date(at);
      const rows = await tx.update(t).set({ analysis, leaseId: null, leaseUntil: null, updatedAt: now,
        retryAfter: analysis ? now : sql`${now.toISOString()}::timestamptz + make_interval(secs => least(86400, 300 * power(2, least(${t.attempts} - 1, 9)))::double precision)`,
      }).where(and(eq(t.inputHash, hash), eq(t.leaseId, lease), gte(t.leaseUntil, now))).returning({ hash: t.inputHash });
      return rows.length === 1;
    });
  },
};
