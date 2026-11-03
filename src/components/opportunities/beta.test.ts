import { test } from "vitest";
import assert from "node:assert/strict";
import {
  BETA_PREVIEW,
  BETA_ZEC_USD,
  betaReward,
  betaPrizes,
  betaMutation,
} from "./beta";
import { sampleOpportunities, sampleCampaigns } from "./model";
import { stockCovers } from "./covers";

test("every library cover is represented by one visible beta opportunity", () => {
  assert.equal(sampleOpportunities.length, 27);
  assert.equal(new Set(sampleOpportunities.map((o) => o.id)).size, 27);
  assert.deepEqual(
    new Set(sampleOpportunities.map((o) => o.art)),
    new Set(stockCovers.map((c) => c.id)),
  );
});
test("all beta amounts and contest pools respect both reward caps", () => {
  for (const o of sampleOpportunities) {
    assert.ok(o.reward > 0 && o.reward < 1, o.id);
    assert.ok(o.reward * BETA_ZEC_USD <= 100, o.id);
    assert.equal(o.funding, "Example");
    assert.equal(o.applicants, 0);
    if (o.type === "Contest") {
      assert.ok(o.prizes.every((n) => n > 0 && n < 1));
      assert.equal(
        o.prizes.reduce((sum, n) => sum + Math.round(n * 10000), 0),
        Math.round(o.reward * 10000),
      );
    }
  }
  assert.ok(betaReward(10000) * BETA_ZEC_USD <= 100);
  for (const invalid of [0, -1, NaN, Infinity])
    assert.throws(() => betaReward(invalid));
});
test("fractional prize splitting preserves the exact pool in smallest display units", () => {
  assert.deepEqual(betaPrizes(0.0007, [6, 3, 1]), [0.0005, 0.0002, 0]);
  assert.deepEqual(betaPrizes(0.0838, [1]), [0.0838]);
});
test("beta state mutations do not execute even when called without the disabled UI", () => {
  assert.equal(BETA_PREVIEW, true);
  const records = {
    drafts: ["existing"],
    published: ["existing"],
    submissions: ["existing"],
    campaigns: ["existing"],
    organizers: ["existing"],
  };
  for (const list of Object.values(records)) {
    const write = betaMutation((item: string) => {
      list.push(item);
    });
    write("new record");
    assert.deepEqual(list, ["existing"]);
  }
});
test("Shielded Labs proposals link to primary sources and share their demo campaign", () => {
  const ids = [
    "test-crosslink",
    "integrate-zero-indexer",
    "zero-stack-workshop",
    "zero-privacy-check",
  ];
  assert.ok(sampleCampaigns.some((c) => c.id === "shielded-labs-lab"));
  for (const id of ids) {
    const item = sampleOpportunities.find((o) => o.id === id)!;
    assert.equal(item.campaign, "shielded-labs-lab");
    assert.ok(
      item.resources?.some(
        (r) => r.url.includes("shieldedlabs") || r.url.includes("ShieldedLabs"),
      ),
    );
  }
  assert.match(
    sampleOpportunities
      .find((o) => o.id === "test-crosslink")!
      .criteria.join(" "),
    /test currency only/,
  );
  assert.match(
    sampleOpportunities
      .find((o) => o.id === "integrate-zero-indexer")!
      .criteria.join(" "),
    /on-chain confirmation/,
  );
});
