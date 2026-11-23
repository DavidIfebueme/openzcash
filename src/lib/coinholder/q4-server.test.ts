import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/zcg/github-headers", () => ({ ghHeaders: () => ({ accept: "application/vnd.github+json" }) }));
import { createQ4Reader } from "./q4-server";
import { q4Totals, READY_FOR_VOTE_LABEL } from "./q4";

const issue = { number: 70, title: "Example", state: "open", created_at: "2026-10-30T12:00:00Z", updated_at: "2026-10-30T13:00:00Z", labels: [READY_FOR_VOTE_LABEL], body: "### Requested Grant Amount (USD)\n$50,000" };
const response = (data: unknown) => Response.json(data);

describe("Q4 source snapshots", () => {
  it("fetches all pages with the exact label and shares the cache", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, i) => ({ ...issue, number: i + 1 })))).mockResolvedValueOnce(response([{ ...issue, number: 101 }]));
    const read = createQ4Reader(fetcher, () => 1_800_000_000_000);
    const [a, b] = await Promise.all([read(), read()]);
    expect(a).toBe(b);
    expect(a.proposals).toHaveLength(101);
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("labels")).toBe(READY_FOR_VOTE_LABEL);
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get("page")).toBe("2");
    await read();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("preserves the last complete snapshot when later pagination fails", async () => {
    let now = 1_800_000_000_000;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response([issue]));
    const read = createQ4Reader(fetcher, () => now);
    const first = await read();
    now += 300_001;
    fetcher.mockResolvedValueOnce(response(Array.from({ length: 100 }, () => ({ ...issue, number: 71 })))).mockResolvedValueOnce(new Response("rate limit", { status: 403 }));
    const stale = await read();
    expect(stale).toEqual({ ...first, status: "stale" });
    expect(stale.proposals?.map((p) => p.number)).toEqual([70]);
    await read();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("distinguishes an empty successful listing from errors and malformed data", async () => {
    for (const res of [new Response("upstream", { status: 503 }), response({ message: "error" }), response([{ ...issue, labels: null }])]) {
      const read = createQ4Reader(vi.fn<typeof fetch>().mockResolvedValue(res));
      expect(await read()).toEqual({ status: "unavailable", fetchedAt: null, proposals: null });
    }
    const empty = createQ4Reader(vi.fn<typeof fetch>().mockResolvedValue(response([])), () => Date.parse("2026-11-17T00:00:00Z"));
    expect(await empty()).toMatchObject({ status: "current", proposals: [] });
  });
  it("removes a delisted submission on the next successful refresh", async () => {
    let now = 1_800_000_000_000;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response([issue])).mockResolvedValueOnce(response([]));
    const read = createQ4Reader(fetcher, () => now);
    await read(); now += 300_001;
    expect(await read()).toMatchObject({ status: "current", proposals: [] });
  });
  it("refreshes an edited request and its total after the source cache expires", async () => {
    let now = 1_800_000_000_000;
    const original = { ...issue, number: 76, body: "### Requested Grant Amount (USD)\n$2,000" };
    const edited = {
      ...original,
      updated_at: "2026-11-02T23:42:01Z",
      body: "### Requested Grant Amount (USD)\n$1,690 (reduced from $2,000 on 2026-11-02, see Other Funding Sources)\n### Total Budget (USD)\n$2,000",
    };
    const revisedAgain = {
      ...edited,
      updated_at: "2026-11-22T15:44:26Z",
      body: "### Requested Grant Amount (USD)\n$1,620 (reduced from $2,000 on 2026-11-02 and to $1,620 on 2026-11-22, see Other Funding Sources)\n### Total Budget (USD)\n$2,000",
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response([original, issue]))
      .mockResolvedValueOnce(response([edited, issue]))
      .mockResolvedValueOnce(response([revisedAgain, issue]));
    const read = createQ4Reader(fetcher, () => now);
    const before = await read();
    expect(q4Totals(before.proposals!)).toEqual({ requestedUsdCents: 5200000, missingAmounts: 0 });
    now += 300_001;
    const after = await read();
    expect(after).toMatchObject({ status: "current", fetchedAt: new Date(now).toISOString() });
    expect(after.proposals?.find((p) => p.number === 76)).toMatchObject({ requestedUsdCents: 169000, updatedAt: edited.updated_at, body: edited.body });
    expect(q4Totals(after.proposals!)).toEqual({ requestedUsdCents: 5169000, missingAmounts: 0 });
    now += 300_001;
    const latest = await read();
    expect(latest.proposals?.map((p) => p.number)).toEqual([76, 70]);
    expect(q4Totals(latest.proposals!)).toEqual({ requestedUsdCents: 5162000, missingAmounts: 0 });
  });
});

describe("FPF's provisional Cryppit listing", () => {
  const review = Date.parse("2026-11-23T00:00:00Z");
  const restored = { ...issue, number: 87, title: "Restored application" };
  const hidden = () => new Response(null, { status: 404 });

  it("includes the forum application on a direct 404, then switches to the restored issue once", async () => {
    let now = review;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response([issue])).mockResolvedValueOnce(hidden())
      .mockResolvedValueOnce(response([issue, restored]));
    const read = createQ4Reader(fetcher, () => now);
    const provisional = await read();
    expect(String(fetcher.mock.calls[1][0])).toMatch(/\/issues\/87$/);
    expect(provisional.proposals?.map((p) => p.number)).toEqual([87, 70]);
    expect(provisional.proposals?.[0]).toMatchObject({ requestedUsdCents: 1_600_000, reviewDecisionUrl: expect.stringContaining("58901/8") });
    now += 300_001;
    const live = await read();
    expect(live.proposals?.map((p) => p.number)).toEqual([87, 70]);
    expect(live.proposals?.[0]).toMatchObject({ title: restored.title, url: expect.stringContaining("github.com") });
    expect(live.proposals?.[0].reviewDecisionUrl).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("honors a visible issue's actual eligibility and a confirmed removal", async () => {
    for (const detail of [response({ ...restored, state: "closed" }), response({ ...restored, labels: [] }),
      response({ ...restored, labels: [READY_FOR_VOTE_LABEL, "Withdrawn"] }), new Response(null, { status: 410 })]) {
      const read = createQ4Reader(vi.fn<typeof fetch>().mockResolvedValueOnce(response([issue])).mockResolvedValueOnce(detail), () => review);
      expect((await read()).proposals?.map((p) => p.number)).toEqual([70]);
    }
  });

  it("preserves the last complete snapshot on an inconclusive GitHub error", async () => {
    let now = review;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response([issue])).mockResolvedValueOnce(hidden())
      .mockResolvedValueOnce(response([issue])).mockResolvedValueOnce(new Response(null, { status: 503 }));
    const read = createQ4Reader(fetcher, () => now);
    const first = await read();
    now += 300_001;
    expect(await read()).toEqual({ ...first, status: "stale" });
  });

  it("limits the exception to the period covered by FPF's decision", async () => {
    for (const at of ["2026-11-21T13:51:59Z", "2026-12-09T20:00:00Z", "2026-12-17T00:00:00Z"]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response([issue]));
      const read = createQ4Reader(fetcher, () => Date.parse(at));
      expect((await read()).proposals?.map((p) => p.number)).toEqual([70]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
