import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createGitHubNewsReader, githubNewsBehind, NEWS_GITHUB_REPOSITORIES, type NewsGitHubHealth } from "./github";
const repository = "ZcashFoundation/zebra";
const release = { name: "Zebra 7.0.0-rc.0", tag_name: "v7.0.0-rc.0", published_at: "2026-10-02T00:02:03Z", html_url: "https://github.com/ZcashFoundation/zebra/releases/tag/v7.0.0-rc.0", draft: false };
const response = (body: unknown = [release], status = 200) => Response.json(body, { status });
beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("GitHub News source recovery", () => {
  it("uses the shared configured token for the fixed public endpoint without exposing it in results", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-read-token-sentinel");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    const items = await reader.read(repository);
    expect(fetcher).toHaveBeenCalledWith(`https://api.github.com/repos/${repository}/releases?per_page=5`, expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer test-read-token-sentinel" }), cache: "no-store", redirect: "error" }));
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
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/repos/zcash/zallet/releases?per_page=5", expect.objectContaining({ redirect: "error" }));
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
    expect(reader.health()[0]).toEqual({ repository, status: "cached", failures: 1, fetchedAt: "2026-10-05T06:00:00.000Z", lastSuccessAt: "2026-10-05T05:00:00.000Z" });
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
  it("reads the official organizations and flags pre-releases in the title", async () => {
    const zakura = { ...release, name: "v1.8.2", tag_name: "v1.8.2", prerelease: true, html_url: "https://github.com/zakura-core/zakura/releases/tag/v1.8.2" };
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher: vi.fn<typeof fetch>().mockResolvedValue(response([zakura])) });
    expect(await reader.read("zakura-core/zakura")).toEqual([expect.objectContaining({ kind: "zakura", title: "zakura v1.8.2 (pre-release)" })]);
    expect(NEWS_GITHUB_REPOSITORIES).toEqual(expect.arrayContaining(["zodl-inc/zodl-android", "ShieldedLabs/crosslink_monolith", "zingolabs/zingolib"]));
  });
  it("reads a failed repository again after the retry spacing, doubling it while the failure continues", async () => {
    let now = Date.parse("2026-11-14T19:00:00Z");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(response({}, 502)).mockResolvedValueOnce(response([]));
    const reader = createGitHubNewsReader({ ttlMs: 3_600_000, retryMs: 240_000, fetcher, now: () => now });
    const first = await reader.read(repository);
    now += 3_599_000; await reader.read(repository);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 1_000; expect(await reader.read(repository)).toEqual(first);
    expect(reader.health()[0]).toMatchObject({ status: "cached", failures: 1, lastSuccessAt: "2026-11-14T19:00:00.000Z" });
    now += 239_000; await reader.read(repository);
    expect(fetcher).toHaveBeenCalledTimes(2);
    now += 1_000; expect(await reader.read(repository)).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(reader.health()[0]).toMatchObject({ status: "cached", failures: 2 });
    now += 479_000; await reader.read(repository);
    expect(fetcher).toHaveBeenCalledTimes(3);
    now += 1_000; expect(await reader.read(repository)).toEqual([]);
    expect(reader.health()[0]).toEqual({ repository, status: "live", failures: 0, fetchedAt: "2026-11-14T20:12:00.000Z", lastSuccessAt: "2026-11-14T20:12:00.000Z" });
  });
  it("never spaces retries further apart than the regular schedule", async () => {
    let now = Date.parse("2026-11-14T19:00:00Z");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const reader = createGitHubNewsReader({ ttlMs: 3_600_000, retryMs: 240_000, fetcher, now: () => now });
    await reader.read(repository);
    for (const wait of [240_000, 480_000, 960_000, 1_920_000, 3_600_000, 3_600_000]) {
      const before = fetcher.mock.calls.length;
      now += wait - 1_000; await reader.read(repository);
      expect(fetcher).toHaveBeenCalledTimes(before);
      now += 1_000; await reader.read(repository);
      expect(fetcher).toHaveBeenCalledTimes(before + 1);
    }
    expect(reader.health()[0]).toMatchObject({ status: "unavailable", failures: 7, lastSuccessAt: null });
  });
  it("reports a repository as behind when nothing is verified yet or its retry also failed", () => {
    const entry = (status: NewsGitHubHealth["status"], failures: number): NewsGitHubHealth => ({ repository: `${status}/${failures}`, status, failures, fetchedAt: null, lastSuccessAt: null });
    expect(githubNewsBehind([entry("live", 0), entry("unchecked", 0), entry("cached", 1), entry("cached", 2), entry("unavailable", 1)]).map(source => source.repository))
      .toEqual(["cached/2", "unavailable/1"]);
  });
  it.each([
    ["HTTP 403", () => Promise.resolve(response({ message: "private-error" }, 403))],
    ["timeout", () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError"))],
    ["redirected", () => Promise.reject(new TypeError("fetch failed", { cause: new Error("unexpected redirect") }))],
    ["network error", () => Promise.reject(new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND private-host") }))],
    ["unexpected response", () => Promise.resolve(response({ message: "private-error" }))],
    ["unexpected response", () => Promise.resolve(response([{ ...release, html_url: "private-not-a-url" }]))],
  ])("logs a failed read as %s with its repository and nothing from the response", async (reason, failure) => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher: vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockImplementation(failure) });
    await reader.read(repository);
    expect(console.error).not.toHaveBeenCalled();
    await reader.read(repository);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(`[news] GitHub ${repository} refresh failed (${reason}); keeping last successful response`);
    await reader.read("zingolabs/zaino");
    expect(console.error).toHaveBeenLastCalledWith(`[news] GitHub zingolabs/zaino refresh failed (${reason}); no previous response`);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private|sentinel/);
  });
  it.each([401, 403])("reads the public source without the credential when GitHub answers %i to it", async status => {
    vi.stubEnv("GITHUB_TOKEN", "test-read-token-sentinel");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ message: "private-error" }, status)).mockResolvedValueOnce(response());
    const reader = createGitHubNewsReader({ ttlMs: 0, fetcher });
    expect(await reader.read(repository)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty("authorization", "Bearer test-read-token-sentinel");
    expect(fetcher.mock.calls[1][0]).toBe(`https://api.github.com/repos/${repository}/releases?per_page=5`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(fetcher.mock.calls[1][1]?.headers).not.toHaveProperty("authorization");
    expect(reader.health()[0]).toMatchObject({ status: "live", failures: 0 });
    expect(console.error).toHaveBeenCalledExactlyOnceWith(`[news] GitHub ${repository} refused the configured credential (HTTP ${status}); reading without it`);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private|sentinel/);
  });
  it("repeats a refused read once only, and never a read that carried no credential", async () => {
    const refused = () => Promise.resolve(response({ message: "private-error" }, 403));
    vi.stubEnv("GITHUB_TOKEN", "test-read-token-sentinel");
    const withCredential = vi.fn<typeof fetch>().mockImplementation(refused);
    const reader = createGitHubNewsReader({ ttlMs: 3_600_000, fetcher: withCredential });
    expect(await reader.read(repository)).toEqual([]);
    expect(withCredential).toHaveBeenCalledTimes(2);
    expect(reader.health()[0]).toMatchObject({ status: "unavailable", failures: 1 });
    expect(console.error).toHaveBeenLastCalledWith(`[news] GitHub ${repository} refresh failed (HTTP 403); no previous response`);
    vi.stubEnv("GITHUB_TOKEN", "");
    const anonymous = vi.fn<typeof fetch>().mockImplementation(refused);
    await createGitHubNewsReader({ ttlMs: 3_600_000, fetcher: anonymous }).read(repository);
    expect(anonymous).toHaveBeenCalledTimes(1);
    for (const status of [404, 429, 500]) {
      vi.stubEnv("GITHUB_TOKEN", "test-read-token-sentinel");
      const other = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(response({}, status)));
      await createGitHubNewsReader({ ttlMs: 3_600_000, fetcher: other }).read(repository);
      expect(other).toHaveBeenCalledTimes(1);
    }
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
