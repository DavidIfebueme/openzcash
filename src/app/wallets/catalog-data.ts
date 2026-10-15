/** The wallet catalog behind /wallets: plain data, so the server (Zarvis) and the client page read the same list. */
/** Date of the last edit to the entries below (maintainer-set, not a review pass): update it in the same commit that adds, removes or corrects a wallet. */
export const WALLET_CATALOG_REVISED_ON = "2026-07-08";

export type Shielded = "full" | "partial" | "transparent";

export interface Wallet {
  name: string;
  maker: string;
  url: string;
  platforms: string[];
  shielded: Shielded;
  note: string;
  logo?: string;
  flagship?: boolean;
  tag?: "Beta" | "Coming soon";
  /** Public source repository — set ONLY when the wallet itself (app or
   * firmware) is fully open source, verified per repo + license. Absent for
   * closed/unpublished wallets and for Ledger (open app, proprietary OS). */
  source?: string;
  /** Public third-party security audit REPORT for this wallet (or, for
   * Ledger, its Zcash app) — set only with a verifiable report link. */
  audit?: string;
}

// Curated from official sources + a multi-agent research pass (2026), seeded by
// the community wallet list. Shielded support is the headline: "full" = send AND
// receive shielded (Orchard/Sapling); "partial" = limited; "transparent" = t-addr only.
export const SOFTWARE: Wallet[] = [
  {
    name: "Zodl",
    maker: "Zcash Open Development Lab",
    url: "https://zodl.com",
    // Official iOS AppIcon (zodl-inc/zodl-ios); content version refreshes cached artwork.
    logo: "/wallet-logos/zodl.png?v=1ae79a66",
    platforms: ["iOS", "Android"],
    shielded: "full",
    flagship: true,
    note: "Formerly Zashi. Shielded by default, from the original core team.",
    source: "https://github.com/zodl-inc",
  },
  {
    name: "Zingo!",
    maker: "Zingo Labs",
    url: "https://zingolabs.org/zingo/",
    logo: "/wallet-logos/zingo.png",
    platforms: ["iOS", "Android", "Desktop"],
    shielded: "full",
    note: "Open-source, shielded by default, with view-only UFVK import.",
    source: "https://github.com/zingolabs",
  },
  {
    name: "Ywallet",
    maker: "hanh",
    url: "https://ywallet.app",
    logo: "/wallet-logos/ywallet.png",
    platforms: ["iOS", "Android", "Desktop"],
    shielded: "full",
    note: "Fast shielded send/receive with an encrypted messenger.",
    source: "https://github.com/hhanh00/zwallet",
    audit: "https://defuse.ca/zecsec/audits/YWalletAuditReport-FINALv3.pdf",
  },
  {
    name: "zkool",
    maker: "hanh",
    url: "https://github.com/hhanh00/zkool2",
    logo: "/wallet-logos/zkool.png",
    platforms: ["iOS", "Android", "Desktop"],
    shielded: "full",
    note: "hanh's successor to Ywallet. Full shielded, with UFVK import.",
    source: "https://github.com/hhanh00/zkool2",
  },
  {
    name: "Brave Wallet",
    maker: "Brave Software",
    url: "https://brave.com/wallet/",
    logo: "/wallet-logos/brave.png",
    platforms: ["Desktop", "iOS", "Android"],
    shielded: "full",
    note: "Shielded ZEC built into the Brave browser, via zk-proofs.",
    source: "https://github.com/brave/brave-core",
  },
  {
    name: "Noir Wallet",
    maker: "RHEA Finance",
    url: "https://www.zknoir.com/",
    logo: "/wallet-logos/noir.png",
    platforms: ["Browser extension"],
    shielded: "full",
    note: "First browser-extension wallet with shielded ZEC and DeFi.",
  },
  {
    name: "MetaMask Snap",
    maker: "ChainSafe",
    url: "https://snaps.metamask.io/snap/npm/chainsafe/webzjs-zcash-snap/",
    logo: "/wallet-logos/metamask.png",
    platforms: ["Browser extension"],
    shielded: "full",
    note: "Shielded ZEC inside MetaMask. ZCG-funded, Hacken-audited.",
    source: "https://github.com/ChainSafe/WebZjs",
    audit: "https://hacken.io/audits/zcash/dapp-zcash-snap-may2025/",
  },
  {
    name: "Vizor",
    maker: "Chainapsis (Keplr)",
    url: "https://vizor.cash/",
    logo: "/wallet-logos/vizor.png",
    platforms: ["iOS", "Android", "Desktop"],
    shielded: "full",
    note: "Shielded by default with Keystone support, from the Keplr team.",
    source: "https://github.com/chainapsis/vizor-wallet",
  },
  {
    name: "Cake Wallet",
    maker: "Cake Labs",
    url: "https://cakewallet.com",
    logo: "/wallet-logos/cake.png",
    platforms: ["iOS", "Android", "Desktop"],
    shielded: "full",
    note: "Multi-coin privacy wallet; auto-shields and always sends shielded.",
    source: "https://github.com/cake-tech/cake_wallet",
  },
  {
    name: "Edge",
    maker: "Edge",
    url: "https://edge.app",
    logo: "/wallet-logos/edge.png",
    platforms: ["iOS", "Android"],
    shielded: "full",
    note: "Mainstream multi-asset wallet defaulting to shielded z-addresses.",
    source: "https://github.com/EdgeApp/edge-react-gui",
  },
  {
    name: "Unstoppable Wallet",
    maker: "Horizontal Systems",
    url: "https://unstoppable.money/",
    logo: "/wallet-logos/unstoppable.png",
    platforms: ["iOS", "Android"],
    shielded: "full",
    note: "Multi-coin wallet with full shielded ZEC and auto-shielding.",
    source: "https://github.com/horizontalsystems/unstoppable-wallet-android",
  },
  {
    name: "Zipher",
    maker: "Atmosphere Labs",
    url: "https://zipher.to/",
    logo: "/wallet-logos/zipher.png",
    platforms: ["iOS", "Android", "Desktop", "Web"],
    shielded: "full",
    tag: "Beta",
    note: "Shielded-by-default Orchard wallet with a CLI for AI agents.",
    source: "https://github.com/atmospherelabs-dev/zipher-app",
  },
  {
    name: "zSTASH",
    maker: "Independent",
    url: "https://zstash.app/",
    logo: "/wallet-logos/zstash.png",
    platforms: ["Desktop"],
    shielded: "full",
    tag: "Coming soon",
    note: "Native Rust desktop wallet with hardware support and DEX swaps.",
  },
  {
    name: "Zapp",
    maker: "JustZappIt",
    url: "https://www.justzappit.xyz/",
    logo: "/wallet-logos/zappit.png",
    platforms: ["Android"],
    shielded: "full",
    // In production on Google Play (Aug 2026); rail count per the maker.
    note: "P2P messenger with a shielded Zodl-based wallet; no-KYC offramp across 7 local rails, including UPI, PIX and QRIS.",
  },
  {
    name: "Gem Wallet",
    maker: "Gem Wallet",
    url: "https://gemwallet.com",
    logo: "/wallet-logos/gem.png",
    platforms: ["iOS", "Android"],
    // Verified in the source: Zcash lives in the gem_bitcoin UTXO crate, only
    // t1/t3 address scripts are parsed, and the v5 sighash passes EMPTY
    // sapling/orchard digests — transparent send and receive, no shielded.
    shielded: "transparent",
    note: "Multi-chain self-custodial wallet; transparent (t-address) ZEC only.",
    source: "https://github.com/gemwalletcom/wallet",
    audit:
      "https://static.gemwallet.com/audits/Gem-Wallet-CertiK-Security-Audit-April-2026.pdf",
  },
];

export const HARDWARE: Wallet[] = [
  {
    name: "Keystone",
    maker: "Keystone",
    url: "https://keyst.one",
    logo: "/wallet-logos/keystone.png",
    platforms: ["Hardware"],
    shielded: "full",
    note: "First air-gapped hardware wallet with native shielded (Orchard) ZEC.",
    source: "https://github.com/KeystoneHQ/keystone3-firmware",
    audit:
      "https://blog.keyst.one/deep-dive-into-next-gen-hardware-wallet-crashing-keystone3-pro-audit-2729bc551d7b",
  },
  {
    name: "Ledger",
    maker: "Ledger · Zondax",
    url: "https://www.ledger.com/coin/wallet/zcash",
    logo: "/wallet-logos/ledger.png",
    platforms: ["Hardware"],
    shielded: "partial",
    note: "Transparent by default; a Zondax app adds Sapling on some models.",
    audit: "https://defuse.ca/zecsec/audits/zcash-ledger-audit-report-v2.pdf",
  },
  {
    name: "Trezor",
    maker: "SatoshiLabs",
    url: "https://trezor.io/coins/wallet/zcash",
    logo: "/wallet-logos/trezor.png",
    platforms: ["Hardware"],
    shielded: "transparent",
    note: "Transparent (t-address) only; no shielded support.",
    source: "https://github.com/trezor/trezor-firmware",
  },
];
