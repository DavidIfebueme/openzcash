import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown as PostgresJsDatabase<typeof schema>,
  paid: "21451071",
  fetched: [] as string[],
}));
vi.mock("@/lib/db/client", () => ({ getDb: () => state.db }));
vi.mock("./sheets", async (original) => ({
  ...await original<typeof import("./sheets")>(),
  fetchSheetCsv: async (gid: string) => {
    state.fetched.push(gid);
    return `Status,Updates required\nBlock height,3485631\nBlock time (UTC),16 Sep 2026 17:23:30\nCurrent ZEC balance,87670\nCurrent USD balance,8867408\nUSD value of grant milestones paid out so far,${state.paid}`;
  },
}));

const testUrl = process.env.ZCG_SNAPSHOT_TEST_DB_URL;
let client: ReturnType<typeof postgres>;

describe.skipIf(!testUrl)("revised treasury snapshots with Postgres", () => {
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(testUrl!).hostname)) {
      throw new Error("Snapshot regression requires a local database");
    }
    client = postgres(testUrl!, { max: 1, onnotice: () => {} });
    // Session-local tables shadow the real tables. No application data changes.
    await client`create temporary table zcg_balance_snapshots (like public.zcg_balance_snapshots including all)`;
    await client`create temporary table zcg_sheet_imports (like public.zcg_sheet_imports including all)`;
    state.db = drizzle(client, { schema });
  });

  afterAll(async () => {
    vi.useRealTimers();
    if (client) await client.end();
  });

  it("persists a source revision with an unchanged block date and limits refresh scope", async () => {
    const { importSnapshots } = await import("./import-snapshots");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T04:23:06Z"));
    expect((await importSnapshots(["zcg_operating"]))[0].ok).toBe(true);

    state.paid = "21456071";
    vi.setSystemTime(new Date("2026-09-23T05:30:00Z"));
    expect((await importSnapshots(["zcg_operating"]))[0].ok).toBe(true);
    expect((await importSnapshots(["zcg_operating"]))[0].ok).toBe(true);

    const rows = await client`select captured_at, imported_at, usd_milestones_paid_cents from zcg_balance_snapshots`;
    expect(rows).toHaveLength(1);
    expect(String(rows[0].usd_milestones_paid_cents)).toBe("2145607100");
    expect(new Date(rows[0].captured_at).toISOString()).toBe("2026-09-16T17:23:30.000Z");
    expect(new Date(rows[0].imported_at).toISOString()).toBe("2026-09-23T05:30:00.000Z");
    expect(state.fetched).toEqual(["135980745", "135980745", "135980745"]);
    const imports = await client`select content_sha256 from zcg_sheet_imports`;
    expect(imports).toHaveLength(2);

    // A delayed response from a fetch started earlier must keep the newer row.
    state.paid = "21454071";
    vi.setSystemTime(new Date("2026-09-22T05:30:00Z"));
    await importSnapshots(["zcg_operating"]);
    const [latest] = await client`select imported_at, usd_milestones_paid_cents from zcg_balance_snapshots`;
    expect(String(latest.usd_milestones_paid_cents)).toBe("2145607100");
    expect(new Date(latest.imported_at).toISOString()).toBe("2026-09-23T05:30:00.000Z");
  });
});
