import { describe, expect, it } from "vitest";
import { holdingRows } from "./holdings";
import type { Disclosure, Holder } from "./model";

const gray: Holder = {
  id: "grayscale",
  name: "Grayscale · ZCSH",
  kind: "fund",
  zec: 96899.84928833,
  missing: 0,
  addresses: ([
    ["t1d3xisKP7tfdmNtXr2oDqFToBn1K1gKjSi", 24901.24365952],
    ["t1e2ivMHX7shmSBhBmGzWxeVN3F9MPvDk8R", 24309.63600091],
    ["t1ewXTvioNXo9fRZfjhnwnayQRYBJ5P4ebX", 23872.9668631],
    ["t1am2oFofYswreeeKTN2G2NLiuW9DQvR5DV", 23816.0027648],
  ] as const).map(([address, zec]) => ({
    address,
    label: "Grayscale Zcash Trust",
    category: "exchange",
    verified: true,
    zec,
    source: `https://cipherscan.app/address/${address}`,
  })),
};
const grayDisclosure: Disclosure = {
  id: "grayscale",
  name: "Grayscale · The Zcash ETF",
  ticker: "ZCSH",
  kind: "fund",
  zec: 464514.8551,
  asOf: "2026-09-08",
  source: "https://www.thezcashetf.com/",
  custody: "Coinbase Custody",
  method: "Issuer-reported position",
};

describe("combined holder view", () => {
  it("shows the fund position once and retains its separate address evidence and disclosure date", () => {
    const rows = holdingRows([gray], [{ data: grayDisclosure, stale: true }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      zec: 464514.8551,
      addressZec: 96899.84928833,
      addresses: gray.addresses,
      disclosure: { stale: true, data: { asOf: "2026-09-08" } },
    });
    expect(gray.zec).toBe(96899.84928833);
  });
  it("includes an issuer without attributed addresses, without fabricating any wallet or zero balance", () => {
    const cypherpunk = {
      ...grayDisclosure,
      id: "cypherpunk",
      name: "Cypherpunk Technologies",
      kind: "treasury" as const,
      zec: 326417.51,
      asOf: "2026-08-31",
      source: "https://www.cypherpunk.com/",
    };
    const rows = holdingRows([gray], [{ data: cypherpunk, stale: false }]);
    expect(rows[0]).toMatchObject({
      id: "cypherpunk", zec: 326417.51, addressZec: null, addresses: [],
    });
    expect(rows[1]).toMatchObject({ id: "grayscale", zec: gray.zec });
  });
  it("does not add a fund disclosure to exchange custody or replace a newer disclosure with an older one", () => {
    const coinbase = { ...gray, id: "coinbase", name: "Coinbase", kind: "cex" as const, zec: 1270591.63 };
    const rows = holdingRows([coinbase, gray], [
      { data: grayDisclosure, stale: true },
      { data: { ...grayDisclosure, asOf: "2026-09-01", zec: 500000 }, stale: true },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "coinbase", zec: 1270591.63, addressZec: 1270591.63 });
    expect(rows[1].zec).toBe(464514.8551);
    expect(holdingRows([gray], [])[0]).toMatchObject({ zec: gray.zec, addressZec: gray.zec });
  });
});
