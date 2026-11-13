/**
 * Public mainnet explorers. Keep destinations and brand assets together.
 *
 * `transactionUrl` is the address of an explorer's transaction page, without
 * the id. It is set only after opening a real transaction there; an explorer
 * without it is left out of transaction menus rather than guessed.
 */
export const NETWORK_EXPLORERS = [
  {
    id: "zecblock",
    name: "ZecBlock",
    domain: "zecblock.com",
    url: "https://zecblock.com/",
    logo: "/logos/explorers/zecblock.svg",
    transactionUrl: "https://zecblock.com/tx/",
  },
  {
    id: "shieldedscan",
    name: "ShieldedScan",
    domain: "shieldedscan.xyz",
    url: "https://shieldedscan.xyz/",
    logo: "/logos/explorers/shieldedscan.png",
  },
  {
    id: "zcashinfo",
    name: "Zcash Info",
    domain: "zcashinfo.com",
    url: "https://zcashinfo.com/",
    logo: "/logos/explorers/zcashinfo.svg",
    transactionUrl: "https://zcashinfo.com/tx/",
  },
  {
    id: "zscan",
    name: "ZScan",
    domain: "zscan.cash",
    url: "https://zscan.cash/",
    logo: "/logos/explorers/zscan.png",
  },
] as const;

const TRANSACTION_ID = /^[0-9a-f]{64}$/;

/** The listed explorers that can show `txid`, each with the address of that transaction there. */
export function transactionExplorers(txid: string) {
  if (!TRANSACTION_ID.test(txid)) return [];
  return NETWORK_EXPLORERS.flatMap((explorer) =>
    "transactionUrl" in explorer
      ? [{ ...explorer, href: `${explorer.transactionUrl}${txid}` }]
      : [],
  );
}
