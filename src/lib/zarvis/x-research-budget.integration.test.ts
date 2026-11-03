import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
const state = vi.hoisted(() => ({ db: null as unknown as PostgresJsDatabase<typeof schema> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => state.db }));
import { reserveXResearch } from "./x-research-budget";

const testUrl = process.env.ZARVIS_X_RESEARCH_TEST_DB_URL;
let client: ReturnType<typeof postgres>;
const now = Date.parse("2026-11-03T12:10:00Z"), day = Math.floor(now / 86_400_000);
describe.skipIf(!testUrl)("X research atomic enforcement in disposable Postgres", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/openzcash_x_research_test") throw new Error("Use the disposable local openzcash_x_research_test database");
    client = postgres(testUrl!, { max: 8, onnotice: () => {} }); state.db = drizzle(client, { schema });
    await client`create table if not exists zarvis_usage (key text primary key, count integer not null, expires_at timestamptz not null)`;
  });
  beforeEach(async () => {
    await client`truncate zarvis_usage`;
    for (const [k, v] of Object.entries({ ZARVIS_ENABLED: "true", ZARVIS_WEB_SEARCH: "true", ZARVIS_X_RESEARCH_ENABLED: "true", XAI_API_KEY: "test-key", DATABASE_URL: "unused", ZARVIS_X_RESEARCH_DAILY_LIMIT: "20", ZARVIS_X_RESEARCH_HOURLY_LIMIT: "4", ZARVIS_X_RESEARCH_DAILY_USD_CAP: "3" })) vi.stubEnv(k, v);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { if (client) await client.end(); });
  it("admits one of 20 simultaneous callers across independent connections", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserveXResearch(i % 2 ? "news" : "bounties", now)));
    const allowed = results.filter(r => r !== null); expect(allowed).toHaveLength(1);
    const rows = await client`select key,count from zarvis_usage`;
    expect(rows.find(r => r.key === `x-research:day:${day}`)?.count).toBe(1);
    await allowed[0]!.settle(0.10);
    expect((await client`select count from zarvis_usage where key=${`x-research:budget:${day}`}`)[0].count).toBe(100_000);
  });
  it("enforces the same-topic cooldown across restarts and does not double-refund settlement", async () => {
    const first = await reserveXResearch("news", now); expect(first).not.toBeNull();
    await first!.settle(0.1); await first!.settle(0);
    vi.resetModules(); const fresh = await import("./x-research-budget");
    expect(await fresh.reserveXResearch("news", now)).toBeNull();
    const second = await fresh.reserveXResearch("bounties", now); expect(second).not.toBeNull(); await second!.settle(0.2);
    expect((await client`select count from zarvis_usage where key=${`x-research:budget:${day}`}`)[0].count).toBe(300_000);
  });
  it.each(["hour", "day"])("keeps %s limits during launch/local quota bypasses", async scope => {
    vi.stubEnv("ZARVIS_QUOTA_PAUSE_UNTIL", new Date(now + 3_600_000).toISOString());
    vi.stubEnv("ZARVIS_LOCAL_UNLIMITED", "true"); vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("ZARVIS_ORIGIN", "http://127.0.0.1:3100");
    vi.stubEnv(scope === "hour" ? "ZARVIS_X_RESEARCH_HOURLY_LIMIT" : "ZARVIS_X_RESEARCH_DAILY_LIMIT", "1");
    const first = await reserveXResearch("news", now); await first!.settle(0);
    expect(await reserveXResearch("events", now)).toBeNull();
    if (scope === "hour") { const next = await reserveXResearch("events", now + 3_600_000); expect(next).not.toBeNull(); await next!.settle(0); }
  });
  it("reserves budget before the call and stops before a second reservation would exceed it", async () => {
    vi.stubEnv("ZARVIS_X_RESEARCH_DAILY_USD_CAP", "0.30");
    const first = await reserveXResearch("news", now); await first!.settle(0.20);
    expect(await reserveXResearch("events", now)).toBeNull();
  });
  it.each([null, 9])("closes further research when usage is unknown or exceeds the budget (%s)", async cost => {
    const first = await reserveXResearch("news", now); await first!.settle(cost);
    expect(await reserveXResearch("bounties", now)).toBeNull();
    const tomorrow = await reserveXResearch("news", now + 86_400_000); expect(tomorrow).not.toBeNull(); await tomorrow!.settle(0.1);
  });
  it("a lost request keeps its cross-replica lease until UTC rollover", async () => {
    expect(await reserveXResearch("news", now)).not.toBeNull();
    expect(await reserveXResearch("events", now + 3_600_000)).toBeNull();
    const tomorrow = await reserveXResearch("news", now + 86_400_000); expect(tomorrow).not.toBeNull(); await tomorrow!.settle(0.1);
  });
  it("rolls back accounting and preserves the lease if settlement fails", async () => {
    const first = await reserveXResearch("news", now);
    await client`alter table zarvis_usage add constraint settlement_failure check (key not like 'x-research:budget:%' or count >= 250000)`;
    try {
      await expect(first!.settle(0.01)).rejects.toThrow();
      expect(await reserveXResearch("events", now)).toBeNull();
      expect((await client`select count from zarvis_usage where key=${`x-research:budget:${day}`}`)[0].count).toBe(250000);
    } finally { await client`alter table zarvis_usage drop constraint settlement_failure`; }
  });
  it("cannot reserve against invalid configuration", async () => {
    vi.stubEnv("ZARVIS_X_RESEARCH_DAILY_USD_CAP", "invalid");
    expect(await reserveXResearch("news", now)).toBeNull();
    expect(await client`select * from zarvis_usage`).toHaveLength(0);
  });
});
