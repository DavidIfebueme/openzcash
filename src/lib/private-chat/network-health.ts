import { z } from "zod";

export type NetworkHealthState = "ok" | "degraded" | "down" | "unknown";
export const NETWORK_REFRESH_MS = 120_000;
export const NETWORK_STATUS_PATH = "/api/private-chat/network-status";
export const NYM_STATUS_URL = "https://status.nym.com";
export const NYM_EXPLORER_URL = "https://nym.com/explorer";
// SDK 1.4.1 default_debug().topology.minimum_gateway_performance.
export const MIN_GATEWAY_PERFORMANCE = 0.5;
const SERVICE_MAX_AGE_MS = 5 * 60_000;
const TOPOLOGY_MAX_AGE_MS = 30 * 60_000;

const stateSchema = z.enum(["ok", "degraded", "down", "unknown"]);
const serviceSchema = z.object({
  state: stateSchema, up: z.number().int().nonnegative(), total: z.number().int().nonnegative(),
});
const topologySchema = z.object({
  state: stateSchema, count: z.number().int().nonnegative().nullable(),
});
export const networkHealthSchema = z.object({
  checkedAt: z.number().finite(),
  services: z.object({ validators: serviceSchema, signers: serviceSchema, api: serviceSchema }),
  mixnodes: topologySchema,
  gateways: topologySchema,
  gateway: z.object({
    state: stateSchema,
    performance: z.number().min(0).max(100).nullable(),
    reason: z.enum(["eligible", "below-minimum", "not-listed", "unconfigured", "unavailable"]),
  }),
});
export type NetworkHealth = z.infer<typeof networkHealthSchema>;

const endpointsSchema = z.array(z.object({
  name: z.string(), group: z.string(),
  results: z.array(z.object({ success: z.boolean(), timestamp: z.string() })),
})).max(500);
const nodesSchema = z.object({
  metadata: z.object({ refreshed_at: z.string(), status: z.unknown() }),
  nodes: z.object({
    pagination: z.object({ total: z.number().int().nonnegative(), page: z.number().int(), size: z.number().int() }),
    data: z.array(z.object({
      ed25519_identity_pubkey: z.string(),
      performance: z.union([z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/), z.number().min(0).max(1)]).transform(Number),
    })).max(5000),
  }),
});

function recent(timestamp: number, now: number, maxAge: number) {
  return Number.isFinite(timestamp) && timestamp <= now + 60_000 && now - timestamp <= maxAge;
}
function topologyTimestamp(value: string) {
  // Nym's time crate also emits "2026-10-21 00:40:50.732117176 +00:00:00".
  const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{2}:\d{2}):00$/, "$1T$2$3");
  return Date.parse(normalized);
}
function topology(input: unknown, now: number) {
  const parsed = nodesSchema.safeParse(input);
  if (!parsed.success || !recent(topologyTimestamp(parsed.data.metadata.refreshed_at), now, TOPOLOGY_MAX_AGE_MS)) return null;
  // Never treat an incomplete page as the complete network, or a missing gateway as an outage.
  const { pagination, data } = parsed.data.nodes;
  if (pagination.page !== 0 || pagination.total !== data.length || pagination.size !== data.length) return null;
  if (!parsed.data.metadata.status || typeof parsed.data.metadata.status !== "object" || !("fresh" in parsed.data.metadata.status)) return null;
  return parsed.data.nodes;
}

export function summarizeNetworkHealth(
  inputs: { services: unknown; mixnodes: unknown; gateways: unknown },
  gatewayId: string | undefined,
  now = Date.now(),
): NetworkHealth {
  const parsed = endpointsSchema.safeParse(inputs.services);
  const endpoints = parsed.success ? parsed.data : [];
  function service(matches: (endpoint: typeof endpoints[number]) => boolean) {
    const rows = endpoints.filter(matches);
    let up = 0, down = 0;
    for (const row of rows) {
      const latest = row.results.reduce<typeof row.results[number] | undefined>((a, b) =>
        !a || Date.parse(b.timestamp) > Date.parse(a.timestamp) ? b : a, undefined);
      if (!latest || !recent(Date.parse(latest.timestamp), now, SERVICE_MAX_AGE_MS)) continue;
      if (latest.success) up++; else down++;
    }
    const state: NetworkHealthState = down ? (down === rows.length ? "down" : "degraded")
      : rows.length && up === rows.length ? "ok" : "unknown";
    return { state, up, total: rows.length };
  }
  const gateways = topology(inputs.gateways, now);
  const mixnodes = topology(inputs.mixnodes, now);
  const node = gatewayId ? gateways?.data.find(item => item.ed25519_identity_pubkey === gatewayId) : null;
  const gateway: NetworkHealth["gateway"] = !gatewayId
    ? { state: "unknown", performance: null, reason: "unconfigured" }
    : !gateways ? { state: "unknown", performance: null, reason: "unavailable" }
    : !node ? { state: "down", performance: null, reason: "not-listed" }
    : { state: node.performance >= MIN_GATEWAY_PERFORMANCE ? "ok" : "degraded",
      performance: Math.round(node.performance * 1000) / 10,
      reason: node.performance >= MIN_GATEWAY_PERFORMANCE ? "eligible" : "below-minimum" };
  const count = (nodes: ReturnType<typeof topology>) => ({
    state: (nodes ? nodes.pagination.total > 0 ? "ok" : "degraded" : "unknown") as NetworkHealthState,
    count: nodes?.pagination.total ?? null,
  });
  return {
    checkedAt: now,
    services: {
      // The official source exposes Nyx RPC health, not every validator's consensus status.
      validators: service(row => /nyx rpc|validator/i.test(row.name)),
      signers: service(row => /signer/i.test(row.group)),
      api: service(row => !/signer/i.test(row.group) && /api/i.test(row.name)),
    },
    mixnodes: count(mixnodes), gateways: count(gateways), gateway,
  };
}

export function networkHealthState(data: NetworkHealth | null): NetworkHealthState {
  if (!data) return "unknown";
  const states = [...Object.values(data.services), data.mixnodes, data.gateways, data.gateway].map(item => item.state);
  if (states.some(state => state === "down" || state === "degraded")) return "degraded";
  return states.includes("unknown") ? "unknown" : "ok";
}
