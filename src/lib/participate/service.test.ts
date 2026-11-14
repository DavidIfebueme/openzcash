import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  hasParticipantSession,
  participantCookies,
  upstreamJson,
} from "./service";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("participation service reads", () => {
  it("forwards only the service's own cookies to the private upstream", () => {
    expect(
      participantCookies(
        "oz-theme=dark; zcap_session=abc; __Host-participate_email_login=tok; other=1",
      ),
    ).toBe("zcap_session=abc; __Host-participate_email_login=tok");
    expect(participantCookies("oz-theme=dark")).toBeNull();
    expect(participantCookies(null)).toBeNull();
    expect(hasParticipantSession("zcap_session=abc")).toBe(true);
    expect(hasParticipantSession("participate_email_login=tok")).toBe(false);
  });
  it("returns typed data, upstream error codes and transport failures", async () => {
    const origin = "http://upstream.railway.internal:3000";
    const ok = await upstreamJson<{ board: { proposals: unknown[] } }>(
      "/api/x",
      {
        origin,
        fetcher: vi.fn(async () => json(200, { board: { proposals: [] } })),
      },
    );
    expect(ok).toEqual({
      ok: true,
      status: 200,
      data: { board: { proposals: [] } },
    });
    const missing = await upstreamJson("/api/x", {
      origin,
      fetcher: vi.fn(async () => json(404, { error: "PROPOSAL_NOT_FOUND" })),
    });
    expect(missing).toEqual({
      ok: false,
      status: 404,
      error: "PROPOSAL_NOT_FOUND",
    });
    const html = await upstreamJson("/api/x", {
      origin,
      fetcher: vi.fn(async () => new Response("<html>", { status: 502 })),
    });
    expect(html).toEqual({ ok: false, status: 502, error: "HTTP_502" });
    const down = await upstreamJson("/api/x", {
      origin,
      fetcher: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    });
    expect(down).toEqual({ ok: false, status: 0, error: "UNREACHABLE" });
    const slow = await upstreamJson("/api/x", {
      origin,
      timeoutMs: 10,
      fetcher: vi.fn(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            (init as RequestInit).signal?.addEventListener("abort", () =>
              reject(
                Object.assign(new Error("aborted"), { name: "AbortError" }),
              ),
            );
          }),
      ),
    });
    expect(slow).toEqual({ ok: false, status: 0, error: "TIMEOUT" });
    expect(await upstreamJson("/api/x", { origin: null })).toEqual({
      ok: false,
      status: 503,
      error: "PARTICIPATION_NOT_CONFIGURED",
    });
  });
  it("sends the session cookie and never follows redirects off the private origin", async () => {
    const fetcher = vi.fn(async () => json(200, { session: null }));
    await upstreamJson("/api/auth/session", {
      origin: "http://upstream.railway.internal:3000",
      cookie: "zcap_session=abc",
      fetcher,
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "http://upstream.railway.internal:3000/api/auth/session",
    );
    expect(init.redirect).toBe("manual");
    expect((init.headers as Record<string, string>).cookie).toBe(
      "zcap_session=abc",
    );
  });
});
