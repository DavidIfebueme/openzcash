import { z } from "zod";
import type { Venue } from "./model";

export type WrappedAsset = {
  id: string;
  chain: string;
  chainName: string;
  symbol: string;
  issuer: string;
  token: string;
  registry: string;
  explorer: string;
  rpc?: string;
  chainId?: number;
};
const universal = "0x83f31af747189c2fa9e5deb253200c505eff6ed2";
const omniRegistry = "https://1click.chaindefuser.com/v0/tokens";
export const WRAPPED_ASSETS: WrappedAsset[] = [
  {
    id: "cbzec-base",
    chain: "base",
    chainName: "Base",
    symbol: "cbZEC",
    issuer: "Coinbase",
    token: "0xB2000000000000000000008501b13360000cb2EC",
    registry: "https://www.coinbase.com/campaigns/wrapped-assets",
    explorer: "https://basescan.org/token/",
    rpc: "https://mainnet.base.org",
    chainId: 8453,
  },
  {
    id: "omni-solana",
    chain: "solana",
    chainName: "Solana",
    symbol: "ZEC",
    issuer: "OmniBridge",
    token: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    registry: omniRegistry,
    explorer: "https://explorer.solana.com/address/",
    rpc: "https://api.mainnet-beta.solana.com",
  },
  {
    id: "zenzec-solana",
    chain: "solana",
    chainName: "Solana",
    symbol: "zenZEC",
    issuer: "Zenrock",
    token: "JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS",
    registry: "https://docs.zenrocklabs.io/zenrock-litepaper.pdf",
    explorer: "https://explorer.solana.com/address/",
    rpc: "https://api.mainnet-beta.solana.com",
  },
  {
    id: "binance-bsc",
    chain: "bsc",
    chainName: "BNB Chain",
    symbol: "ZEC",
    issuer: "Binance-Peg",
    token: "0x1Ba42e5193dfA8B03D15dd1B86a3113bbBEF8Eeb",
    registry: "https://explorer.bnbchain.org/asset/ZEC-93E",
    explorer: "https://bscscan.com/token/",
    rpc: "https://bsc-dataseed.binance.org",
    chainId: 56,
  },
  ...[
    {
      chain: "base",
      chainName: "Base",
      explorer: "https://basescan.org/token/",
      rpc: "https://mainnet.base.org",
      chainId: 8453,
    },
    {
      chain: "polygon",
      chainName: "Polygon",
      explorer: "https://polygonscan.com/token/",
    },
    {
      chain: "worldchain",
      chainName: "World Chain",
      explorer: "https://worldscan.org/token/",
    },
    {
      chain: "katana",
      chainName: "Katana",
      explorer: "https://katanascan.com/token/",
    },
    {
      chain: "solana",
      chainName: "Solana",
      explorer: "https://explorer.solana.com/address/",
      rpc: "https://api.mainnet-beta.solana.com",
    },
  ].map((chain) => ({
    ...chain,
    id: `universal-${chain.chain}`,
    symbol: "uZEC",
    issuer: "Universal",
    token:
      chain.chain === "solana"
        ? "HouLAv3gAthwjweq5eCWS8SkxpvXukaqtr47635F86Yq"
        : universal,
    registry: "https://docs.universal.xyz/docs/developers/contract-addresses",
  })),
  {
    id: "omni-starknet",
    chain: "starknet",
    chainName: "Starknet",
    symbol: "ZEC",
    issuer: "OmniBridge",
    token: "0x05ce53b9b68fb8e9ecab9283a96d97948914733fd6ed8d9a53a276a419497841",
    registry: omniRegistry,
    explorer: "https://voyager.online/contract/",
  },
  {
    id: "omni-aptos",
    chain: "aptos",
    chainName: "Aptos",
    symbol: "ZEC",
    issuer: "OmniBridge",
    token: "0x261c85bc1bb5acc3ffcf769530c732d4182c3bbd84936d427125fcd4732e9879",
    registry: omniRegistry,
    explorer: "https://explorer.aptoslabs.com/object/",
  },
];
export const wrappedUrl = (a: WrappedAsset) =>
  `https://api.dexscreener.com/token-pairs/v1/${a.chain}/${a.token}`;
export type WrappedPool = {
  id: string;
  dex: string;
  volumeUsd: number;
  liquidityUsd: number | null;
  assetId: string;
  chain: string;
  asOf: string;
  source: string;
};
export function parseWrappedPools(
  raw: unknown,
  asset: WrappedAsset,
  asOf: string,
): WrappedPool[] {
  const rows = z
    .array(
      z.object({
        chainId: z.literal(asset.chain),
        dexId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        pairAddress: z.string().min(1),
        baseToken: z.object({ address: z.string() }),
        quoteToken: z.object({ address: z.string() }),
        volume: z.object({ h24: z.number().finite().nonnegative() }),
        liquidity: z
          .object({ usd: z.number().finite().nonnegative().nullish() })
          .nullish(),
      }),
    )
    .parse(raw);
  const normalize = (s: string) =>
    asset.chain === "solana" ? s : s.toLowerCase();
  const pools = new Map<string, WrappedPool>();
  for (const row of rows) {
    if (
      ![row.baseToken.address, row.quoteToken.address].some(
        (a) => normalize(a) === normalize(asset.token),
      )
    )
      throw new Error("Pool does not contain the registered ZEC contract");
    const id = `${asset.chain}:${normalize(row.pairAddress)}`;
    if (!pools.has(id))
      pools.set(id, {
        id,
        dex: normalizeDexId(row.dexId),
        volumeUsd: row.volume.h24,
        liquidityUsd: row.liquidity?.usd ?? null,
        assetId: asset.id,
        chain: asset.chain,
        asOf,
        source: wrappedUrl(asset),
      });
  }
  return [...pools.values()];
}
export const dexNames: Record<string, string> = {
  orca: "Orca",
  raydium: "Raydium",
  meteora: "Meteora",
  aerodrome: "Aerodrome",
  uniswap: "Uniswap",
  pancakeswap: "PancakeSwap",
  apeswap: "ApeSwap",
  pumpswap: "PumpSwap",
};
/** Keep protocol versions under one venue without conflating different chains. */
export function normalizeDexId(id: string): string {
  if (
    /^uniswap(?:[-_]v[234])?(?:[-_](?:base|bsc|solana|polygon|worldchain|katana|starknet|aptos))?$/.test(
      id,
    )
  )
    return "uniswap";
  if (
    /^pancakeswap(?:[-_](?:v[234]|infinity-clmm|infinity-bin))?(?:[-_](?:base|bsc|solana|polygon|worldchain|katana|starknet|aptos))?$/.test(
      id,
    )
  )
    return "pancakeswap";
  return id;
}
/** Deduplicate across asset feeds too: a cbZEC/uZEC pool is still one market. */
export function aggregateWrappedPools(pools: WrappedPool[]): {
  venues: Venue[];
  pools: WrappedPool[];
} {
  const unique = new Map<string, WrappedPool>();
  for (const pool of [...pools].sort(
    (a, b) => Date.parse(b.asOf) - Date.parse(a.asOf),
  ))
    if (!unique.has(pool.id)) unique.set(pool.id, pool);
  const venues = new Map<string, Venue>();
  for (const p of unique.values()) {
    const id = `wrapped-${p.chain}-${p.dex}`;
    const v = venues.get(id);
    if (v) {
      v.volumeUsd += p.volumeUsd;
      v.liquidityUsd =
        v.liquidityUsd != null && p.liquidityUsd != null
          ? v.liquidityUsd + p.liquidityUsd
          : null;
      v.pairs++;
    } else
      venues.set(id, {
        id,
        name: `${dexNames[p.dex] ?? p.dex} · ${WRAPPED_ASSETS.find((a) => a.chain === p.chain)?.chainName ?? p.chain}`,
        kind: "dex",
        volumeUsd: p.volumeUsd,
        liquidityUsd: p.liquidityUsd,
        pairs: 1,
        asOf: p.asOf,
        source: p.source,
        note: "Registered ZEC contracts only. Returned pools counted once across tokens. Indexer coverage can be partial; timestamp is retrieval time. Routed activity may overlap with intents.",
      });
  }
  return { venues: [...venues.values()], pools: [...unique.values()] };
}
export function resolveWrappedPools(
  reads: PromiseSettledResult<WrappedPool[]>[],
) {
  return resolveWrappedCoverage(reads).pools;
}

export type WrappedPoolCoverage = {
  pools: WrappedPool[];
  /** Some queried coverage failed or reached a provider/page limit. */
  partial: boolean;
  /** A limit was reached; additional pools may exist. */
  limited: boolean;
  failedSources: number;
};

export function resolveWrappedCoverage(
  reads: PromiseSettledResult<WrappedPool[] | WrappedPoolCoverage>[],
): WrappedPoolCoverage {
  const success = reads.filter((r) => r.status === "fulfilled");
  const coverages = success.map((r) =>
    Array.isArray(r.value)
      ? { pools: r.value, partial: false, limited: false, failedSources: 0 }
      : r.value,
  );
  const failedSources =
    reads.length -
    success.length +
    coverages.reduce((sum, c) => sum + c.failedSources, 0);
  const limited = coverages.some((c) => c.limited);
  const partial =
    failedSources > 0 || limited || coverages.some((c) => c.partial);
  const pools = aggregateWrappedPools(coverages.flatMap((c) => c.pools)).pools;
  // An empty alternative cannot prove an empty market when coverage failed.
  // Nonempty partial coverage is retained, with its limitations attached.
  if (!success.length || (!pools.length && partial))
    throw new Error("Pool coverage unavailable");
  return { pools, partial, limited, failedSources };
}
const uint = z.string().regex(/^\d+$/);
export function tokenUnits(raw: string, decimals: number): number {
  uint.parse(raw);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new Error("Invalid decimals");
  const scale = 10n ** BigInt(decimals),
    units = BigInt(raw);
  if (units > 21_000_000n * scale)
    throw new Error("Supply exceeds native ZEC maximum");
  return Number(units / scale) + Number(units % scale) / Number(scale);
}
export function parseSolanaSupply(raw: unknown) {
  const r = z
    .object({
      result: z.object({
        context: z.object({ slot: z.number().int().positive() }),
        value: z.object({ amount: uint, decimals: z.number().int() }),
      }),
    })
    .parse(raw).result;
  return {
    zec: tokenUnits(r.value.amount, r.value.decimals),
    block: String(r.context.slot),
  };
}
export function rpcHex(raw: unknown): string {
  return z.object({ result: z.string().regex(/^0x[0-9a-fA-F]+$/) }).parse(raw)
    .result;
}

export const geckoPoolsUrl = (a: WrappedAsset, page = 1) =>
  `https://api.geckoterminal.com/api/v2/networks/${a.chain}/tokens/${a.token}/pools?page=${page}`;
export function parseGeckoPools(
  raw: unknown,
  asset: WrappedAsset,
  asOf: string,
): WrappedPool[] {
  const numeric = z
    .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/)])
    .transform(Number)
    .pipe(z.number().finite().nonnegative());
  const relationship = z.object({ data: z.object({ id: z.string() }) });
  const rows = z
    .object({
      data: z.array(
        z.object({
          attributes: z.object({
            address: z.string().min(1),
            volume_usd: z.object({ h24: numeric }),
            reserve_in_usd: numeric.nullish(),
          }),
          relationships: z.object({
            base_token: relationship,
            quote_token: relationship,
            dex: relationship,
          }),
        }),
      ),
    })
    .parse(raw).data;
  const parsed = parseWrappedPools(
    rows.map((r) => ({
      chainId: asset.chain,
      dexId: r.relationships.dex.data.id.replace(/-solana$/, ""),
      pairAddress: r.attributes.address,
      baseToken: {
        address: r.relationships.base_token.data.id.replace(
          `${asset.chain}_`,
          "",
        ),
      },
      quoteToken: {
        address: r.relationships.quote_token.data.id.replace(
          `${asset.chain}_`,
          "",
        ),
      },
      volume: { h24: r.attributes.volume_usd.h24 },
      liquidity: { usd: r.attributes.reserve_in_usd ?? null },
    })),
    asset,
    asOf,
  );
  return parsed.map((p) => ({ ...p, source: geckoPoolsUrl(asset) }));
}

/** Keep verified pages even if a subsequent request fails or is rate limited. */
export async function readGeckoPoolCoverage(
  asset: WrappedAsset,
  loadPage: (page: number) => Promise<unknown>,
  asOf: string,
  maxPages = 3,
): Promise<WrappedPoolCoverage> {
  if (!Number.isInteger(maxPages) || maxPages < 1)
    throw new Error("Invalid pool page limit");
  const pools: WrappedPool[] = [];
  let limited = false;
  let failedSources = 0;
  for (let page = 1; page <= maxPages; page++) {
    try {
      const raw = await loadPage(page);
      const batch = parseGeckoPools(raw, asset, asOf);
      // Use the provider row count: duplicate rows must not stop pagination.
      const count = z.object({ data: z.array(z.unknown()) }).parse(raw)
        .data.length;
      pools.push(
        ...batch.map((p) => ({ ...p, source: geckoPoolsUrl(asset, page) })),
      );
      if (count < 20) break;
      if (page === maxPages) limited = true;
    } catch {
      failedSources = 1;
      break;
    }
  }
  return {
    pools: aggregateWrappedPools(pools).pools,
    partial: limited || failedSources > 0,
    limited,
    failedSources,
  };
}

const kaminoReserve = z.object({
  name: z.string(),
  lendingMarket: z.string(),
  collateralReserve: z.string(),
  collateralMint: z.string(),
});
export function parseKaminoRegistry(raw: unknown) {
  const registry = z
    .object({ collateralReserves: z.array(kaminoReserve) })
    .parse(raw).collateralReserves;
  const known = new Set(
    WRAPPED_ASSETS.filter((a) => a.chain === "solana").map((a) => a.token),
  );
  const unique = new Map<string, z.infer<typeof kaminoReserve>>();
  for (const r of registry)
    if (known.has(r.collateralMint))
      unique.set(`${r.lendingMarket}:${r.collateralReserve}`, r);
  return {
    reserves: [...unique.values()],
    unidentified: registry.filter(
      (r) =>
        /\bZEC\b|zcash|zenzec|uzec/i.test(r.name) &&
        !known.has(r.collateralMint),
    ),
  };
}
export function parseKaminoMetrics(
  raw: unknown,
  reserves: ReturnType<typeof parseKaminoRegistry>["reserves"],
) {
  const amount = z
    .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
    .transform(Number)
    .pipe(z.number().finite().nonnegative());
  const rows = z
    .array(
      z.object({
        reserve: z.string(),
        liquidityTokenMint: z.string(),
        totalSupply: amount,
        totalBorrow: amount,
      }),
    )
    .parse(raw);
  return reserves.map((r) => {
    const row = rows.find(
      (v) =>
        v.reserve === r.collateralReserve &&
        v.liquidityTokenMint === r.collateralMint,
    );
    if (!row) throw new Error("Kamino reserve identity changed");
    if (row.totalSupply > 21_000_000 || row.totalBorrow > 21_000_000)
      throw new Error("Invalid ZEC reserve amount");
    return {
      market: r.lendingMarket,
      reserve: row.reserve,
      mint: row.liquidityTokenMint,
      zec: row.totalSupply,
      borrowedZec: row.totalBorrow,
    };
  });
}

// Historical issuer-published contract; never enters active trading/supply totals.
export const LEGACY_SOLANA_ZEC: WrappedAsset = {
  id: "renzec-solana",
  chain: "solana",
  chainName: "Solana",
  symbol: "renZEC",
  issuer: "Ren 1.0",
  token: "E99CQ2gFMmbiyK2bwiaFNWUUmwz4r8k2CVEFxwuvQ7ue",
  registry:
    "https://medium.com/renprotocol/renvm-integrates-with-solana-for-interoperability-cee10832356a",
  explorer: "https://explorer.solana.com/address/",
  rpc: "https://api.mainnet-beta.solana.com",
};
