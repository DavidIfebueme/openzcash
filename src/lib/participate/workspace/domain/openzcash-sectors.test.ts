import { describe, expect, it } from "vitest";
import { classifyOpenZcashSectors } from "./openzcash-sectors";

describe("OpenZcash classification before source import", () => {
  it.each([
    ["Konclave: taking the viewing key off the coordinator", ["wallets", "security"]],
    ["CENTIREINGS Zcash Market Segmentation & Comparative Intelligence", ["research"]],
    ["ZEC Order Pay: shielded ZEC checkout, refunds and creator payouts for service marketplaces", ["applications", "integration"]],
    ["Skyhook and ESMASTe: Cross-chain Bridging, Messaging and Execution Layer", ["integration", "infrastructure"]],
  ])("classifies %s without a GitHub category or labels", (title, expected) => {
    expect(classifyOpenZcashSectors(title)).toEqual(expected);
  });

  it("keeps curated topics first, removes duplicates and respects the topic limit", () => {
    const tags = ["infrastructure", "invalid", "wallets", "wallets"];
    expect(classifyOpenZcashSectors("Wallet security research and payment integration", tags)).toEqual(["infrastructure", "wallets", "security"]);
    expect(tags).toEqual(["infrastructure", "invalid", "wallets", "wallets"]);
  });

  it("does not assign categories from a workflow status or an ambiguous name", () => {
    for (const title of ["Grant Application", "Ready For ZCG Review", "Grant Approved", "My new project", "Appreciation for our team's coursework"]) {
      expect(classifyOpenZcashSectors(title)).toEqual([]);
    }
  });

  it("does not turn the official template prefix into an Applications category after import", () => {
    expect(classifyOpenZcashSectors("Grant Application - CENTIREINGS Zcash Market Segmentation & Comparative Intelligence")).toEqual(["research"]);
  });
});
