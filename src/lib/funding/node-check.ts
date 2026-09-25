import "server-only";
import { z } from "zod";

/**
 * Chain value pools as a node reports them, read from CipherScan's public
 * Zebra-backed API and cached briefly. Used to show the consensus rules
 * reproducing a live balance, and the pool sizes around Ironwood.
 */
const SOURCE = "https://api.mainnet.cipherscan.app/api/blockchain-info";
const TTL_MS = 5 * 60_000;

const schema = z.object({
  blocks: z.number().int().positive(),
  valuePools: z.array(
    z.object({ id: z.string(), chainValueZat: z.number().int().nonnegative() }),
  ),
});

export type NodePools = {
  height: number;
  pools: Record<string, number>;
  source: string;
};
export type NodeLockbox = { height: number; zat: number; source: string };

let cache: { value: NodePools; at: number } | null = null;

export async function nodeValuePools(): Promise<NodePools | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const res = await fetch(SOURCE, {
    headers: {
      accept: "application/json",
      "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)",
    },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!res.ok) return cache?.value ?? null;
  const info = schema.parse(await res.json());
  const value = {
    height: info.blocks,
    pools: Object.fromEntries(
      info.valuePools.map((p) => [p.id, p.chainValueZat]),
    ),
    source: SOURCE,
  };
  cache = { value, at: Date.now() };
  return value;
}

export async function nodeLockboxPool(): Promise<NodeLockbox | null> {
  const node = await nodeValuePools();
  const zat = node?.pools.lockbox;
  return node && zat !== undefined
    ? { height: node.height, zat, source: node.source }
    : null;
}

const addressSchema = z.object({
  address: z.string(),
  balance: z.number().int().nonnegative(),
  txCount: z.number().int().nonnegative(),
});
const addressCache = new Map<string, { value: AddressBalance; at: number }>();

export type AddressBalance = { address: string; zat: number; txCount: number; source: string };

/** A transparent address balance from CipherScan's public API, cached briefly. */
export async function addressBalance(address: string): Promise<AddressBalance | null> {
  const hit = addressCache.get(address);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const url = `https://api.mainnet.cipherscan.app/api/address/${address}?limit=1`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)" },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!res.ok) return hit?.value ?? null;
  const a = addressSchema.parse(await res.json());
  const value = { address: a.address, zat: a.balance, txCount: a.txCount, source: `https://cipherscan.app/address/${address}` };
  addressCache.set(address, { value, at: Date.now() });
  return value;
}
