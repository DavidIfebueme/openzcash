import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createEcosystemGithubRequest } from "./github";
const signal = () => new AbortController().signal;
describe("Public ecosystem GitHub transport", () => {
  it("posts GraphQL and follows same-host REST repository transfers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://api.github.com/repositories/123" } }))
      .mockResolvedValueOnce(Response.json({ private: false })).mockResolvedValueOnce(Response.json({ data: {} }));
    const request = createEcosystemGithubRequest({ token: "test-token", signal: signal(), fetcher });
    expect(await request("repos/public/wallet")).toEqual({ private: false });
    expect(fetcher.mock.calls[1][0].href).toBe("https://api.github.com/repositories/123");
    await request("graphql", "query { viewer { login } }");
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "POST", redirect: "manual", cache: "no-store", body: JSON.stringify({ query: "query { viewer { login } }" }) });
  });
  it("never sends credentials to a redirect on another host", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://elsewhere.invalid/" } }));
    await expect(createEcosystemGithubRequest({ token: "secret", signal: signal(), fetcher })("repos/public/wallet")).rejects.toThrow("Public GitHub collection unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["https://elsewhere.invalid", "//elsewhere.invalid", "graphql/other"])("rejects arbitrary endpoints before fetching: %s", async endpoint => {
    const fetcher = vi.fn();
    await expect(createEcosystemGithubRequest({ token: "secret", signal: signal(), fetcher })(endpoint)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects partial GraphQL responses and hides source/network errors", async () => {
    for (const response of [Response.json({ data: {}, errors: [{ message: "secret-data" }] }), new Response("secret-data", { status: 403 })]) {
      const request = createEcosystemGithubRequest({ token: "secret", signal: signal(), fetcher: vi.fn().mockResolvedValue(response) });
      await expect(request("graphql", "query {} ")).rejects.toThrow(/^Public GitHub collection unavailable$/);
    }
  });
  it("honors cancellation and requires a token without sending a request", async () => {
    const abort = new AbortController(); abort.abort();
    const fetcher = vi.fn();
    await expect(createEcosystemGithubRequest({ token: "test", signal: abort.signal, fetcher })("repos/public/wallet")).rejects.toThrow();
    await expect(createEcosystemGithubRequest({ token: "", signal: signal(), fetcher })("repos/public/wallet")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
