import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ calls: vi.fn(), tip: vi.fn(), supply: vi.fn(), circulating: vi.fn(), proposals: vi.fn(), meetings: vi.fn(), grants: vi.fn(), ledger: vi.fn() }));
vi.mock("@/lib/arborist/notes", () => ({ getArboristCalls: mocks.calls, arboristFetchedAt: () => "2026-09-28T10:00:00.000Z", ARBORIST_REPO_URL: "https://github.com/ZcashCommunityGrants/arboretum-notes", ARBORIST_YOUTUBE_URL: "https://www.youtube.com/@zcashfoundation/videos" }));
vi.mock("@/lib/zcash/lockbox-live", () => ({ cachedChainTip: mocks.tip }));
vi.mock("@/lib/markets/sources", () => ({ chainSupplyFeed: mocks.supply }));
vi.mock("@/lib/pricing/circulating-supply", () => ({ currentZecCirculatingSupply: mocks.circulating }));
vi.mock("@/lib/zcg/proposals-repo", () => ({ listProposals: mocks.proposals }));
vi.mock("@/lib/zcg/governance-repo", () => ({ getMeetings: mocks.meetings }));
vi.mock("@/lib/zcg/grants-repo", () => ({ listGrants: mocks.grants }));
vi.mock("@/lib/zcg/disbursements-repo", () => ({ recipientTotals: mocks.ledger }));
vi.mock("@/lib/cache/memo", () => ({ cached: (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn(), LEDGER_TTL_MS: 1 }));
import { lookupPublicData, lookupSchema, lookupTool } from "./data";

const signal = () => new AbortController().signal;
const read = async (topic: string, query = "") => { const result = await lookupPublicData({ topic, query }, signal()); return { ...JSON.parse(result.content), source: result.source }; };
const call = { number: 131, date: "2026-09-10", rawDate: "10th Sep, 2026", duration: "15 minutes", video: "https://www.youtube.com/watch?v=abc123def", videoId: "abc123def", moderator: "Dodger", notetaker: "Sam", agenda: ["Zaino"], url: "https://github.com/ZcashCommunityGrants/arboretum-notes/blob/main/AllArboristCallNotes/Arborist%20Call%20131.md", source: "notes" as const };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.mockResolvedValue([{ ...call, number: 132, date: "2026-09-24" }, call]);
  mocks.tip.mockResolvedValue(3_500_000);
  mocks.supply.mockResolvedValue({ data: { zec: 16_950_000, height: 3_499_990, pools: [{ id: "transparent", zec: 12_000_000 }, { id: "orchard", zec: 4_800_000 }, { id: "lockbox", zec: 150_000 }], lockedZec: 150_000, shieldedZec: 4_800_000 }, fetchedAt: "2026-09-28T09:58:00.000Z", stale: false, checkedAt: "2026-09-28T09:58:00.000Z", error: null });
  mocks.circulating.mockResolvedValue({ zec: 16_945_106, sourceUrl: "https://api.coingecko.com/api/v3/coins/markets", quotedAt: "2026-09-28T09:50:00.000Z", fetchedAt: "2026-09-28T09:55:00.000Z", stale: false });
  mocks.proposals.mockResolvedValue([{ id: "p1", program: "zcg", title: "Zebra indexer", status: "approved", decisionDate: "2026-08-12", submittedDate: "2026-07-01", applicantsRaw: "Zingo Labs", requestedUsdCents: 12_500_000n, platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/340", importedAt: new Date("2026-09-27T03:00:00Z") }]);
  mocks.meetings.mockResolvedValue([{ meetingDate: "2026-08-12", title: "ZCG meeting", url: "https://forum.zcashcommunity.com/t/minutes/1" }]);
  mocks.grants.mockResolvedValue([{ grantKey: "Zebra indexer" }]);
  mocks.ledger.mockResolvedValue([{ recipientName: "Zcash Brazil", externalUsdCents: 65_595_543n, externalPaidUsdCents: 55_662_043n, grantCount: 7, externalPaymentCount: 62, externalLastPaid: "2026-09-01" }]);
});
describe("New public-data topics through the tool boundary", () => {
  it("describes every topic the schema accepts", () => {
    for (const topic of ["arborist", "wallets", "communities", "decisions", "chain", "price_history"]) { expect(lookupSchema.shape.topic.options).toContain(topic); expect(lookupTool.description).toContain(topic); }
  });
  it("returns the named Arborist call with its notes and recording links", async () => {
    const { data, source } = await read("arborist", "call #131");
    expect(data.archiveFetchedAt).toBe("2026-09-28T10:00:00.000Z"); expect(data.latestCall).toMatchObject({ number: 132 });
    expect(data.calls.shown).toHaveLength(1); expect(data.calls.shown[0]).toMatchObject({ number: 131, date: "2026-09-10", moderator: "Dodger", notes: call.url, recording: call.video });
    expect(source?.url).toBe("https://openzcash.org/arborist");
  });
  it("reads the wallet catalog offline and the community directory with the ledger's funding", async () => {
    const wallets = await read("wallets", "shielded on iOS");
    expect(wallets.data.catalogRevisedOn).toBe("2026-10-15"); expect(wallets.data.wallets.shown.length).toBeGreaterThan(5); expect(wallets.data.wallets.shown.every((w: { shielded: string }) => w.shielded === "full")).toBe(true);
    const communities = await read("communities", "Zcash Brasil");
    expect(communities.data.verifiedOn).toBe("2026-09-20"); expect(communities.data.communities.shown[0].name).toBe("Zcash Brazil");
    expect(communities.data.fundingSource).toBe("ledger"); expect(communities.data.communities.shown[0]).toMatchObject({ lastPaidDate: "2026-09-01", zcgBudgetedUsd: 655955.43 });
    expect(mocks.calls).not.toHaveBeenCalled(); expect(mocks.proposals).not.toHaveBeenCalled();
  });
  it("assembles decisions from the proposals, meetings and grants readers under the publication day", async () => {
    const { data } = await read("decisions", "approved 2026");
    expect(data.publishedThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(data.importedAt).toBe("2026-09-27T03:00:00.000Z");
    expect(data.decisions.shown[0]).toMatchObject({ date: "2026-08-12", outcome: "Approved", subject: "Zebra indexer", grantPage: "https://openzcash.org/zcg/grant?g=Zebra%20indexer" });
    expect(data.decisions.shown[0].sources.shown.map((s: { label: string }) => s.label)).toEqual(["Application", "Minutes"]);
    expect(data.unavailableSources.shown).toEqual([]); expect(data.note).not.toContain("DEGRADED");
  });
  it("flags a failed meetings or grants reader instead of showing decisions without their links as complete", async () => {
    mocks.meetings.mockRejectedValue(new Error("db down")); mocks.grants.mockRejectedValue(new Error("db down"));
    const { data } = await read("decisions", "approved 2026");
    expect(data.unavailableSources.shown).toEqual(["meetings", "grants"]); expect(data.note).toContain("DEGRADED: meetings and grants could not be read");
    expect(data.decisions.shown[0]).toMatchObject({ subject: "Zebra indexer", grantPage: null }); expect(data.decisions.shown[0].sources.shown.map((s: { label: string }) => s.label)).toEqual(["Application"]);
  });
  it("reports chain height, halving estimate and pools with their own times, and nulls when feeds fail", async () => {
    const { data } = await read("chain");
    expect(data.tip).toMatchObject({ height: 3_500_000 }); expect(data.halving).toMatchObject({ nextHeight: 6_132_390, blocksRemaining: 2_632_390 });
    expect(data.supply).toMatchObject({ shieldedZec: 4_800_000, atHeight: 3_499_990, fetchedAt: "2026-09-28T09:58:00.000Z" }); expect(data.circulating).toMatchObject({ zec: 16_945_106 });
    mocks.tip.mockRejectedValue(new Error("lwd down")); mocks.supply.mockRejectedValue(new Error("explorer down")); mocks.circulating.mockResolvedValue(null);
    const failed = (await read("chain")).data;
    expect(failed).toMatchObject({ tip: null, halving: null, supply: null, circulating: null }); expect(failed.tipNote).toContain("unavailable");
  });
  it("answers a dated price question from the bundled daily closes", async () => {
    const { data, source } = await read("price_history", "ZEC price in January 2026");
    expect(data.requested).toEqual({ kind: "month", value: "2026-01" }); expect(data.summary.daysWithPrice).toBe(31); expect(data.summary.low.usd).toBeGreaterThan(0); expect(data.source).toContain("bitfinex");
    expect(data.days.shown.length).toBeGreaterThan(6); expect(source?.title).toBe("OpenZcash · price history");
    expect((await read("price_history", "ZEC price in December 2029")).data.note).toContain("Do not estimate");
  });
});
