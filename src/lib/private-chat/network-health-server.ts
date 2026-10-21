import "server-only";
import { summarizeNetworkHealth, type NetworkHealth } from "./network-health";

const SOURCES = {
  services: "https://status.nym.com/api/v1/endpoints/statuses?page=1&pageSize=1",
  mixnodes: "https://validator.nymtech.net/api/v2/unstable/nym-nodes/skimmed/mixnodes/active",
  gateways: "https://validator.nymtech.net/api/v2/unstable/nym-nodes/skimmed/entry-gateways",
} as const;
const CACHE_MS = 60_000;
const MAX_BYTES = 2_000_000;

async function source(url: string, request: typeof fetch): Promise<unknown> {
  try {
    const response = await request(url, {
      headers: { Accept: "application/json" },
      credentials: "omit", redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    // Unknown is not an outage. Never log browser/session data or upstream payloads.
    return null;
  }
}

/** Shared public snapshot: no per-user parameters, headers, cookies or persistent storage. */
export function createNetworkHealthReader(request: typeof fetch = fetch, now = Date.now) {
  let cached: { key: string | undefined; data: NetworkHealth; until: number } | null = null;
  let pending: { key: string | undefined; promise: Promise<NetworkHealth> } | null = null;
  return async (gatewayId: string | undefined) => {
    if (cached?.key === gatewayId && cached && now() < cached.until) return cached.data;
    if (pending?.key === gatewayId && pending) return pending.promise;
    const promise = Promise.all(Object.entries(SOURCES).map(async ([name, url]) => [name, await source(url, request)] as const))
      .then(entries => {
        const values = Object.fromEntries(entries);
        const data = summarizeNetworkHealth({ services: values.services, mixnodes: values.mixnodes, gateways: values.gateways }, gatewayId, now());
        cached = { key: gatewayId, data, until: now() + CACHE_MS };
        return data;
      }).finally(() => { if (pending?.promise === promise) pending = null; });
    pending = { key: gatewayId, promise };
    return promise;
  };
}
export const readNetworkHealth = createNetworkHealthReader();
