import { test } from "vitest";
import assert from "node:assert/strict";
import {
  newDraft,
  validateDraft,
  publishDraft,
  rewardOf,
  migrateDraft,
  sampleCampaigns,
  sampleOpportunities,
  safeHttpUrl,
} from "./model";
const valid = () =>
  newDraft({
    title: "Create a welcome guide",
    description: "Create a concise guide for new Zcash community members.",
    deliverables: "Markdown guide",
    criteria: "Accurate links to official sources",
    reward: "1.5",
    deadline: "2026-11-30",
  });
const validate = (d: ReturnType<typeof valid>, step: number) =>
  validateDraft(
    d,
    step,
    ["personal", "my-community"],
    sampleCampaigns,
    "2026-11-03",
  );
test("publishing requires an organizer the contributor manages and a matching campaign", () => {
  assert.ok(validate({ ...valid(), organizer: "open-builders" }, 0).organizer);
  assert.ok(validate({ ...valid(), campaign: "november" }, 0).campaign);
  assert.deepEqual(validate(valid(), 0), {});
});
test("empty or incomplete briefs do not reach review", () => {
  assert.ok(validate({ ...valid(), criteria: "\n " }, 1).criteria);
  assert.ok(validate({ ...valid(), deliverables: "" }, 1).deliverables);
  assert.ok(validate({ ...valid(), description: "Build it" }, 1).description);
});
test("ZEC rewards reject negative, missing, and sub-zatoshi amounts", () => {
  for (const reward of ["", "0", "-3", "0.000000001", "NaN"])
    assert.ok(validate({ ...valid(), reward }, 2).reward);
  assert.deepEqual(validate({ ...valid(), reward: "0.00000001" }, 2), {});
});
test("contest prizes are explicit and the published total matches them", () => {
  const d = {
    ...valid(),
    type: "Contest" as const,
    prizes: ["1.2", ".5", ".3"],
  };
  assert.equal(rewardOf(d), 2);
  assert.deepEqual(publishDraft(d, "demo").prizes, [1.2, 0.5, 0.3]);
  assert.ok(validate({ ...d, prizes: ["1", ""] }, 2).reward);
});
test("deadlines and review/delivery windows are checked", () => {
  for (const deadline of ["2026-11-03", "2026-02-31", "invalid"])
    assert.ok(validate({ ...valid(), deadline }, 2).deadline);
  assert.ok(
    validate({ ...valid(), campaign: "november", deadline: "2026-11-30" }, 2)
      .deadline,
  );
  assert.ok(validate({ ...valid(), reviewDays: "0" }, 2).reviewDays);
  assert.ok(validate({ ...valid(), deliveryDays: "181" }, 2).deliveryDays);
});
test("legacy drafts retain their text without carrying unverified organization ownership", () => {
  const d = migrateDraft({
    id: "legacy",
    title: "Legacy draft",
    postingAs: "Community",
    organizer: "Example Group",
    description: "Existing text",
    criteria: "Existing criteria",
    reward: "2",
  });
  assert.equal(d.title, "Legacy draft");
  assert.equal(d.organizer, "personal");
  assert.equal(d.description, "Existing text");
  assert.equal(d.criteria, "Existing criteria");
  assert.equal("postingAs" in d, false);
});
test("hackathons are campaigns and each contest pool equals its awards", () => {
  assert.equal(
    sampleCampaigns.find((c) => c.id === "weekend")?.kind,
    "Hackathon",
  );
  for (const o of sampleOpportunities.filter((o) => o.type === "Contest"))
    assert.equal(
      o.prizes.reduce((sum, n) => sum + Math.round(n * 1e8), 0),
      Math.round(o.reward * 1e8),
    );
});
test("submitted links only navigate to HTTP or HTTPS destinations", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(
    safeHttpUrl("https://example.com/demo"),
    "https://example.com/demo",
  );
});
