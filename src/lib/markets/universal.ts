import { z } from "zod";
import type { Venue } from "./model";

// Issuer registry: https://docs.universal.xyz/docs/developers/contract-addresses
// Universal uZEC is distinct from Hyperliquid's Unit UZEC.
const evm = "0x83f31af747189c2fa9e5deb253200c505eff6ed2";
export const UNIVERSAL_ASSETS = [
  { chain: "base", name: "Base", token: evm },
  { chain: "polygon", name: "Polygon", token: evm },
  { chain: "worldchain", name: "World Chain", token: evm },
  { chain: "katana", name: "Katana", token: evm },
  {
    chain: "solana",
    name: "Solana",
    token: "HouLAv3gAthwjweq5eCWS8SkxpvXukaqtr47635F86Yq",
  },
] as const;
export type UniversalAsset = (typeof UNIVERSAL_ASSETS)[number];
export const universalUrl = (asset: UniversalAsset) =>
  `https://api.dexscreener.com/token-pairs/v1/${asset.chain}/${asset.token}`;

export function parseUniversalPools(
  raw: unknown,
  asset: UniversalAsset,
  asOf: string,
): Venue[] {
  const rows = z
    .array(
      z.object({
        chainId: z.literal(asset.chain),
        dexId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        pairAddress: z.string().min(1),
        baseToken: z.object({ address: z.string() }),
        quoteToken: z.object({ address: z.string() }),
        volume: z.object({ h24: z.number().finite().nonnegative() }),
      }),
    )
    .parse(raw);
  const normalize = (s: string) =>
    asset.chain === "solana" ? s : s.toLowerCase();
  const seen = new Set<string>();
  const venues = new Map<string, Venue>();
  for (const row of rows) {
    if (
      ![row.baseToken.address, row.quoteToken.address].some(
        (a) => normalize(a) === normalize(asset.token),
      )
    )
      throw new Error("Pool does not contain the issuer's ZEC token");
    const poolId = normalize(row.pairAddress);
    if (seen.has(poolId)) continue;
    seen.add(poolId);
    const id = `universal-${asset.chain}-${row.dexId}`;
    const venue = venues.get(id);
    if (venue) {
      venue.volumeUsd += row.volume.h24;
      venue.pairs++;
    } else
      venues.set(id, {
        id,
        name: `${row.dexId === "aerodrome" ? "Aerodrome" : row.dexId} · uZEC · ${asset.name}`,
        kind: "dex",
        volumeUsd: row.volume.h24,
        pairs: 1,
        asOf,
        source: universalUrl(asset),
        note: "Universal's issuer-listed uZEC contract. All returned pools counted once by address. Timestamp is retrieval time; provider exposes no quote timestamp. Wrapped tokens are not additional native ZEC supply.",
      });
  }
  return [...venues.values()];
}
