import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "@/lib/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown as PostgresJsDatabase<typeof schema>,
  verdict: "ZCG to discuss",
  issues: [] as Record<string, unknown>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => state.db }));
vi.mock("./sheets", async (original) => ({
  ...await original<typeof import("./sheets")>(),
  fetchSheetCsv: async (gid: string) => gid === "1164534734"
    ? `Date Submitted,Proposal Title,Applicant(s),Grant Platform Link,Forum Link,Grant Status,Date Committee Approved/ Rejected\n9/1/2026,D1 example,Example,https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900,,${state.verdict},${state.verdict === "ZCG to discuss" ? "" : "9/15/26"}`
    : "Date Submitted,Proposal Title,Applicant(s),Grant Platform Link,Status",
}));

const testUrl = process.env.ZCG_PUBLICATION_TEST_DB_URL;
let client: ReturnType<typeof postgres>;
const now = new Date("2026-09-15T18:00:00Z");
const midnight = new Date("2026-09-16T03:00:00Z");

describe.skipIf(!testUrl)("D-1 publication with Postgres", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (url.hostname !== "127.0.0.1" || !url.pathname.startsWith("/openzcash_d1_test")) {
      throw new Error("Use a disposable local openzcash_d1_test database");
    }
    client = postgres(testUrl!, { max: 3, onnotice: () => {} });
    state.db = drizzle(client, { schema });
    await migrate(state.db, { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    await client`truncate zcg_publications, zcg_proposals, zcg_changelog, zcg_sheet_imports`;
    state.verdict = "ZCG to discuss";
    state.issues = [{ number: 900, title: "Grant Application - D1 example",
      html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900",
      created_at: "2026-09-01T12:00:00Z", comments: 0, user: { login: "example" },
      body: "### Project Summary\nA brief summary.\n### Requested Grant Amount (USD)\n1000",
      labels: [{ name: "Grant Application" }, { name: "Ready For ZCG Review" }],
    }];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(state.issues)));
    await state.db.insert(schema.zcgProposals).values({ id: "legacy-row", program: "zcg",
      title: "D1 example", titleKey: "d1 example", status: "under_review", statusRaw: "ZCG to discuss",
      platformLink: state.issues[0].html_url as string, submittedDate: "2026-09-01",
      sourceSheetGid: "1164534734", sourceRowIndex: 1,
    });
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  afterAll(async () => { if (client) await client.end(); });

  it("holds an imported verdict and RSS, then releases list, counts, and office together", async () => {
    const { getGrantApplications } = await import("./github-applications");
    const { importProposals } = await import("./import-proposals");
    const { listProposals, officeUnderReview, proposalsFunnel } = await import("./proposals-repo");
    const { snapshotForChangelog, recordChangelog } = await import("./changelog");
    const { GET: rss } = await import("@/app/api/feeds/zcg.xml/route");
    await getGrantApplications(100);
    const before = await snapshotForChangelog();
    state.verdict = "Rejected";
    expect((await importProposals())[0].imported).toBe(1);
    await recordChangelog(before);
    expect((await listProposals({ status: "under_review" }))[0]).toMatchObject({
      status: "under_review", decisionDate: null,
    });
    expect(await listProposals({ status: "rejected" })).toHaveLength(0);
    expect(await officeUnderReview()).toHaveLength(1);
    expect(await (await rss()).text()).not.toContain("<item>");

    vi.setSystemTime(midnight);
    expect((await listProposals({ status: "rejected" }))[0]).toMatchObject({
      status: "rejected", decisionDate: "2026-09-15",
    });
    expect(await officeUnderReview()).toHaveLength(0);
    expect((await proposalsFunnel()).byStatus).toEqual([{ status: "rejected", count: 1 }]);
    expect(await (await rss()).text()).toContain("under_review → rejected");
  });

  it("keeps the first observation through identical imports and a module restart", async () => {
    state.verdict = "Rejected";
    const { importProposals } = await import("./import-proposals");
    await importProposals();
    vi.setSystemTime(new Date("2026-09-16T02:59:59Z"));
    await importProposals();
    const [stored] = await client`select observed_at from zcg_publications where scope = 'proposal-status'`;
    expect(new Date(stored.observed_at).getTime()).toBe(now.getTime());
    vi.resetModules();
    const { listProposals } = await import("./proposals-repo");
    expect((await listProposals())[0].status).toBe("under_review");
    vi.setSystemTime(midnight);
    expect((await listProposals())[0].status).toBe("rejected");
  });

  it("keeps a zebra through a same-day GitHub decision label and closure", async () => {
    const { getGrantApplications } = await import("./github-applications");
    expect((await getGrantApplications())[0].status).toBe("review");
    state.issues[0].labels = [{ name: "Grant Application" }, { name: "Grant Approved" }];
    vi.setSystemTime(new Date("2026-09-15T18:16:00Z"));
    expect((await getGrantApplications())[0].status).toBe("review");
    state.issues = [];
    vi.resetModules();
    const restarted = await import("./github-applications");
    expect((await restarted.getGrantApplications())[0].status).toBe("review");
    vi.setSystemTime(midnight);
    expect(await restarted.getGrantApplications()).toHaveLength(0);
  });

  it("does not publish a decision that was reverted on the same day", async () => {
    const { importProposals } = await import("./import-proposals");
    const { snapshotForChangelog, recordChangelog, listChangelog } = await import("./changelog");
    let before = await snapshotForChangelog();
    state.verdict = "Rejected";
    await importProposals(); await recordChangelog(before);
    vi.setSystemTime(new Date("2026-09-15T20:00:00Z"));
    before = await snapshotForChangelog();
    state.verdict = "ZCG to discuss";
    await importProposals(); await recordChangelog(before);
    vi.setSystemTime(midnight);
    expect(await listChangelog(30, 50, "zcg")).toHaveLength(0);
    const { listProposals } = await import("./proposals-repo");
    expect((await listProposals())[0].status).toBe("under_review");
  });

  it("rolls back publication state when the source transaction fails", async () => {
    const { recordPublications, readPublications } = await import("./publications-repo");
    await expect(state.db.transaction(async (tx) => {
      await recordPublications(tx, "proposal-status", [{ key: "rollback", value: { status: "rejected" }, initial: null }]);
      throw new Error("import failed");
    })).rejects.toThrow("import failed");
    expect((await readPublications("proposal-status")).has("rollback")).toBe(false);
  });

  it("retains the day's original status through repeated reversals in the RSS", async () => {
    const { importProposals } = await import("./import-proposals");
    const { snapshotForChangelog, recordChangelog, listChangelog } = await import("./changelog");
    for (const [index, verdict] of ["Rejected", "ZCG to discuss", "Rejected"].entries()) {
      vi.setSystemTime(new Date(now.getTime() + index * 3_600_000));
      const before = await snapshotForChangelog();
      state.verdict = verdict;
      await importProposals(); await recordChangelog(before);
    }
    vi.setSystemTime(midnight);
    const entries = await listChangelog(30, 50, "zcg");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ fromVal: "under_review", toVal: "rejected" });
  });

  it("uses the observation day when a refresh finishes after midnight", async () => {
    const { importProposals } = await import("./import-proposals");
    const { snapshotForChangelog, recordChangelog, listChangelog } = await import("./changelog");
    const before = await snapshotForChangelog();
    state.verdict = "Rejected";
    vi.setSystemTime(new Date("2026-09-16T02:59:59Z"));
    await importProposals();
    vi.setSystemTime(midnight);
    await recordChangelog(before);
    expect(await listChangelog(30, 50, "zcg")).toHaveLength(1);
  });

  it("defers an admin edit and preserves its locked verdict during reimports", async () => {
    const { PATCH } = await import("@/app/api/zcg/proposals/route");
    const { listProposals } = await import("./proposals-repo");
    const { importProposals } = await import("./import-proposals");
    const response = await PATCH(new Request("http://localhost/api/zcg/proposals", {
      method: "PATCH", body: JSON.stringify({ id: "legacy-row", status: "rejected" }),
    }));
    expect(response.status).toBe(200);
    expect((await listProposals())[0].status).toBe("under_review");
    state.verdict = "Approved";
    await importProposals();
    vi.setSystemTime(midnight);
    expect((await listProposals())[0]).toMatchObject({ status: "rejected", locked: true });
  });
});
