import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrantApplication } from "./github-applications";

const state = vi.hoisted(() => ({ published: new Map<string, GrantApplication | null>(), record: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ transaction: (fn: (tx: unknown) => unknown) => fn({}) }) }));
vi.mock("./publications-repo", () => ({
  readPublications: async () => state.published,
  recordPublications: state.record,
}));
const issue = { number: 486, title: "Grant Application - Konclave", html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/486", created_at: "2026-10-13T02:40:05Z", comments: 0, labels: [], user: { login: "danielgorgonha" }, body: "### Requested Grant Amount (USD)\n$18,000" };

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-13T03:00:00Z"));
  delete (globalThis as typeof globalThis & { __openZcashGrantApplications?: unknown }).__openZcashGrantApplications;
  state.published.clear(); state.record.mockReset();
  state.record.mockImplementation(async (_tx, _scope, items) => {
    for (const item of items) if (!state.published.has(item.key)) state.published.set(item.key, item.initial);
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("new GitHub proposal refresh", () => {
  it("publishes a new unlabelled submission immediately without releasing same-day verdicts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([issue, { ...issue, number: 487, labels: [{ name: "Grant Approved" }] }])));
    const { getGrantApplications } = await import("./github-applications");
    expect(await getGrantApplications()).toEqual([expect.objectContaining({ number: 486, amountUsd: 18000 })]);
    expect(state.published.get("487")).toBeNull();
  });

  it("collects a later proposal after five minutes and coalesces concurrent reads", async () => {
    const fetcher = vi.fn(async () => Response.json([issue]));
    vi.stubGlobal("fetch", fetcher);
    const { getGrantApplications } = await import("./github-applications");
    await Promise.all([getGrantApplications(), getGrantApplications(40, { fresh: true })]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await getGrantApplications();
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60_000);
    await getGrantApplications();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("lets News report a failed refresh while page reads preserve the published fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([issue])));
    const { getGrantApplications } = await import("./github-applications");
    await getGrantApplications();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("source unavailable"); }));
    await expect(getGrantApplications(40, { fresh: true })).rejects.toThrow("source unavailable");
    expect(await getGrantApplications()).toHaveLength(1);
  });
});
