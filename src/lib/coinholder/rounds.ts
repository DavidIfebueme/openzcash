/**
 * Every round of the Coinholder-Directed Retroactive Grants Program, newest first.
 * Outcomes come from each round's official results post; tallies from whoever
 * published them (named per round in `talliesSource`). Update this file when a
 * round closes; the program home always shows ROUNDS[0].
 */
import type { BallotOption, Round, RoundProposal } from "./types";

const FORUM = "https://forum.zcashcommunity.com/t/";
const GITHUB = "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/";
/** Q3 2026 round on the vote chain; the Zcash Foundation, ZODL and Shielded Labs servers return byte-identical copies. */
const VOTE_CHAIN = "https://zvote.zfnd.org/shielded-vote/v1/vote-summary/2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01";

const APPROVE_REJECT: BallotOption[] = [{ key: "approve", label: "Approve" }, { key: "reject", label: "Reject" }];

/** Q3 2026, in the order of FPF's review post (by requested amount). Tallies: the finalized round on the Valar vote chain, in ZEC (on-chain units of 0.125 ZEC). */
const Q3_2026: RoundProposal[] = [
  {
    "id": "24",
    "question": 1,
    "title": "Zcash Grants Hub",
    "applicant": "Daniel Goh",
    "requestedUsdCents": 305000,
    "summary": "Unified platform aggregating ZCG, Coinholder, and ZecHub DAO proposals into one interface",
    "outcome": "rejected",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote."
    ],
    "tally": {
      "approve": 79508.0,
      "reject": 1391627.875,
      "rejectLower": 32.625,
      "abstain": 710283.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zcash-grants-hub-coinholder-program/55372"
      },
      {
        "label": "GitHub #24",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/24"
      }
    ]
  },
  {
    "id": "62",
    "question": 2,
    "title": "ShieldedScan",
    "applicant": "ShieldedScan",
    "requestedUsdCents": 406000,
    "summary": "Free, no-tracker Zcash block explorer with shielded-pool analytics and a keyless API",
    "outcome": "rejected",
    "tally": {
      "approve": 524770.25,
      "reject": 1650918.125,
      "rejectLower": 439.875,
      "abstain": 5324.625
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-shieldedscan/57051"
      },
      {
        "label": "GitHub #62",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/62"
      }
    ]
  },
  {
    "id": "44",
    "question": 3,
    "title": "ZecKit Post-M3 Stabilization and Developer Adoption",
    "applicant": "Dapps over Apps",
    "requestedUsdCents": 500000,
    "summary": "Developer toolkit for local Zebra regtest environments and reusable CI workflows",
    "outcome": "rejected",
    "tally": {
      "approve": 396819.875,
      "reject": 1671151.75,
      "rejectLower": 0.0,
      "abstain": 113478.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zeckit-post-m3-stabilization-and-developer-adoption-work/56992"
      },
      {
        "label": "GitHub #44",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/44"
      }
    ]
  },
  {
    "id": "60",
    "question": 4,
    "title": "zcashtocash via ZcashLabs",
    "applicant": "ZcashLabs",
    "requestedUsdCents": 600000,
    "summary": "Non-custodial ZEC-to-fiat service across 100+ geographies and six fiat apps",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 5.2352 ZEC, the $6,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1566863.75,
      "reject": 1845.5,
      "rejectLower": 289.75,
      "abstain": 610683.25
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zcash-labs-for-zcashto-cash/57047"
      },
      {
        "label": "GitHub #60",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/60"
      }
    ]
  },
  {
    "id": "46",
    "question": 5,
    "title": "zec-ironwood-reconcile",
    "applicant": "Steven Hert",
    "requestedUsdCents": 825000,
    "summary": "Rust CLI reconciling Orchard and Ironwood value-pool changes against Zebra's balances",
    "outcome": "rejected",
    "tally": {
      "approve": 408984.0,
      "reject": 1649423.125,
      "rejectLower": 11429.5,
      "abstain": 109338.0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zec-ironwood-reconcile-reproducible-orchard-ironwood-value-pool-reconciliation/56998"
      },
      {
        "label": "GitHub #46",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/46"
      }
    ]
  },
  {
    "id": "43",
    "question": 6,
    "title": "Gleyo",
    "applicant": "Gleyo",
    "requestedUsdCents": 908120,
    "summary": "Quest platform paying shielded ZEC rewards without upfront wallet setup",
    "outcome": "rejected",
    "tally": {
      "approve": 63859.75,
      "reject": 2004999.75,
      "rejectLower": 1187.875,
      "abstain": 109139.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-gleyo/56977"
      },
      {
        "label": "GitHub #43",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/43"
      }
    ]
  },
  {
    "id": "49",
    "question": 7,
    "title": "Self-Sovereign Zcash Testnet Faucet",
    "applicant": "Jino Labs",
    "requestedUsdCents": 928000,
    "summary": "Self-hosted testnet faucet running its own node, wallet, indexer, and miner",
    "outcome": "rejected",
    "tally": {
      "approve": 106078.375,
      "reject": 1952787.5,
      "rejectLower": 12896.5,
      "abstain": 107460.5
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-self-sovereign-zcash-testnet-faucet/57002"
      },
      {
        "label": "GitHub #49",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/49"
      }
    ]
  },
  {
    "id": "59",
    "question": 8,
    "title": "CyphZec.com",
    "applicant": "Thomas Zarebczan",
    "requestedUsdCents": 1000000,
    "summary": "Free dashboard for ZEC and CYPH prices, shielding, treasury, and network stats",
    "outcome": "rejected",
    "tally": {
      "approve": 60769.125,
      "reject": 2012174.625,
      "rejectLower": 1833.75,
      "abstain": 104432.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-cyphzec-com/57035"
      },
      {
        "label": "GitHub #59",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/59"
      }
    ]
  },
  {
    "id": "42",
    "question": 9,
    "title": "ZecLedger",
    "applicant": "ZecLedger",
    "requestedUsdCents": 1000000,
    "summary": "Read-only viewing-key accounting CLI producing cost-basis and gain-loss reports",
    "outcome": "rejected",
    "tally": {
      "approve": 404349.125,
      "reject": 1663779.5,
      "rejectLower": 846.125,
      "abstain": 110234.0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-zecledger/56969"
      },
      {
        "label": "GitHub #42",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/42"
      }
    ]
  },
  {
    "id": "41",
    "question": 10,
    "title": "lightwalletd-rs",
    "applicant": "jpgonzalezra",
    "requestedUsdCents": 1072000,
    "summary": "Independent Rust implementation of the Zcash light-client server",
    "outcome": "rejected",
    "tally": {
      "approve": 104752.875,
      "reject": 1777439.625,
      "rejectLower": 15713.25,
      "abstain": 281303.875
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-lightwalletd-rs/56955"
      },
      {
        "label": "GitHub #41",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/41"
      }
    ]
  },
  {
    "id": "39",
    "question": 11,
    "title": "Blindvault",
    "applicant": "TIDJANI Walid",
    "requestedUsdCents": 1700000,
    "summary": "Anonymous credential issuance middleware using BLS12-381 blind signatures",
    "outcome": "rejected",
    "tally": {
      "approve": 88976.625,
      "reject": 1806783.25,
      "rejectLower": 176932.625,
      "abstain": 106545.125
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-blindvault/56932"
      },
      {
        "label": "GitHub #39",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/39"
      }
    ]
  },
  {
    "id": "45",
    "question": 12,
    "title": "Zallet RPC Parity Harness",
    "applicant": "Creativesonchain",
    "requestedUsdCents": 2000000,
    "summary": "CLI comparing zcashd and Zallet JSON-RPC responses for parity",
    "outcome": "rejected",
    "tally": {
      "approve": 86930.75,
      "reject": 1807452.0,
      "rejectLower": 3496.5,
      "abstain": 281366.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zallet-rpc-parity-harness/56993"
      },
      {
        "label": "GitHub #45",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/45"
      }
    ]
  },
  {
    "id": "48",
    "question": 13,
    "title": "Zecmap",
    "applicant": "Batuhan",
    "requestedUsdCents": 2130000,
    "summary": "Interactive map of Zcash-accepting businesses, on web, Android, and iOS",
    "outcome": "rejected",
    "tally": {
      "approve": 178398.625,
      "reject": 1383932.0,
      "rejectLower": 11254.5,
      "abstain": 605677.125
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zecmap/56999"
      },
      {
        "label": "GitHub #48",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/48"
      }
    ]
  },
  {
    "id": "55",
    "question": 14,
    "title": "Connaugh Zcash Videos",
    "applicant": "Connaugh",
    "requestedUsdCents": 2200000,
    "summary": "Five short-form films cut from existing Zcash footage, published July–August 2026",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 19.1957 ZEC, the $22,000 at $1,146.09 per ZEC."
    ],
    
    "tally": {
      "approve": 757044.25,
      "reject": 187236.625,
      "rejectLower": 196044.0,
      "abstain": 1038923.25
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zkmarketer-videos/57031"
      },
      {
        "label": "GitHub #55",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/55"
      }
    ],
    "correction": {
      "text": "First published as Abstain, the option with the most ZEC. After str4d pointed out that a simple majority under ZIP 1016 leaves abstentions out (1,140,324.875 ZEC voted for or against, 66.4% in favour), FPF moved it to Funded six hours after publishing (September 30, 2026, 02:09 UTC).",
      "href": "https://forum.zcashcommunity.com/t/q3-coinholder-directed-retroactive-grants-program-results/57909/4",
      "from": "abstain"
    }},
  {
    "id": "31",
    "question": 15,
    "title": "ZAP1 Attestation Protocol and Verification Tooling",
    "applicant": "Frontier Compute",
    "requestedUsdCents": 2800000,
    "summary": "Attestation protocol anchoring Merkle commitments to mainnet via Orchard memos",
    "outcome": "rejected",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote."
    ],
    "tally": {
      "approve": 87143.875,
      "reject": 1792545.75,
      "rejectLower": 13823.0,
      "abstain": 285716.0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zap1-attestation-protocol-and-verification-tooling/55664"
      },
      {
        "label": "GitHub #31",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/31"
      }
    ]
  },
  {
    "id": "38",
    "question": 16,
    "title": "ZecBooks",
    "applicant": "SaneApps",
    "requestedUsdCents": 3200000,
    "summary": "Mac-native, local-first bookkeeping for shielded Zcash via viewing key",
    "outcome": "rejected",
    "tally": {
      "approve": 101026.0,
      "reject": 1779666.125,
      "rejectLower": 190131.75,
      "abstain": 108415.625
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zecbooks/56914"
      },
      {
        "label": "GitHub #38",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/38"
      }
    ]
  },
  {
    "id": "30",
    "question": 17,
    "title": "CipherPay",
    "applicant": "Atmosphere Labs (Kenbak)",
    "requestedUsdCents": 3500000,
    "summary": "Non-custodial commerce platform: payments, subscriptions, plugins, ticketing, POS",
    "outcome": "funded",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote.",
      "Paid October 16, 2026: 30.5386 ZEC, the $35,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1988112.0,
      "reject": 83142.125,
      "rejectLower": 1752.625,
      "abstain": 106221.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-cipherpay/55612"
      },
      {
        "label": "GitHub #30",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/30"
      }
    ]
  },
  {
    "id": "29",
    "question": 18,
    "title": "Zafu Browser Extension",
    "applicant": "Rotko Networks OU",
    "requestedUsdCents": 3800000,
    "summary": "Chrome MV3 wallet with client-side Halo2 proving and FROST multisig",
    "outcome": "rejected",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote."
    ],
    "tally": {
      "approve": 92628.75,
      "reject": 1788095.5,
      "rejectLower": 12738.75,
      "abstain": 285739.625
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/zafu-wallet-retroactive-grant-application/55551"
      },
      {
        "label": "GitHub #29",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/29"
      }
    ]
  },
  {
    "id": "40",
    "question": 19,
    "title": "Zapp",
    "applicant": "Renee Chiu",
    "requestedUsdCents": 4000000,
    "summary": "Encrypted P2P messenger with in-thread shielded payments and fiat offramps",
    "outcome": "rejected",
    "tally": {
      "approve": 92218.375,
      "reject": 1976691.625,
      "rejectLower": 2823.625,
      "abstain": 107505.875
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zapp/56937"
      },
      {
        "label": "GitHub #40",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/40"
      }
    ]
  },
  {
    "id": "28",
    "question": 20,
    "title": "Open-Source Zcash Hardware-Wallet SDK",
    "applicant": "wh00hw",
    "requestedUsdCents": 4000000,
    "summary": "Vendor-neutral plain-C Orchard hardware wallet stack across four repositories",
    "outcome": "rejected",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote."
    ],
    "tally": {
      "approve": 123819.75,
      "reject": 1767283.75,
      "rejectLower": 179654.625,
      "abstain": 108480.75
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/application-for-coinholder-directed-retroactive-grants-program-q2-2026-open-source-zcash-hardware-wallet-sdk/55550"
      },
      {
        "label": "GitHub #28",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/28"
      }
    ]
  },
  {
    "id": "37",
    "question": 21,
    "title": "Nozy Wallet",
    "applicant": "Leonine DAO",
    "requestedUsdCents": 6000000,
    "summary": "Self-hosted shielded-first wallet: CLI, desktop, and companion API",
    "outcome": "rejected",
    "notes": [
      "Rejected in the Q4 2025 round, when it asked for $21,000; resubmitted for Q3 with broader scope."
    ],
    "tally": {
      "approve": 521243.625,
      "reject": 1648338.625,
      "rejectLower": 3818.125,
      "abstain": 5802.25
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/nozy-wallet-retroactive-grant/52417/26"
      },
      {
        "label": "GitHub #37",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/37"
      }
    ]
  },
  {
    "id": "32",
    "question": 22,
    "title": "THORSwap / Metro",
    "applicant": "THORSwap Labs",
    "requestedUsdCents": 6000000,
    "summary": "Native ZEC cross-chain swaps across THORSwap and Metro wallet",
    "outcome": "funded",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote.",
      "Paid October 16, 2026: 52.3519 ZEC, the $60,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1467036.75,
      "reject": 8473.25,
      "rejectLower": 640.375,
      "abstain": 703090.75
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-thorswap-metro/55675"
      },
      {
        "label": "GitHub #32",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/32"
      }
    ]
  },
  {
    "id": "25",
    "question": 23,
    "title": "Expanding Zcash In Unstoppable Wallet",
    "applicant": "Horizontal Systems",
    "requestedUsdCents": 8000000,
    "summary": "Swap aggregation, wallet reliability, and full Ironwood migration support",
    "outcome": "funded",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote.",
      "Paid October 16, 2026: 69.8025 ZEC, the $80,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1436595.0,
      "reject": 139620.75,
      "rejectLower": 1383.75,
      "abstain": 601603.875
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/expanding-zcash-in-unstoppable-wallet-liquidity-swaps-distribution-retroactive-grant/55529/3"
      },
      {
        "label": "GitHub #25",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/25"
      }
    ]
  },
  {
    "id": "34",
    "question": 24,
    "title": "ZcashNames",
    "applicant": "ZcashMe, Inc.",
    "requestedUsdCents": 12240000,
    "summary": "On-chain naming system mapping readable names to shielded addresses",
    "outcome": "rejected",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote."
    ],
    "tally": {
      "approve": 44642.375,
      "reject": 1419201.375,
      "rejectLower": 7309.75,
      "abstain": 707876.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/coinholder-directed-retroactive-grants-program-q2-2026-now-accepting-proposals/55328/9"
      },
      {
        "label": "GitHub #34",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/34"
      }
    ]
  },
  {
    "id": "63",
    "question": 25,
    "title": "Frontier Compute Zcash Security Research and Remediation Pack",
    "applicant": "Frontier Compute LLC",
    "requestedUsdCents": 13625000,
    "summary": "Disclosed infrastructure and wallet vulnerabilities, then verified the shipped remediations",
    "outcome": "rejected",
    "tally": {
      "approve": 171960.0,
      "reject": 1884711.125,
      "rejectLower": 13472.625,
      "abstain": 109033.5
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/call-for-proposals-coinholder-directed-retroactive-grants-program-q3/56885/29"
      },
      {
        "label": "GitHub #63",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/63"
      }
    ]
  },
  {
    "id": "54",
    "question": 26,
    "title": "Zebra Critical Vulnerability Bug Bounty (CVE-2026-34202)",
    "applicant": "robustfengbin",
    "requestedUsdCents": 15000000,
    "summary": "Bounty for disclosure of a critical Zebra remote denial-of-service vulnerability",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 130.8798 ZEC, the $150,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1392929.25,
      "reject": 4122.0,
      "rejectLower": 622261.375,
      "abstain": 159926.875
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-cve-2026-34202-zebra-remote-denial-of-service-critical/57024"
      },
      {
        "label": "GitHub #54",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/54"
      }
    ]
  },
  {
    "id": "52",
    "question": 27,
    "title": "Bonus Grant — Ironwood zk-SNARK Formal Verification",
    "applicant": "Jason McGee",
    "requestedUsdCents": 26105800,
    "summary": "Nomination topping up application #50 to a $1,000,000 total",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 227.7814 ZEC, the $261,058 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2170803.125,
      "reject": 3736.75,
      "rejectLower": 1358.25,
      "abstain": 3305.875
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/project-tachyon-bonus-grant-for-ironwood-zk-snark-formal-verification/57021"
      },
      {
        "label": "GitHub #52",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/52"
      }
    ]
  },
  {
    "id": "47",
    "question": 28,
    "title": "CipherScan",
    "applicant": "Kenbak",
    "requestedUsdCents": 37500000,
    "summary": "Block explorer and privacy-intelligence platform with a custom Rust indexer",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 327.1994 ZEC, the $375,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2169040.625,
      "reject": 18.875,
      "rejectLower": 5960.625,
      "abstain": 4124.125
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-cipherscan/56997"
      },
      {
        "label": "GitHub #47",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/47"
      }
    ]
  },
  {
    "id": "57",
    "question": 29,
    "title": "Temporary Detectable Unlimited Mint and Sell Exploit",
    "applicant": "Alex Sol",
    "requestedUsdCents": 40000000,
    "summary": "Bounty for chained zcashd and Zebra vulnerabilities enabling temporary counterfeiting",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 349.0127 ZEC, the $400,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2145016.875,
      "reject": 3138.125,
      "rejectLower": 25940.0,
      "abstain": 5096.5
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-temporary-detectable-unlimited-mint-and-sell-bug-bount/57033"
      },
      {
        "label": "GitHub #57",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/57"
      }
    ]
  },
  {
    "id": "58",
    "question": 30,
    "title": "Five Critical Zebra Consensus Divergence Vulnerabilities",
    "applicant": "sangsoo-osec",
    "requestedUsdCents": 42500000,
    "summary": "Net award for five critical Zebra consensus-divergence disclosures, less $100,000 already paid",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 370.8260 ZEC, the $425,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2095860.875,
      "reject": 4228.625,
      "rejectLower": 75624.125,
      "abstain": 3464.625
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-five-critical-zebra-consensus-divergence-vulnerabilities/57034"
      },
      {
        "label": "GitHub #58",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/58"
      }
    ]
  },
  {
    "id": "61",
    "question": 31,
    "title": "Zec.rocks (16 months of uptime)",
    "applicant": "Zec.rocks",
    "requestedUsdCents": 58499200,
    "summary": "Infrastructure powering 16 months of uptime for every major Zcash wallet",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 510.4241 ZEC, the $584,992 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1970715.0,
      "reject": 29.5,
      "rejectLower": 103761.25,
      "abstain": 104709.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-16-months-of-uptime-for-zcash-wallets-zec-rocks/57048"
      },
      {
        "label": "GitHub #61",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/61"
      }
    ]
  },
  {
    "id": "56",
    "question": 32,
    "title": "Ironwood external audit reimbursement",
    "applicant": "ValarGroup",
    "requestedUsdCents": 59900000,
    "summary": "Reimbursement for external cryptography audits during the Ironwood incident response",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 522.6466 ZEC, the $599,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2175934.375,
      "reject": 60.875,
      "rejectLower": 316.375,
      "abstain": 2951.25
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-ironwood-external-audits/57032"
      },
      {
        "label": "GitHub #56",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/56"
      }
    ]
  },
  {
    "id": "50",
    "question": 33,
    "title": "Ironwood zk-SNARK Formal Verification (Project Tachyon)",
    "applicant": "Tachyon Foundation",
    "requestedUsdCents": 73894200,
    "requestedNote": "requested; corrected by the applicant in the review thread",
    "summary": "Formal verification of the Ironwood zk-SNARK circuit, machine-checked in Lean",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 644.7504 ZEC, the $738,942 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2177498.25,
      "reject": 0.25,
      "rejectLower": 7.25,
      "abstain": 1724.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-ironwood-zk-snark-formal-verification-project-tachyon/57007"
      },
      {
        "label": "GitHub #50",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/50"
      }
    ]
  },
  {
    "id": "51",
    "question": 34,
    "title": "Orchard Counterfeiting Vulnerability Bug Bounty",
    "applicant": "Taylor Hornby",
    "requestedUsdCents": 75000000,
    "summary": "Bounty for disclosure of the Orchard counterfeiting vulnerability",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 654.3989 ZEC, the $750,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2179062.5,
      "reject": 19.0,
      "rejectLower": 98.25,
      "abstain": 0.375
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-orchard-counterfeiting-vulnerability-bug-bounty/57008"
      },
      {
        "label": "GitHub #51",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/51"
      }
    ]
  },
  {
    "id": "53",
    "question": 35,
    "title": "Bonus Grant — Orchard Counterfeiting Bug Bounty",
    "applicant": "Jason McGee",
    "requestedUsdCents": 75000000,
    "summary": "Nomination topping up application #51 to a $1,500,000 total",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 654.3989 ZEC, the $750,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2174540.625,
      "reject": 2823.875,
      "rejectLower": 96.5,
      "abstain": 1763.0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/taylor-hornby-bonus-grant-for-orchard-counterfeiting-vulnerability-bug-bounty/57025"
      },
      {
        "label": "GitHub #53",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/53"
      }
    ]
  },
  {
    "id": "64",
    "question": 36,
    "title": "ValarGroup Ironwood Work",
    "applicant": "ValarGroup",
    "requestedUsdCents": 120300000,
    "summary": "Emergency development, integration, testing, and activation work for Ironwood (NU6.3)",
    "outcome": "funded",
    "notes": [
      "Paid October 16, 2026: 1,049.6558 ZEC, the $1,203,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 2174891.5,
      "reject": 47.375,
      "rejectLower": 3121.875,
      "abstain": 1214.5
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-valargroup-ironwood-work/57053"
      },
      {
        "label": "GitHub #64",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/64"
      }
    ]
  },
  {
    "id": "33",
    "question": 37,
    "title": "ZODL Q1 & Q2 2026 Core Protocol Development",
    "applicant": "ZODL",
    "requestedUsdCents": 195000000,
    "summary": "Amended: vulnerability remediation, Zallet alpha.4, and ZIP 2005/256 progress",
    "outcome": "funded",
    "notes": [
      "Submitted for the postponed Q2 2026 round and carried into Q3: its first coinholder vote.",
      "Paid October 16, 2026: 1,701.4371 ZEC, the $1,950,000 at $1,146.09 per ZEC."
    ],
    "tally": {
      "approve": 1755093.0,
      "reject": 286654.625,
      "rejectLower": 137082.0,
      "abstain": 474.25
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zodl-q1-q2-2026-core-protocol-development/57027"
      },
      {
        "label": "GitHub #33",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/33"
      }
    ]
  }
];

const Q1_2026: RoundProposal[] = [
  {
    "id": "18",
    "question": 1,
    "title": "ZChat: the first working Zcash-native private messenger",
    "applicant": "ZChat Privacy Technologies",
    "requestedUsdCents": 500000,
    "outcome": "rejected",
    "tally": {
      "approve": 154675.87,
      "reject": 192109.54,
      "abstain": 153822.53
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/zchat-shielded-messenger-retroactive-grant/54543"
      },
      {
        "label": "GitHub #18",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/18"
      }
    ]
  },
  {
    "id": "20",
    "question": 2,
    "title": "zec-pay.com",
    "applicant": "Tomas Matejicek",
    "requestedUsdCents": 2260000,
    "outcome": "rejected",
    "tally": {
      "approve": 33932.93,
      "reject": 433697.04,
      "abstain": 32977.97
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/retroactive-grant-application-zec-pay-com/54679"
      },
      {
        "label": "GitHub #20",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/20"
      }
    ]
  },
  {
    "id": "19",
    "question": 3,
    "title": "Maya Protocol Advanced Shielded ZEC Support",
    "applicant": "Maya Protocol",
    "requestedUsdCents": 4500000,
    "outcome": "funded",
    "notes": [
      "Paid April 14, 2026 by the key-holders Shielded Labs and the Zcash Foundation: 129.82 ZEC from their multisig."
    ],
    "tally": {
      "approve": 500496.82,
      "reject": 111.12,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/maya-protocol-advanced-shielded-zec-support-retroactive-grant/54593"
      },
      {
        "label": "GitHub #19",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/19"
      },
      {
        "label": "Payment",
        "href": "https://forum.zcashcommunity.com/t/polling-closed-coinholder-directed-grants-program-q1-round/55048/23"
      }
    ]
  },
  {
    "id": "22",
    "question": 4,
    "title": "ZK Email in Halo2",
    "applicant": "ZK Email",
    "requestedUsdCents": 5000000,
    "outcome": "rejected",
    "tally": {
      "approve": 62.39,
      "reject": 433932.54,
      "abstain": 66613.01
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/zk-email-retroactive-grant-for-halo2-development/54711"
      },
      {
        "label": "GitHub #22",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/22"
      }
    ]
  },
  {
    "id": "23",
    "question": 5,
    "title": "zcash.me",
    "applicant": "ZcashMe, Inc.",
    "requestedUsdCents": 6120000,
    "outcome": "rejected",
    "tally": {
      "approve": 120437.04,
      "reject": 188158.04,
      "abstain": 192012.86
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/call-for-proposals-coinholder-directed-retroactive-grants-program-q1-2026/54208/10"
      },
      {
        "label": "GitHub #23",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/23"
      }
    ]
  },
  {
    "id": "21",
    "question": 6,
    "title": "Pepper-Sync",
    "applicant": "Zingo Labs",
    "requestedUsdCents": 46100000,
    "outcome": "rejected",
    "notes": [
      "Zingo Labs' second request for this work; the Q4 2025 round rejected $1,975,000."
    ],
    "tally": {
      "approve": 31713.37,
      "reject": 427410.02,
      "abstain": 41484.55
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/application-for-retroactive-funding-for-pepper-sync-second-attempt/54693"
      },
      {
        "label": "GitHub #21",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/21"
      }
    ]
  },
  {
    "id": "rescind-ecc",
    "question": 7,
    "title": "Rescind the Q4 2025 grant of $2,673,974 to the Electric Coin Company (Bootstrap Org)",
    "applicant": null,
    "requestedUsdCents": null,
    "outcome": "discarded",
    "notes": [
      "Added to the ballot without the 30-day review ZIP 1016 requires, so FPF discarded its result; its votes were never published. The grant was vetoed by the key-holders instead."
    ],
    "tally": null,
    "links": [
      {
        "label": "FPF decision",
        "href": "https://forum.zcashcommunity.com/t/polling-closed-coinholder-directed-grants-program-q1-round/55048/13"
      },
      {
        "label": "GitHub #2",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/2"
      }
    ]
  }
];

const Q4_2025: RoundProposal[] = [
  {
    "id": "fpf-admin",
    "question": 1,
    "title": "FPF: administration of the Coinholder-Directed Retroactive Grants Program",
    "applicant": "Financial Privacy Foundation",
    "requestedUsdCents": 5800000,
    "requestedNote": "one-year fee",
    "outcome": "funded",
    "notes": [
      "Paid February 3, 2026. An administration fee, not a retroactive grant; filed on the forum, not on GitHub."
    ],
    "tally": {
      "approve": 1021591,
      "reject": 0,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/proposal-funding-fpf-s-administrative-operational-role-for-the-coinholder-directed-retroactive-grants-program/52358"
      }
    ]
  },
  {
    "id": "1",
    "question": 2,
    "title": "Bitcoin VN",
    "applicant": "BitcoinVN",
    "requestedUsdCents": 1000000,
    "outcome": "funded",
    "notes": [
      "Paid February 3, 2026."
    ],
    "tally": {
      "approve": 889793,
      "reject": 5000,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/bitcoinvn-no-sign-up-instant-swap-exchange/52172"
      },
      {
        "label": "GitHub #1",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/1"
      }
    ]
  },
  {
    "id": "2",
    "question": 3,
    "title": "Bootstrap Org / Electric Coin Company",
    "applicant": "Bootstrap Org / Electric Coin Company",
    "requestedUsdCents": 267397400,
    "outcome": "vetoed",
    "notes": [
      "Passed the coinholder vote. Payment was put on hold on February 4, 2026; Shielded Labs and the Zcash Foundation announced their veto on March 16, 2026, citing substantially changed circumstances; their boards' formal resolutions were posted on May 14, 2026. Not paid: the funds stay in the pool, and Bootstrap may resubmit."
    ],
    "tally": {
      "approve": 1231440,
      "reject": 1000,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/bootstrap-org-electric-coin-company/52263"
      },
      {
        "label": "GitHub #2",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/2"
      },
      {
        "label": "Veto statement",
        "href": "https://forum.zcashcommunity.com/t/statement-on-the-bootstrap-ecc-q4-2025-retroactive-grant/54988"
      }
    ]
  },
  {
    "id": "3",
    "question": 4,
    "title": "ZcashCommunity.com Hosting",
    "applicant": "mineZcash",
    "requestedUsdCents": 594100,
    "outcome": "funded",
    "notes": [
      "Paid February 3, 2026."
    ],
    "tally": {
      "approve": 1042038,
      "reject": 0,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/zcashcommunity-com-hosting/52266"
      },
      {
        "label": "GitHub #3",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/3"
      }
    ]
  },
  {
    "id": "4",
    "question": 5,
    "title": "Zcash Community Voting Authorities",
    "applicant": "The Voting Authorities (dismad and team)",
    "requestedUsdCents": 2675000,
    "outcome": "rejected",
    "tally": {
      "approve": 12747,
      "reject": 1095202,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/zcash-community-voting-authorities/52323"
      },
      {
        "label": "GitHub #4",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/4"
      }
    ]
  },
  {
    "id": "5",
    "question": 6,
    "title": "CrowdStore P2P Marketplace",
    "applicant": "Tomas Matejicek",
    "requestedUsdCents": 80000000,
    "outcome": "rejected",
    "tally": {
      "approve": 1004,
      "reject": 1131954,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/crowdstore-p2p-marketplace-in-browser-with-orders-in-zcash-memos/52348"
      },
      {
        "label": "GitHub #5",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/5"
      }
    ]
  },
  {
    "id": "6",
    "question": 7,
    "title": "NozyWallet",
    "applicant": "Leonine DAO",
    "requestedUsdCents": 2100000,
    "outcome": "rejected",
    "notes": [
      "Almost all of its approve votes came from the round's one transparent voter."
    ],
    "tally": {
      "approve": 105006,
      "reject": 1000960,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/nozy-wallet-retroactive-grant/52417"
      },
      {
        "label": "GitHub #6",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/6"
      }
    ]
  },
  {
    "id": "7",
    "question": 8,
    "title": "Unstoppable Wallet",
    "applicant": "Horizontal Systems",
    "requestedUsdCents": 4800000,
    "outcome": "funded",
    "notes": [
      "Paid February 3, 2026."
    ],
    "tally": {
      "approve": 1008125,
      "reject": 0,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/unstoppable-wallet-full-zcash-shielded-support-sdk-integration/52433"
      },
      {
        "label": "GitHub #7",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/7"
      }
    ]
  },
  {
    "id": "9",
    "question": 9,
    "title": "Pepper-Sync by Zingo Labs",
    "applicant": "Zingo Labs",
    "requestedUsdCents": 197500000,
    "outcome": "rejected",
    "tally": {
      "approve": 1332,
      "reject": 1041359,
      "abstain": 0
    },
    "links": [
      {
        "label": "Forum",
        "href": "https://forum.zcashcommunity.com/t/pepper-sync/52445"
      },
      {
        "label": "GitHub #9",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/9"
      }
    ]
  }
];

const RATIFICATION_2025: RoundProposal[] = [
  {
    "id": "r1",
    "question": 1,
    "title": "Limit the program to retroactive grants only",
    "applicant": null,
    "requestedUsdCents": null,
    "outcome": "passed",
    "tally": {
      "approve": 1389721,
      "reject": 105044,
      "abstain": 0
    },
    "links": []
  },
  {
    "id": "r2",
    "question": 2,
    "title": "Award partial funding when an approved grant exceeds the funds available that quarter",
    "applicant": null,
    "requestedUsdCents": null,
    "outcome": "passed",
    "tally": {
      "approve": 781681,
      "reject": 155123,
      "abstain": 0
    },
    "links": []
  },
  {
    "id": "r3",
    "question": 3,
    "title": "Approve the program structure and grants process, and write it into a ZIP",
    "applicant": null,
    "requestedUsdCents": null,
    "outcome": "passed",
    "tally": {
      "approve": 994611,
      "reject": 15,
      "abstain": 0
    },
    "links": []
  }
];

export const ROUNDS: Round[] = [
  {
    id: "q3-2026",
    label: "Q3 2026",
    announcedAs: "Q3 Coinholder-Directed Retroactive Grants Program",
    status: "results",
    tagline: "17 of 37 funded",
    changes: [
      "Valar vote chain, reached from three wallets: ZODL, Zkool and Vizor.",
      "New answer: reject, but reconsider at a lower amount.",
      "Abstentions left out of the majority test.",
      "First vote for nine proposals carried over from Q2."
    ],
    summary: "One result, first published as Abstain, was corrected to Funded six hours later: abstentions do not count toward the majority.",
    windows: [
      { label: "Proposals", value: "Aug 2 – Aug 14, 2026", start: "2026-08-02", end: "2026-08-14" },
      { label: "Review", value: "Aug 17 – Sep 16, 2026", start: "2026-08-17", end: "2026-09-16" },
      { label: "Voting", value: "Sep 17 – Sep 29, 2026 · 20:00 UTC", start: "2026-09-17", end: "2026-09-29" },
    ],
    ballot: [
      { key: "approve", label: "Accept" },
      { key: "reject", label: "Reject · do not support the project" },
      { key: "rejectLower", label: "Reject · would reconsider at a lower amount" },
      { key: "abstain", label: "Abstain" },
    ],
    votingSystem: "Shielded, coin-weighted voting on the Valar Group vote chain through the ZODL, Zkool and Vizor wallets, with the snapshot at block 3,485,940. Ballots are encrypted and tallied by ten validators with a seven-of-ten threshold. FPF confirmed on October 2 that Q3 required voters to explicitly select Abstain; it was not a default.",
    turnout: "About 2.18 million ZEC on every question (2,179,030 to 2,181,453 ZEC). These totals measure voting power, not the number of holders, and do not establish how much attention each proposal received.",
    closePrice: { usd: 1399.9, date: "2026-09-29" },
    talliesSource: { label: "the finalized round on the Valar vote chain, served identically by the Zcash Foundation's vote server", href: VOTE_CHAIN },
    proposals: Q3_2026,
    notes: [
      "FPF's results post lists outcomes only. The per-question tallies are public on the vote chain; they match the table T. S. Felstead (VASP Holdings) transcribed from the Vizor wallet, and every published outcome.",
      "FPF confirmed on September 30, 2026 that abstentions are left out of the majority test: Connaugh Zcash Videos, first published as Abstain, is Funded. No other result changes under either reading.",
      "No proposal ended with “would reconsider at a lower amount” as its result, but the option drew large blocks of ZEC on some questions, including funded ones; each bar shows it separately.",
      "Nine proposals were submitted for the postponed Q2 round and carried into Q3; for them this was the first vote, not a second rejection.",
      "Paid on October 16, 2026: the key-holders sent 7,320.535 ZEC from the multisig for the 17 grants ($8,389,992 at $1,146.09 per ZEC, the price FPF set on October 13), through the shielded pool in three transactions. FPF confirmed on October 19 that every Q3 disbursement was complete.",
    ],
    sources: [
      { label: "Official results (FPF)", href: FORUM + "q3-coinholder-directed-retroactive-grants-program-results/57909" },
      { label: "FPF counting and ballot clarification · Oct 2", href: FORUM + "q3-coinholder-directed-retroactive-grants-program-results/57909/19" },
      { label: "Disbursements complete (FPF) · Oct 19", href: FORUM + "q3-coinholder-directed-retroactive-grants-program-results/57909/23" },
      { label: "Payments by grant (Coinholder sheet)", href: "https://docs.google.com/spreadsheets/d/1FQ28rDCyRW0TiNxrm3rgD8ai2KGUsXAjPieQmI1kKKg/edit?gid=722519692#gid=722519692" },
      { label: "Multisig transactions · Oct 16", href: "https://mainnet.zcashexplorer.app/address/t3ev37Q2uL1sfTsiJQJiWJoFzQpDhmnUwYo" },
      { label: "Tallies (vote chain)", href: VOTE_CHAIN },
      { label: "Vizor transcription and analysis", href: FORUM + "the-hand-of-god-what-q3s-coinholder-retroactive-grants-vote-tells-us/57910" },
      { label: "Zakura vote results", href: "https://zakura.com/voting/" },
      { label: "Review post, 37 proposals", href: FORUM + "30-day-review-period-coinholder-directed-retroactive-grants-program-q3/57056" },
      { label: "GitHub submissions", href: GITHUB.slice(0, -1) },
    ],
  },
  {
    id: "q2-2026",
    label: "Q2 2026",
    announcedAs: "Coinholder-Directed Retroactive Grants Program Q2 2026",
    status: "postponed",
    tagline: "Postponed · moved to Q3",
    changes: [
      "Postponed over an Orchard vulnerability; proposals moved to Q3."
    ],
    summary: "Never voted: postponed on June 11, 2026 because the voting protocol relied on Orchard notes and an Orchard vulnerability had been disclosed. Its proposals moved to Q3.",
    windows: [
      { label: "Review opened", value: "May 14, 2026" },
      { label: "Postponed", value: "Jun 11, 2026" },
      { label: "Was due to close", value: "Jun 17, 2026 · 20:00 UTC", missed: true },
    ],
    ballot: [],
    votingSystem: null,
    turnout: null,
    closePrice: null,
    talliesSource: null,
    proposals: [],
    notes: [
      "No votes were cast, so no Q2 proposal was rejected: every carried proposal had its first coinholder vote in Q3.",
    ],
    carriedOver: [
    {
        "title": "Zcash Grants Hub",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/24"
    },
    {
        "title": "Expanding Zcash In Unstoppable Wallet",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/25"
    },
    {
        "title": "Open-Source Zcash Hardware-Wallet SDK",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/28"
    },
    {
        "title": "Zafu Browser Extension",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/29"
    },
    {
        "title": "CipherPay",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/30"
    },
    {
        "title": "ZAP1 Attestation Protocol and Verification Tooling",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/31"
    },
    {
        "title": "THORSwap / Metro",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/32"
    },
    {
        "title": "ZODL Q1 & Q2 2026 Core Protocol Development",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/33"
    },
    {
        "title": "ZcashNames",
        "href": "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/34"
    }
],
    sources: [
      { label: "Postponement (FPF)", href: FORUM + "coinholder-directed-retroactive-grants-program-q2-2026-30-day-review-period-now-open-postponed-to-q3/55701/3" },
      { label: "Q3 call for proposals", href: FORUM + "call-for-proposals-coinholder-directed-retroactive-grants-program-q3/56885" },
    ],
  },
  {
    id: "q1-2026",
    label: "Q1 2026",
    announcedAs: "Coinholder-Directed Grants Program (Q1 Round)",
    status: "results",
    tagline: "1 of 6 funded",
    changes: [
      "One address in the Zkool wallet for every question.",
      "Abstain added, as the default answer.",
      "A late ballot question discarded under the 30-day rule."
    ],
    summary: "Six proposals and a question on rescinding the ECC grant. Only Maya Protocol passed; the rescission question was discarded for skipping the 30-day review.",
    windows: [
      { label: "Proposals", value: "Jan 9 – Feb 15, 2026", start: "2026-01-09", end: "2026-02-15" },
      { label: "Review", value: "Feb 16 – Mar 17, 2026", start: "2026-02-16", end: "2026-03-17" },
      { label: "Voting", value: "Mar 20 – Apr 1, 2026 · 23:59 UTC", start: "2026-03-20", end: "2026-04-01" },
    ],
    ballot: [{ key: "approve", label: "Approve" }, { key: "reject", label: "Reject" }, { key: "abstain", label: "Abstain" }],
    votingSystem: "Zkool wallet at zecvote.zone, one address for every question, each defaulting to Abstain. The deadline moved from March 31 to April 1 after a voting-server outage.",
    turnout: "500,607.94 ZEC on every question, Abstain included.",
    closePrice: { usd: 250.94, date: "2026-04-01" },
    talliesSource: { label: "dismad for the Voting Authorities, recounted with the published election seed", href: FORUM + "polling-closed-coinholder-directed-grants-program-q1-round/55048/17" },
    proposals: Q1_2026,
    notes: [
      "ZIP 1016 does not say whether Abstain counts toward the 420,000 ZEC minimum. Counting it, every question qualified; excluding it, ZChat and zcash.me did not. Neither reading changes an outcome, because both had more Reject than Approve.",
      "The round was announced without “Retroactive” in its name; the poll still described a retroactive program.",
    ],
    sources: [
      { label: "Tallies (Voting Authorities)", href: FORUM + "polling-closed-coinholder-directed-grants-program-q1-round/55048/17" },
      { label: "Discarded question (FPF)", href: FORUM + "polling-closed-coinholder-directed-grants-program-q1-round/55048/13" },
      { label: "Maya payment (FPF)", href: FORUM + "polling-closed-coinholder-directed-grants-program-q1-round/55048/23" },
    ],
  },
  {
    id: "q4-2025",
    label: "Q4 2025",
    announcedAs: "Coinholder-Directed Retroactive Grants Program",
    status: "results",
    tagline: "5 of 9 approved · 1 vetoed",
    changes: [
      "First grants round, one election per question.",
      "Approve or Reject only.",
      "First key-holder veto, on the ECC grant."
    ],
    summary: "The first round: nine questions, five approved, including FPF's administration fee. The ECC grant was later vetoed by the key-holders.",
    windows: [
      { label: "Proposals", value: "Sep 8 – Oct 12, 2025", start: "2025-09-08", end: "2025-10-12" },
      { label: "Review", value: "Oct 13 – Nov 12, 2025", start: "2025-10-13", end: "2025-11-12" },
      { label: "Voting", value: "Nov 13 – Nov 25, 2025 · 23:59 UTC", start: "2025-11-13", end: "2025-11-25" },
    ],
    ballot: APPROVE_REJECT,
    votingSystem: "Coin Voting 2.0: one zecvote.zone election per question, with each election's seed published so anyone can recount. There was no Abstain option; a holder abstained by not voting on a question.",
    turnout: "894,793 to 1,232,440 ZEC per question, every question above 420,000 ZEC; 217 ballots in all. Each total includes 105,002 transparent ZEC from a single voter.",
    closePrice: { usd: 512.55, date: "2025-11-25" },
    talliesSource: { label: "FPF results summary", href: FORUM + "coinholder-directed-retroactive-grants-program-results-nov-2025/53487" },
    proposals: Q4_2025,
    notes: [
      "Paid on February 3, 2026: $121,941 across four approvals (FPF administration, Bitcoin VN, ZcashCommunity.com and Unstoppable Wallet).",
      "The $2,673,974 approved for the Electric Coin Company was never paid: Shielded Labs and the Zcash Foundation vetoed it under ZIP 1016 after the ECC team left for ZODL.",
    ],
    sources: [
      { label: "Official results (FPF)", href: FORUM + "coinholder-directed-retroactive-grants-program-results-nov-2025/53487" },
      { label: "Shielded Labs summary", href: "https://shieldedlabs.net/coinholder-directed-retroactive-grants-program-q4-results/" },
      { label: "ECC veto statement", href: FORUM + "statement-on-the-bootstrap-ecc-q4-2025-retroactive-grant/54988" },
    ],
  },
  {
    id: "ratification-2025",
    label: "Ratification",
    announcedAs: "Coinholder poll to ratify the Retroactive Grants Program",
    status: "ratified",
    tagline: "Sep 2025 · program approved",
    changes: [
      "Retroactive grants only; partial funding allowed.",
      "Coin Voting 2.0 with public election seeds."
    ],
    summary: "Coinholders set the program's terms: retroactive grants only, partial funding when the fund runs short, and a ZIP to follow.",
    windows: [
      { label: "Poll closed", value: "Sep 3, 2025 · 23:59 UTC" },
      { label: "Results", value: "Sep 4, 2025" },
    ],
    ballot: [{ key: "approve", label: "Yes" }, { key: "reject", label: "No" }],
    votingSystem: "Coin Voting 2.0 on zecvote.zone, with published election seeds for recounts.",
    turnout: "1,494,765 ZEC on the first question.",
    closePrice: { usd: 39.734, date: "2025-09-03" },
    talliesSource: { label: "Poll results (forum)", href: FORUM + "polling-closed-coinholder-poll-to-ratify-the-retroactive-grants-program/52013/38" },
    proposals: RATIFICATION_2025,
    notes: [
      "One transparent voter cast 105,000 ZEC: No on the first two questions, Yes on the third.",
    ],
    sources: [
      { label: "Poll results (forum)", href: FORUM + "polling-closed-coinholder-poll-to-ratify-the-retroactive-grants-program/52013/38" },
      { label: "Shielded Labs summary", href: "https://shieldedlabs.net/zcash-coinholders-approve-retroactive-grants-program/" },
      { label: "Program proposal", href: FORUM + "nu6-1-coinholder-directed-retroactive-grants-program/51713" },
    ],
  },
];
