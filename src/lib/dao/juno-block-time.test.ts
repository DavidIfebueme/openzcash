import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn<typeof fetch>();
const height = 43_776_268;
const time = "2026-11-15T18:39:29.957403480Z";
const header = { chain_id: "juno-1", height: String(height), time };
const at = Date.parse("2026-11-17T04:35:00Z");

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(at);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Juno proposal creation blocks", () => {
  it.each(["block", "sdk_block"])("reads the exact block timestamp from %s", async (key) => {
    fetchMock.mockResolvedValueOnce(Response.json({ [key]: { header } }));
    const { junoBlockTime } = await import("./juno-block-time");
    expect(await junoBlockTime(height)).toBe("2026-11-15T18:39:29.957Z");
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://rest.cosmos.directory/juno/cosmos/base/tendermint/v1beta1/blocks/${height}`);
  });

  it("shares simultaneous requests and keeps the immutable date across refreshes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ block: { header } }));
    const { junoBlockTime } = await import("./juno-block-time");
    const dates = await Promise.all([junoBlockTime(height), junoBlockTime(height)]);
    expect(dates).toEqual(["2026-11-15T18:39:29.957Z", "2026-11-15T18:39:29.957Z"]);
    vi.setSystemTime(at + 600_001);
    expect(await junoBlockTime(height)).toBe(dates[0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("does not query an invalid height %s", async (value) => {
    expect(await (await import("./juno-block-time")).junoBlockTime(value)).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { ...header, chain_id: "other-chain" },
    { ...header, height: String(height + 1) },
    { ...header, time: "unavailable" },
    { ...header, time: "2027-01-01T00:00:00Z" },
    {},
  ])("leaves unverified headers undated: %j", async (invalid) => {
    fetchMock.mockResolvedValueOnce(Response.json({ block: { header: invalid } }));
    expect(await (await import("./juno-block-time")).junoBlockTime(height)).toBe("");
  });

  it("backs off failed reads and recovers without using the fetch time", async () => {
    fetchMock.mockResolvedValueOnce(new Response("block unavailable", { status: 404 }));
    const { junoBlockTime } = await import("./juno-block-time");
    expect(await junoBlockTime(height)).toBe("");
    expect(await junoBlockTime(height)).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(at + 60_001);
    fetchMock.mockResolvedValueOnce(Response.json({ sdk_block: { header } }));
    expect(await junoBlockTime(height)).toBe("2026-11-15T18:39:29.957Z");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
