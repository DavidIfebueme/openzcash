/**
 * Public mainnet explorers. Keep destinations and brand assets together.
 *
 * `transactionUrl` is the address of an explorer's transaction page, without
 * the id. State on 2026-11-13: ZecBlock and Zcash Info were checked by
 * opening a real transaction. ShieldedScan could not be opened (its site put
 * a bot check in front of the page); the path is the one third-party code
 * uses for its testnet host. ZScan could not be opened either (its host
 * answered "application not found" that day); the path is the conventional
 * one and has to be confirmed once the site is back.
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
    transactionUrl: "https://shieldedscan.xyz/tx/",
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
    transactionUrl: "https://zscan.cash/tx/",
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
