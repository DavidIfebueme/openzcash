import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createGitHubNewsReader } from "./github";
const repository = "ZcashFoundation/zebra";
const release = { name: "Zebra 7.0.0-rc.0", tag_name: "v7.0.0-rc.0", published_at: "2026-10-02T00:02:03Z", html_url: "https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0-rc.0", draft: false };
const response = (body: unknown = [release], status = 200) => Response.json(body, { status });
afterEach(() => vi.unstubAllEnvs());

describe("GitHub News source recovery", () => {
  it("uses the shared configured token for the fixed public endpoint without exposing it in results", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-read-token-sentinel");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    const items = await reader.read(repository);
    expect(fetcher).toHaveBeenCalledWith(`https://api.github.com/repos/${repository}/releases?per_page=2`, expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer test-read-token-sentinel" }), cache: "no-store", redirect: "error" }));
    expect(items[0]).toMatchObject({ source: "github", ts: "2026-10-02T00:02:03.000Z" });
    expect(JSON.stringify({ items, health: reader.health() })).not.toContain("test-read-token-sentinel");
  });
  it("works without a token and never accepts caller-selected repository URLs", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    expect(await reader.read("attacker/anything")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await reader.read(repository);
    expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty("authorization");
  });
  it("uses Zallet's canonical repository without following the former wallet redirect", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([{ ...release, name: "v0.1.0", tag_name: "v0.1.0", html_url: "https://github.com/zcash/zallet/releases/tag/v0.1.0" }]));
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    expect(await reader.read("zcash/wallet")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await reader.read("zcash/zallet")).toEqual([expect.objectContaining({ kind: "zallet", url: "https://github.com/zcash/zallet/releases/tag/v0.1.0" })]);
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/repos/zcash/zallet/releases?per_page=2", expect.objectContaining({ redirect: "error" }));
  });
  it.each([
    ["rate limit", () => response({ message: "private-error" }, 403)],
    ["unavailable", () => response({}, 503)],
    ["invalid shape", () => response({ message: "bad response" })],
    ["invalid record", () => response([{ ...release, published_at: "not-a-date" }])],
    ["unsafe source", () => response([{ ...release, html_url: "https://other.example/releases/x" }])],
    ["nonstandard source port", () => response([{ ...release, html_url: "https://github.com:8443/ZcashFoundation/zebra/releases/tag/v7" }])],
  ])("preserves last-good content and its success date on %s", async (_, failure) => {
    let now = Date.parse("2026-10-05T05:00:00Z");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockImplementationOnce(async () => failure());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher, now: () => now });
    const first = await reader.read(repository);
    now += 3_600_000;
    expect(await reader.read(repository)).toEqual(first);
    expect(reader.health()[0]).toEqual({ repository, status: "cached", fetchedAt: "2026-10-05T06:00:00.000Z", lastSuccessAt: "2026-10-05T05:00:00.000Z" });
    expect(JSON.stringify(reader.health())).not.toContain("private-error");
  });
  it("marks a cold failure unavailable, then recovers independently of other repositories", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    expect(await reader.read(repository)).toEqual([]);
    expect(reader.health()[0]).toMatchObject({ status: "unavailable", lastSuccessAt: null });
    expect(await reader.read(repository)).toHaveLength(1);
    expect(reader.health()[0].status).toBe("live");
    expect(reader.health()[1].status).toBe("unchecked");
  });
  it("treats a valid empty list as fresh, replacing older releases for that repository", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValueOnce(response([])).mockRejectedValueOnce(new Error("later failure"));
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    await reader.read(repository);
    expect(await reader.read(repository)).toEqual([]);
    expect(reader.health()[0].status).toBe("live");
    expect(await reader.read(repository)).toEqual([]);
    expect(reader.health()[0].status).toBe("cached");
  });
  it("does not publish drafts or use the collection date as the release date", async () => {
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher: vi.fn<typeof fetch>().mockResolvedValue(response([{ draft: true }, release])), now: () => Date.parse("2026-10-05T05:00:00Z") });
    const items = await reader.read(repository);
    expect(items).toHaveLength(1);
    expect(items[0].ts).toBe("2026-10-02T00:02:03.000Z");
  });
  it("shares an overlapping read and releases it after completion", async () => {
    let finish!: (r: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    const first = reader.read(repository), second = reader.read(repository);
    expect(second).toBe(first);
    finish(response()); await first;
    await reader.read(repository);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
