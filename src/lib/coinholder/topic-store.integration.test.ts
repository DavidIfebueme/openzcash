import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { topicStore as store } from "./topic-store";
import { TOPIC_ANALYSIS_VERSION, type TopicAnalysis } from "./proposal-topics";

const testUrl = process.env.COINHOLDER_TOPICS_TEST_DB_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.pathname !== "/openzcash_topics_test" || url.search)
    throw new Error("TOPIC_TEST_REQUIRES_DISPOSABLE_LOCAL_DB");
}
const at = Date.parse("2026-11-01T12:00:00Z");
const analysis: TopicAnalysis = { version: TOPIC_ANALYSIS_VERSION, model: "gpt-5-mini", analyzedAt: new Date(at).toISOString(), tags: [{ id: "wallets", confidence: 0.95, evidence: "We delivered a working wallet with shielded sending." }] };
describe.skipIf(!testUrl)("Coinholder topic persistence and leases", () => {
  let db: ReturnType<typeof postgres>;
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testUrl!);
    db = postgres(testUrl!, { max: 1 });
    await migrate(drizzle(db), { migrationsFolder: "./drizzle" });
  });
  beforeEach(async () => { await db`delete from coinholder_topic_cache`; });
  afterAll(async () => {
    await db?.end();
    const globalDb = globalThis as typeof globalThis & { __zecSql?: ReturnType<typeof postgres>; __zecDb?: unknown };
    await globalDb.__zecSql?.end(); delete globalDb.__zecSql; delete globalDb.__zecDb;
    vi.unstubAllEnvs();
  });
  it("allows one replica to analyze and makes the saved result durable", async () => {
    const claims = await Promise.all(Array.from({ length: 8 }, (_, i) => store.claim("revision", 71, `worker-${i}`, at)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    const winner = claims.indexOf(true);
    expect(await store.complete("revision", `worker-${winner}`, analysis, at + 1)).toBe(true);
    expect((await store.read(["revision"])).get("revision")).toEqual(analysis);
    expect(await store.claim("revision", 71, "new-worker", at + 300_000)).toBe(false);
    const independent = postgres(testUrl!, { max: 1 });
    try { expect((await independent`select analysis from coinholder_topic_cache where input_hash = 'revision'`)[0].analysis).toEqual(analysis); }
    finally { await independent.end(); }
  });
  it("backs off failures and prevents expired workers from publishing over a new lease", async () => {
    expect(await store.claim("revision", 71, "first", at)).toBe(true);
    expect(await store.complete("revision", "first", null, at + 1)).toBe(true);
    expect(await store.claim("revision", 71, "too-early", at + 1000)).toBe(false);
    expect(await store.claim("revision", 71, "retry", at + 300_002)).toBe(true);
    expect(await store.claim("revision", 71, "replacement", at + 420_003)).toBe(true);
    expect(await store.complete("revision", "retry", analysis, at + 420_004)).toBe(false);
    expect(await store.complete("revision", "replacement", analysis, at + 420_004)).toBe(true);
    expect(await store.claim("edited-revision", 71, "new-content", at)).toBe(true);
  });
});
