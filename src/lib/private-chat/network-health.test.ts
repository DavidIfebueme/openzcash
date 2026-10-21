import { describe, expect, it, vi } from "vitest";
import { summarizeNetworkHealth, networkHealthState } from "./network-health";
vi.mock("server-only", () => ({}));
import { createNetworkHealthReader } from "./network-health-server";

const now = Date.parse("2026-10-21T00:42:00Z");
const endpoint = (name: string, group = "Mainnet", success = true, age = 0) => ({
  name, group, results: [{ success, timestamp: new Date(now - age).toISOString() }],
});
const services = [endpoint("Nyx RPC"), endpoint("Nym API"), endpoint("Harbour Master API"), endpoint("Signer 1", "Nym-Api Signers")];
const nodes = (performance = "0.99") => ({
  metadata: { status: { fresh: {} }, refreshed_at: "2026-10-21 00:40:50.732117176 +00:00:00" },
  nodes: { pagination: { total: 1, page: 0, size: 1 }, data: [{ ed25519_identity_pubkey: "gateway", performance, role: "Inactive", ip_addresses: ["192.0.2.1"] }] },
});
const inputs = () => ({ services, mixnodes: nodes(), gateways: nodes() });

describe("public Nym network status", () => {
  it("reports separate checks without exposing node addresses or raw source data", () => {
    const result = summarizeNetworkHealth(inputs(), "gateway", now);
    expect(result.services).toEqual({
      validators: { state: "ok", up: 1, total: 1 }, signers: { state: "ok", up: 1, total: 1 }, api: { state: "ok", up: 2, total: 2 },
    });
    expect(result.gateway).toEqual({ state: "ok", performance: 99, reason: "eligible" });
    expect(networkHealthState(result)).toBe("ok");
    expect(JSON.stringify(result)).not.toContain("192.0.2.1");
    expect(JSON.stringify(result)).not.toContain("ed25519");
  });
  it("flags the 38% gateway regression without rejecting the Inactive epoch role", () => {
    const result = summarizeNetworkHealth({ ...inputs(), gateways: nodes("0.38") }, "gateway", now);
    expect(result.gateway).toEqual({ state: "degraded", performance: 38, reason: "below-minimum" });
    expect(networkHealthState(result)).toBe("degraded");
    expect(summarizeNetworkHealth({ ...inputs(), gateways: nodes("0.50") }, "gateway", now).gateway.state).toBe("ok");
  });
  it("distinguishes missing gateway, missing configuration and unavailable source", () => {
    expect(summarizeNetworkHealth(inputs(), "missing", now).gateway.reason).toBe("not-listed");
    expect(summarizeNetworkHealth(inputs(), undefined, now).gateway.reason).toBe("unconfigured");
    const result = summarizeNetworkHealth({ ...inputs(), gateways: null }, "gateway", now);
    expect(result.gateway.reason).toBe("unavailable");
    expect(result.services.signers.state).toBe("ok");
    expect(networkHealthState(result)).toBe("unknown");
  });
  it("does not turn stale or malformed measurements into healthy or failed services", () => {
    const result = summarizeNetworkHealth({ ...inputs(), services: [endpoint("Nyx RPC", "Mainnet", true, 360_000)] }, "gateway", now);
    expect(result.services.validators.state).toBe("unknown");
    expect(result.services.signers.state).toBe("unknown");
    expect(summarizeNetworkHealth({ services: {}, gateways: [], mixnodes: null }, "gateway", now).gateways.count).toBeNull();
    expect(summarizeNetworkHealth(inputs(), "gateway", now + 31 * 60_000).gateways.state).toBe("unknown");
  });
  it("selects the latest observation and marks partial signer failures", () => {
    const result = summarizeNetworkHealth({ ...inputs(), services: [
      { ...endpoint("Nyx RPC"), results: [{ success: true, timestamp: new Date(now).toISOString() }, { success: false, timestamp: new Date(now - 1000).toISOString() }] },
      endpoint("Signer 1", "Signers"), endpoint("Signer 2", "Signers", false),
    ] }, "gateway", now);
    expect(result.services.validators.state).toBe("ok");
    expect(result.services.signers).toEqual({ state: "degraded", up: 1, total: 2 });
  });
  it("never interprets a partial topology page or stale epoch as a missing gateway", () => {
    const incomplete = nodes(); incomplete.nodes.pagination.total = 2;
    expect(summarizeNetworkHealth({ ...inputs(), gateways: incomplete }, "missing", now).gateway.reason).toBe("unavailable");
    const stale = { ...nodes(), metadata: { ...nodes().metadata, status: { stale: {} } } };
    expect(summarizeNetworkHealth({ ...inputs(), gateways: stale }, "gateway", now).gateway.state).toBe("unknown");
  });
  it("rejects percentages outside the upstream 0..1 scale", () => {
    expect(summarizeNetworkHealth({ ...inputs(), gateways: nodes("99") }, "gateway", now).gateway.state).toBe("unknown");
  });
  it("shares a bounded cache and in-flight request across visitors, including failures", async () => {
    let clock = now;
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.credentials).toBe("omit");
      expect(init?.redirect).toBe("error");
      expect(init?.headers).toEqual({ Accept: "application/json" });
      if (url.includes("entry-gateways")) throw new Error("source unavailable");
      return Response.json(url.includes("status.nym.com") ? services : nodes());
    }) as unknown as typeof fetch;
    const read = createNetworkHealthReader(request, () => clock);
    const [a, b] = await Promise.all([read("gateway"), read("gateway")]);
    expect(a).toEqual(b);
    expect(a.gateways.state).toBe("unknown");
    expect(request).toHaveBeenCalledTimes(3);
    await read("gateway"); expect(request).toHaveBeenCalledTimes(3);
    clock += 60_001;
    await read("gateway"); expect(request).toHaveBeenCalledTimes(6);
  });
});
