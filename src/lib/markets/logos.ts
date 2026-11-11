import exchangeLogos from "../../../public/logos/markets/exchanges.json";

const brands = new Map<string, string>([
  ...Object.entries(exchangeLogos),
  ["maya", "/logos/maya.svg"],
  ["thorchain", "thorchain.png"],
  ["omnibridge", "omnibridge.webp"],
  ["coinbase", "coinbase.png"],
  ["binance", "binance.svg"],
  ["bnb", "binance.svg"],
  ["gemini", "gemini.png"],
  ["kraken", "kraken.png"],
  ["kucoin", "kucoin.svg"],
  ["okx", "okx-mark.png"],
  ["okex", "okx-mark.png"],
  ["near", "near.svg"],
  ["hyperliquid", "hyperliquid.png"],
  ["hyperjump", "hyperjump.png"],
  ["unit", "unit.png"],
  ["solana", "solana.svg"],
  ["base", "base.svg"],
  ["starknet", "starknet.png"],
  ["polygon", "polygon.png"],
  ["world chain", "world.png"],
  ["katana", "katana.svg"],
  ["aptos", "aptos.svg"],
  ["orca", "orca.png"],
  ["raydium", "raydium.ico"],
  ["meteora", "meteora.svg"],
  ["aerodrome", "aerodrome.svg"],
  ["uniswap", "uniswap.png"],
  ["pancakeswap", "pancakeswap.png"],
  ["pumpswap", "pumpswap.png"],
  ["rhea finance", "rhea.png"],
  ["apeswap", "apeswap.png"],
  ["babyswap", "babyswap.jpg"],
  ["ekubo", "ekubo.svg"],
  ["gleec wallet", "gleec-wallet.png"],
  ["hydrex", "hydrex.png"],
  ["flapsh", "flap.ico"],
  ["flap.sh", "flap.ico"],
  ["topaz", "topaz.png"],
  ["zenrock", "zenrock.png"],
  ["universal", "universal.svg"],
  ["grayscale", "grayscale.png"],
  ["cypherpunk", "cypherpunk.svg"],
  ["21shares", "shares21.png"],
  ["kamino", "kamino.png"],
  ["whitebit", "whitebit.jpg"],
  ["pionex", "pionex.png"],
  ["coinw", "coinw.png"],
  ["bydfi", "bydfi-spot.png"],
  ["blynex", "blynex.png"],
  ["nofinex", "nofinex.png"],
  ["hitbtc", "hitbtc.png"],
  ["yobit", "yobit.png"],
  ["trapix", "trapix-exchange.png"],
  ["safetrade", "safetrade.png"],
]);

/** Resolve the entity before its network suffix; a network is not a DEX brand. */
export function marketLogo(name: string): string | null {
  const entity = name.split("·", 1)[0].trim().toLowerCase();
  const file =
    brands.get(entity) ??
    [...brands].find(
      ([brand]) =>
        entity.startsWith(`${brand} `) || entity.startsWith(`${brand}-`),
    )?.[1];
  return file ? (file.startsWith("/") ? file : `/logos/markets/${file}`) : null;
}
