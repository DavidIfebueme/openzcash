import { z } from "zod";

export const ZAT = 100_000_000;
export const MAX_SUPPLY = 21_000_000;
export const HOUR = 3_600_000;
const amount = z
  .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());
const date = z.string().refine((s) => Number.isFinite(Date.parse(s)));
const zat = amount.pipe(z.number().int().safe());

export type Venue = {
  id: string;
  name: string;
  kind: "cex" | "dex";
  role?: "execution" | "routing";
  volumeUsd: number;
  liquidityUsd?: number | null;
  pairs: number;
  asOf: string;
  source: string;
  note: string;
};
export type Exclusion = {
  name: string;
  pair: string;
  reason: string;
  volumeUsd: number | null;
};
export type MarketSet = {
  venues: Venue[];
  excluded: Exclusion[];
  received: number;
  included: number;
};

const exchangeSchema = z
  .array(z.object({ id: z.string(), type: z.array(z.string()) }))
  .min(1);
const marketSchema = z.object({
  exchange_id: z.string(),
  exchange_name: z.string(),
  pair: z.string(),
  base_currency_id: z.string(),
  quote_currency_id: z.string(),
  category: z.string(),
  outlier: z.boolean(),
  last_updated: date,
  quotes: z.object({ USD: z.object({ price: amount, volume_24h: amount }) }),
});

/** One source per execution venue; direct protocol feeds replace aggregator rows. */
export const DIRECT_VENUES = new Set([
  "hyperliquid",
  "hyperliquid-spot",
  "maya-protocol",
  "mayachain",
  "thorchain",
  "near-intents",
  "ref-finance",
  "rhea-finance",
  "pancakeswap-v3-bsc",
  "pancakeswap",
  "apeswap",
  "uniswap-v3-bsc",
  "orca",
  "raydium",
  "meteora",
]);

/**
 * Public order-book aliases verified 2026-09-23. These are execution identities,
 * not generic stablecoin equivalence: unrelated USD/USDC/USDT books stay separate.
 * Coinbase: https://www.coinbase.com/advanced-trade/spot
 * Gemini: https://www.gemini.com/blog/introducing-combined-usd-and-usd-stablecoin-order-books
 * HitBTC/Gleec/FMFW/Bequant public /api/3/public/trades/ZECBTC and ZECUSDT
 * return the same trade IDs, timestamps, prices and quantities.
 */
function marketBook(m: z.infer<typeof marketSchema>) {
  const ordinary = {
    key: `${m.exchange_id}:${m.base_currency_id}:${m.quote_currency_id}`,
    priority: 0,
    shared: false,
  };
  if (m.base_currency_id !== "zec-zcash") return ordinary;
  const usd = "usd-us-dollars";
  const usdc = "usdc-usd-coin";
  const unifiedQuotes: Record<string, string[]> = {
    coinbase: [usd, usdc],
    gemini: [usd, usdc, "gusd-gemini-dollar", "rlusd-ripple-usd"],
  };
  const quoteRank = unifiedQuotes[m.exchange_id]?.indexOf(m.quote_currency_id);
  if (quoteRank !== undefined && quoteRank >= 0)
    return {
      key: `${m.exchange_id}:zec-zcash:unified-usd`,
      priority: quoteRank,
      shared: true,
    };

  const sharedVenues = ["hitbtc", "gleec-btc-exchange", "fmfwio", "bequant"];
  const venueRank = sharedVenues.indexOf(m.exchange_id);
  // FMFW's legacy USD label refers to its USDT execution book.
  const quote =
    m.exchange_id === "fmfwio" && m.quote_currency_id === usd
      ? "usdt-tether"
      : m.quote_currency_id;
  if (venueRank >= 0 && ["btc-bitcoin", "usdt-tether"].includes(quote))
    return {
      key: `hitbtc-shared:zec-zcash:${quote}`,
      priority: venueRank,
      shared: true,
    };
  return ordinary;
}

export function parseMarkets(
  raw: unknown,
  exchanges: unknown,
  now: number,
): MarketSet {
  const types = new Map(
    exchangeSchema.parse(exchanges).map((e) => [e.id, e.type]),
  );
  const rows = z.array(z.unknown()).min(1).parse(raw);
  const venues = new Map<string, Venue>();
  const excluded: Exclusion[] = [];
  const seen = new Set<string>();
  let included = 0;
  // Prefer the canonical book when valid; fresh aliases remain a fallback.
  // Within the same book/feed priority, the latest quote wins.
  const ordered = rows
    .map((row) => marketSchema.safeParse(row))
    .sort(
      (a, b) =>
        (a.success ? marketBook(a.data).priority : 0) -
          (b.success ? marketBook(b.data).priority : 0) ||
        (b.success ? Date.parse(b.data.last_updated) : 0) -
          (a.success ? Date.parse(a.data.last_updated) : 0),
    );
  for (const result of ordered) {
    if (!result.success) {
      excluded.push({
        name: "Unusable market",
        pair: "—",
        reason: "Missing or invalid fields",
        volumeUsd: null,
      });
      continue;
    }
    const m = result.data;
    const kind = types.get(m.exchange_id);
    const { key, shared } = marketBook(m);
    let reason = "";
    if (
      m.base_currency_id !== "zec-zcash" &&
      m.quote_currency_id !== "zec-zcash"
    )
      reason = "Not a ZEC market";
    else if (
      m.category !== "Spot" ||
      kind?.includes("perpetuals") ||
      kind?.includes("futures")
    )
      reason = "Derivatives excluded";
    else if (m.outlier) reason = "Flagged as an outlier by CoinPaprika";
    else if (
      now - Date.parse(m.last_updated) > 2 * HOUR ||
      Date.parse(m.last_updated) > now + 5 * 60_000
    )
      reason = "Quote outside the freshness window";
    else if (DIRECT_VENUES.has(m.exchange_id))
      reason = "Replaced by the direct protocol source";
    else if (!kind || kind.includes("cex") === kind.includes("dex"))
      reason = "Venue type not verified";
    else if (seen.has(key))
      reason = shared
        ? "Shared order book already counted"
        : "Duplicate market";
    if (reason) {
      excluded.push({
        name: m.exchange_name,
        pair: m.pair,
        reason,
        volumeUsd: m.quotes.USD.volume_24h,
      });
      continue;
    }
    seen.add(key);
    included++;
    const current = venues.get(m.exchange_id);
    if (current) {
      current.volumeUsd += m.quotes.USD.volume_24h;
      current.pairs++;
      if (m.last_updated < current.asOf) current.asOf = m.last_updated;
    } else
      venues.set(m.exchange_id, {
        id: m.exchange_id,
        name: m.exchange_name,
        kind: kind!.includes("dex") ? "dex" : "cex",
        volumeUsd: m.quotes.USD.volume_24h,
        pairs: 1,
        asOf: m.last_updated,
        source: "https://api.coinpaprika.com/v1/coins/zec-zcash/markets",
        note: kind!.includes("dex")
          ? "Spot markets classified by CoinPaprika; may include wrapped ZEC."
          : "Reported spot volume; outliers and old quotes excluded.",
      });
  }
  return {
    venues: [...venues.values()].sort((a, b) => b.volumeUsd - a.volumeUsd),
    excluded,
    received: rows.length,
    included,
  };
}

export function comparison(cex: number | null, dex: number | null) {
  if (
    cex === null ||
    dex === null ||
    !Number.isFinite(cex) ||
    !Number.isFinite(dex) ||
    cex < 0 ||
    dex < 0 ||
    cex + dex === 0
  )
    return null;
  const total = cex + dex;
  const gap = Math.max(0, cex - dex);
  return {
    cex,
    dex,
    total,
    dexPct: (dex / total) * 100,
    cexPct: (cex / total) * 100,
    gap,
    multiplier: dex > 0 ? cex / dex : null,
    dexCexRatioPct: cex > 0 ? (dex / cex) * 100 : null,
    growthRequiredPct: dex > 0 ? (gap / dex) * 100 : null,
    reached: dex > cex,
    tied: dex === cex,
  };
}

/** Spot execution and routed activity are different accounting layers. */
export function spotBenchmark(tracked: Venue[]) {
  const venues = tracked.filter((v) => v.role !== "routing");
  const total = (kind: Venue["kind"]) => {
    const rows = venues.filter((v) => v.kind === kind);
    return rows.length ? rows.reduce((sum, v) => sum + v.volumeUsd, 0) : null;
  };
  return { venues, metrics: comparison(total("cex"), total("dex")) };
}

/** Required DEX activity at a given share, with observed CEX volume held fixed. */
export function dexMilestone(cex: number, dex: number, targetPct: number) {
  const current = comparison(cex, dex);
  if (
    !current ||
    cex === 0 ||
    !Number.isFinite(targetPct) ||
    targetPct <= 0 ||
    targetPct >= 100
  )
    return null;
  const requiredDex = cex * (targetPct / (100 - targetPct));
  return {
    targetPct,
    requiredDex,
    additionalDex: Math.max(0, requiredDex - dex),
    multiple: dex > 0 ? requiredDex / dex : null,
    achieved: current.dexPct >= targetPct,
  };
}

export type Supply = {
  zec: number;
  height: number;
  hash: string;
  pools: { id: string; zec: number }[];
  lockedZec: number;
  shieldedZec: number;
  reconciled: true;
};
export function parseSupply(raw: unknown): Supply {
  const s = z
    .object({
      chain: z.literal("main"),
      blocks: z.number().int().positive(),
      bestblockhash: z.string().regex(/^[a-f0-9]{64}$/),
      verificationprogress: z.number().min(0.999),
      chainSupply: z.object({ chainValueZat: zat }),
      valuePools: z
        .array(z.object({ id: z.string(), chainValueZat: zat }))
        .min(4),
    })
    .parse(raw);
  const total = s.chainSupply.chainValueZat;
  if (total <= 0 || total > MAX_SUPPLY * ZAT)
    throw new Error("Invalid chain supply");
  if (
    new Set(s.valuePools.map((p) => p.id)).size !== s.valuePools.length ||
    !s.valuePools.some((p) => p.id === "transparent")
  )
    throw new Error("Invalid pool breakdown");
  const sum = s.valuePools.reduce((n, p) => n + BigInt(p.chainValueZat), 0n);
  if (sum !== BigInt(total))
    throw new Error("Value pools do not reconcile to chain supply");
  const pools = s.valuePools.map((p) => ({
    id: p.id,
    zec: p.chainValueZat / ZAT,
  }));
  return {
    zec: total / ZAT,
    height: s.blocks,
    hash: s.bestblockhash,
    pools,
    reconciled: true,
    lockedZec: pools.find((p) => p.id === "lockbox")?.zec ?? 0,
    shieldedZec: pools
      .filter((p) => !["transparent", "lockbox"].includes(p.id))
      .reduce((n, p) => n + p.zec, 0),
  };
}

export const labelSchema = z.object({
  address: z.string().regex(/^t[13][a-zA-Z0-9]{33}$/),
  label: z.string(),
  category: z.string(),
  verified: z.boolean(),
  description: z.string().nullable().optional(),
});
export type AddressLabel = z.infer<typeof labelSchema>;
export type AddressBalance = AddressLabel & {
  zec: number | null;
  source: string;
};
export type PublicAddress = {
  address: string;
  zec: number;
  label: AddressLabel | null;
  source: string;
};

/** Keep newly published rich-list labels even before the label registry catches up. */
export function parseCustodyRegistry(labelRaw: unknown, richRaw: unknown) {
  const registry = z
    .object({
      labels: z.array(labelSchema).min(1),
      count: z.number().int().positive(),
    })
    .parse(labelRaw);
  if (registry.labels.length !== registry.count)
    throw new Error("Incomplete label registry");
  const labels = new Map(registry.labels.map((a) => [a.address, a]));
  if (labels.size !== registry.count)
    throw new Error("Duplicate registry address");
  const rich = z
    .object({
      success: z.literal(true),
      addresses: z.array(
        z.object({
          address: labelSchema.shape.address,
          balanceZat: zat,
          label: z.string().nullable().optional(),
          category: z.string().nullable().optional(),
          verified: z.boolean().nullable().optional(),
          description: z.string().nullable().optional(),
        }),
      ),
    })
    .parse(richRaw);
  const balances = new Map<string, number>();
  for (const a of rich.addresses) {
    const zec = parseAddressZec(a);
    const previous = balances.get(a.address);
    if (previous !== undefined && previous !== zec)
      throw new Error("Conflicting address balances");
    balances.set(a.address, zec);
    if (!labels.has(a.address) && a.label?.trim()) {
      labels.set(
        a.address,
        labelSchema.parse({
          ...a,
          category: a.category ?? "other",
          verified: a.verified === true,
        }),
      );
    }
  }
  const addresses: PublicAddress[] = [...balances]
    .map(([address, zec]) => ({
      address,
      zec,
      label: labels.get(address) ?? null,
      source: `https://cipherscan.app/address/${address}`,
    }))
    .sort((a, b) => b.zec - a.zec);
  return { labels: [...labels.values()], addresses, balances };
}
export type HolderKind = "cex" | "dex" | "fund" | "treasury" | "other";
export type Holder = {
  id: string;
  name: string;
  kind: HolderKind;
  zec: number | null;
  addresses: AddressBalance[];
  missing: number;
};
export function holderIdentity(label: AddressLabel): {
  id: string;
  name: string;
  kind: HolderKind;
} {
  const n = label.label.toLowerCase();
  // CipherScan's source category is retained on the address, but economic roles
  // must not conflate an investment product or bridge with a centralized venue.
  if (n.includes("grayscale"))
    return { id: "grayscale", name: "Grayscale · ZCSH", kind: "fund" };
  if (n.includes("hyperunit"))
    return { id: "hyperunit", name: "Unit · Hyperliquid bridge", kind: "dex" };
  if (n.includes("near") && label.category === "bridge")
    return { id: "near", name: "NEAR Intents bridge", kind: "dex" };
  for (const [id, name] of [
    ["binance", "Binance"],
    ["coinbase", "Coinbase"],
    ["gemini", "Gemini"],
    ["kraken", "Kraken"],
    ["kucoin", "KuCoin"],
  ]) {
    if (n.startsWith(id)) return { id, name, kind: "cex" };
  }
  return {
    id: n.replace(/[^a-z0-9]+/g, "-"),
    name: label.label,
    kind:
      label.category === "exchange"
        ? "cex"
        : label.category === "bridge"
          ? "dex"
          : label.category === "foundation"
            ? "treasury"
            : "other",
  };
}
export function groupHolders(addresses: AddressBalance[]): Holder[] {
  const groups = new Map<string, Holder>();
  const seen = new Set<string>();
  for (const a of addresses) {
    if (seen.has(a.address)) continue;
    seen.add(a.address);
    const identity = holderIdentity(a);
    const h = groups.get(identity.id) ?? {
      ...identity,
      zec: null,
      addresses: [],
      missing: 0,
    };
    h.addresses.push(a);
    if (a.zec === null) h.missing++;
    else h.zec = (h.zec ?? 0) + a.zec;
    groups.set(h.id, h);
  }
  return [...groups.values()].sort((a, b) => (b.zec ?? -1) - (a.zec ?? -1));
}
export function parseAddressZec(raw: unknown): number {
  // The rich-list endpoint has both ZEC and exact zatoshis. Never divide its
  // already-denominated `balance` field by 1e8.
  const a = z.object({ balanceZat: zat }).parse(raw);
  if (a.balanceZat > MAX_SUPPLY * ZAT)
    throw new Error("Balance exceeds supply cap");
  return a.balanceZat / ZAT;
}

export function parseAddressDetail(raw: unknown, address: string): number {
  // Unlike rich-list, /api/address/:address returns `balance` in zatoshis.
  const a = z.object({ address: z.literal(address), balance: zat }).parse(raw);
  if (a.balance > MAX_SUPPLY * ZAT) throw new Error("Invalid address balance");
  return a.balance / ZAT;
}

export function parseHyperliquid(raw: unknown): {
  volumeUsd: number;
  baseVolume: number;
} {
  const [meta, contexts] = z
    .tuple([
      z.object({
        tokens: z.array(
          z.object({
            index: z.number(),
            tokenId: z.string(),
            name: z.string(),
          }),
        ),
        universe: z.array(
          z.object({ name: z.string(), tokens: z.array(z.number()) }),
        ),
      }),
      z.array(
        z.object({ coin: z.string(), dayNtlVlm: amount, dayBaseVlm: amount }),
      ),
    ])
    .parse(raw);
  // Pin Unit's actual token ID. A token with ZEC in its name may be unrelated.
  const token = meta.tokens.find(
    (t) =>
      t.tokenId === "0x1c994ad3381d31c86c8c2d74ed89a365" && t.name === "UZEC",
  );
  const usd = meta.tokens.find((t) => t.name === "USDC");
  const pair =
    token &&
    usd &&
    meta.universe.find(
      (u) => u.tokens[0] === token.index && u.tokens[1] === usd.index,
    );
  // Context arrays can be sparse and are NOT index-aligned with universe.
  const ctx = pair && contexts.find((c) => c.coin === pair.name);
  if (!ctx) throw new Error("Verified UZEC/USDC market not found");
  return { volumeUsd: ctx.dayNtlVlm, baseVolume: ctx.dayBaseVlm };
}

export type Disclosure = {
  id: string;
  name: string;
  ticker: string;
  kind: "fund" | "treasury";
  zec: number;
  asOf: string;
  source: string;
  method: string;
  custody: string;
};
export function parse21Shares(raw: unknown): Disclosure {
  const j = z
    .object({
      success: z.literal(true),
      data: z.object({
        ticker: z.literal("ZCASH"),
        total_units_outstanding: amount,
        valuation_date: date,
        constituents: z.array(
          z.object({ ticker: z.string(), coin_entitlement_per_share: amount }),
        ),
      }),
    })
    .parse(raw).data;
  const coin = j.constituents.find((c) => c.ticker === "ZEC");
  if (!coin) throw new Error("ZEC entitlement unavailable");
  const zec = j.total_units_outstanding * coin.coin_entitlement_per_share;
  if (zec > MAX_SUPPLY) throw new Error("Invalid entitlement");
  return {
    id: "21shares",
    name: "21shares Zcash ETP",
    ticker: "ZCASH",
    kind: "fund",
    zec,
    asOf: j.valuation_date,
    source: "https://www.21shares.com/en-uk/product/zcash",
    custody: "BitGo",
    method: `${j.total_units_outstanding.toLocaleString("en-US")} securities × ${coin.coin_entitlement_per_share.toFixed(12)} ZEC per security. Issuer valuation date.`,
  };
}

/** Decode public server-rendered JSON strings as data, never execute scripts. */
export function publicPageData(html: string): string {
  return [
    ...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g),
  ]
    .map((m) => {
      try {
        return JSON.parse(m[1]) as string;
      } catch {
        return "";
      }
    })
    .join("\n");
}
export function parseNearExplorer(
  html: string,
  now: number,
  scope: "zec" | "all" = "zec",
) {
  const s = publicPageData(html);
  if (scope === "zec" && !s.includes('"toTokenId":["nep141:zec.omft.near"]'))
    throw new Error("ZEC filter missing");
  if (
    scope === "all" &&
    (!s.includes('"toTokenId":"$undefined"') ||
      !s.includes('"fromTokenId":"$undefined"'))
  )
    throw new Error("Expected unfiltered protocol volume");
  const match = s.match(/"toVolume":(\{[^}]+\})/);
  if (!match) throw new Error("ZEC volume not available");
  const n = z
    .object({
      allTime: z.string(),
      lastDay: z.string(),
      last7Days: z.string(),
      last30Days: z.string(),
      fetchedAt: date,
      isStale: z.literal(false),
    })
    .parse(JSON.parse(match[1]));
  if (
    now - Date.parse(n.fetchedAt) > 2 * HOUR ||
    Date.parse(n.fetchedAt) > now + 300_000
  )
    throw new Error("Old NEAR volume");
  const dollars = (s: string) =>
    amount.parse(s.replace(/^\$+/, "").replaceAll(",", ""));
  // The explorer reports per-token activity, not a separate buy/sell leg.
  // Selecting ZEC in both filters repeats this same total; never add it twice.
  return {
    volumeUsd: dollars(n.lastDay),
    volume7dUsd: dollars(n.last7Days),
    volume30dUsd: dollars(n.last30Days),
    volumeAllTimeUsd: dollars(n.allTime),
    asOf: n.fetchedAt,
  };
}

/** Official NEAR Revenue's dated TVL series. TVL is never trading volume. */
export function parseNearConfidential(html: string, now: number) {
  const s = publicPageData(html);
  if (!html.includes("NEAR Intents Confidential TVL"))
    throw new Error("Confidential context missing");
  const match = s.match(/"data":(\[[^\]]+\]),"currentTvl":([^,}]+)/);
  if (!match) throw new Error("Confidential TVL series unavailable");
  const series = z
    .array(z.object({ date, value: amount }))
    .min(1)
    .parse(JSON.parse(match[1]));
  const latest = [...series].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  )[0];
  const current = amount.parse(JSON.parse(match[2]));
  if (
    Math.abs(current - latest.value) > 0.01 ||
    Date.parse(latest.date) > now ||
    now - Date.parse(latest.date) > 72 * HOUR
  )
    throw new Error("Confidential TVL date or total not verified");
  return { tvlUsd: current, asOf: latest.date };
}
export function parseCypherpunk(html: string): Disclosure {
  const s = publicPageData(html);
  const holding = s.match(/"zecHoldings":([0-9.]+)/);
  const txns = s.match(/"treasuryTxns":(\[.*?\]),"/s);
  if (!holding || !txns)
    throw new Error("Cypherpunk disclosure structure changed");
  const transactions = z
    .array(
      z
        .object({
          asset: z.string(),
          date,
          amount: amount.nullable(),
          type: z.string(),
        })
        .passthrough(),
    )
    .parse(JSON.parse(txns[1]));
  const zec = amount.parse(holding[1]);
  const dates = transactions
    .filter((t) => t.asset === "ZEC")
    .map((t) => t.date)
    .sort();
  if (!dates.length || zec > MAX_SUPPLY)
    throw new Error("Invalid treasury disclosure");
  return {
    id: "cypherpunk",
    name: "Cypherpunk Technologies",
    ticker: "CYPH",
    kind: "treasury",
    zec,
    asOf: dates.at(-1)!.slice(0, 10),
    source: "https://www.cypherpunk.com/",
    custody: "Not address-attributed here",
    method:
      "Company dashboard holdings; date is the latest disclosed ZEC treasury transaction. No wallet ownership inferred.",
  };
}

export function parseGrayscale(html: string): Disclosure {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const section = text.slice(text.indexOf("Key Fund Information"));
  const n = section.match(/TOTAL ZEC IN FUND\s+([\d,.]+)/i);
  const d = section.match(/As of\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!n || !d) throw new Error("Fund disclosure unavailable");
  const zec = amount.parse(n[1].replaceAll(",", ""));
  if (zec <= 0 || zec > MAX_SUPPLY) throw new Error("Invalid fund balance");
  return {
    id: "grayscale",
    name: "Grayscale · The Zcash ETF",
    ticker: "ZCSH",
    kind: "fund",
    zec,
    asOf: `${d[3]}-${d[1]}-${d[2]}`,
    source: "https://www.thezcashetf.com/",
    custody: "Coinbase Custody",
    method:
      "Total ZEC in fund reported by the issuer. This is the successor to the Zcash Trust, not an additional holding.",
  };
}
