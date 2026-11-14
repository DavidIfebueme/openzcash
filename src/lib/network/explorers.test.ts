import { describe, expect, it } from "vitest";
import { NETWORK_EXPLORERS, transactionExplorers } from "./explorers";

const TXID = "3ad07a5e214b44da6c6fb6a5f4018ce1f18ed84e09ade768596f29c238993281";

describe("transaction pages of the listed explorers", () => {
  it("links a transaction on each of the listed explorers, in the order of the list", () => {
    const links = transactionExplorers(TXID);
    expect(links.map(({ id, href }) => [id, href])).toEqual([
      ["zecblock", `https://zecblock.com/tx/${TXID}`],
      ["shieldedscan", `https://shieldedscan.xyz/tx/${TXID}`],
      ["zcashinfo", `https://zcashinfo.com/tx/${TXID}`],
      ["zscan", `https://zscan.cash/tx/${TXID}`],
    ]);
    // Name, domain and logo come from the same list the Zcash Network page shows.
    for (const link of links) {
      const listed = NETWORK_EXPLORERS.find(({ id }) => id === link.id);
      expect(link).toMatchObject({
        name: listed?.name,
        domain: listed?.domain,
        logo: listed?.logo,
      });
    }
  });

  it("keeps every transaction page on the explorer's own domain, over https", () => {
    let checked = 0;
    for (const explorer of NETWORK_EXPLORERS) {
      if (!("transactionUrl" in explorer)) continue;
      checked += 1;
      const url = new URL(explorer.transactionUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(explorer.domain);
      expect(explorer.transactionUrl.endsWith("/")).toBe(true);
    }
    expect(checked).toBe(NETWORK_EXPLORERS.length);
  });

  it("builds no link for anything that is not a transaction id", () => {
    for (const value of [
      "",
      "3ad07a",
      TXID.toUpperCase(),
      `${TXID}/../x`,
      `${TXID}?next=https://example.com`,
      "g".repeat(64),
    ]) {
      expect(transactionExplorers(value)).toEqual([]);
    }
  });
});
