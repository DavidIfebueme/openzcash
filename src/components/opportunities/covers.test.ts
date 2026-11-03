import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  stockCovers,
  filterCovers,
  resolveCover,
  uploadError,
  MAX_COVER_BYTES,
} from "./covers";
import {
  newDraft,
  migrateDraft,
  publishDraft,
  sampleOpportunities,
} from "./model";

test("the complete library resolves to 27 distinct landscape PNG assets", () => {
  assert.equal(stockCovers.length, 27);
  assert.equal(new Set(stockCovers.map((c) => c.id)).size, 27);
  for (const c of stockCovers) {
    const bytes = readFileSync(
      new URL(
        "../../../public/opportunities/art/" + c.id + ".png",
        import.meta.url,
      ),
    );
    assert.equal(bytes.subarray(1, 4).toString(), "PNG", c.id);
    assert.equal(bytes.readUInt32BE(16), 1536, c.id);
    assert.equal(bytes.readUInt32BE(20), 1024, c.id);
  }
});
test("automatic covers follow category and named projects until a manual choice", () => {
  const d = newDraft({
    title: "Create a useful beginner guide",
    category: "Education",
  });
  assert.equal(publishDraft(d, "me").art, "education");
  assert.equal(
    publishDraft({ ...d, category: "Translation" }, "me").art,
    "language",
  );
  assert.equal(
    publishDraft(
      { ...d, title: "Run a Zebra node", category: "Development" },
      "me",
    ).art,
    "zebra",
  );
  assert.equal(
    publishDraft(
      { ...d, title: "HashSmash monthly challenge", category: "Research" },
      "me",
    ).art,
    "hashsmash",
  );
  assert.equal(
    publishDraft({ ...d, art: "zingo", category: "Research" }, "me").art,
    "zingo",
  );
  assert.equal(
    publishDraft({ ...d, art: undefined, category: "Design" }, "me").art,
    "design",
  );
});
test("stock and uploaded choices survive draft serialization, migration and publication", () => {
  for (const art of ["zakura", "upload:11111111-2222-4333-8444-555555555555"]) {
    const restored = migrateDraft(
      JSON.parse(JSON.stringify(newDraft({ art }))),
    );
    assert.equal(restored.art, art);
    assert.equal(publishDraft(restored, "me").art, art);
  }
  const legacy = migrateDraft({ id: "legacy", category: "Content" });
  assert.equal(publishDraft(legacy, "me").art, "story");
  for (const art of [
    "../../secret",
    "https://example.com/image.png",
    "upload:invalid",
  ]) {
    assert.equal(resolveCover(art, "Content"), "story");
    assert.equal(migrateDraft({ id: "bad", art }).art, undefined);
  }
});
test("cover filters distinguish infrastructure, wallet brands and the Yukon challenge", () => {
  assert.deepEqual(
    filterCovers("", "Infrastructure").map((c) => c.id),
    ["zebra", "zakura", "crosslink", "zero-indexer"],
  );
  assert.equal(filterCovers("", "Wallets").length, 10);
  assert.deepEqual(
    filterCovers("yukon").map((c) => c.id),
    ["hashsmash"],
  );
  assert.deepEqual(filterCovers("zakura", "Wallets"), []);
  assert.deepEqual(filterCovers("unmatchedword"), []);
});
test("uploads reject active formats, empty and oversized files before storage", () => {
  assert.match(
    uploadError({ type: "image/svg+xml", size: 100 })!,
    /PNG, JPG or WebP/,
  );
  assert.match(uploadError({ type: "image/png", size: 0 })!, /empty/);
  assert.match(
    uploadError({ type: "image/png", size: MAX_COVER_BYTES + 1 })!,
    /5 MB/,
  );
  assert.equal(
    uploadError({ type: "image/webp", size: MAX_COVER_BYTES }),
    null,
  );
});
test("the monthly challenge has exactly one first-place reward and fixed review rules", () => {
  const contest = sampleOpportunities.find(
    (o) => o.id === "hashsmash-november",
  )!;
  assert.equal(contest.type, "Contest");
  assert.deepEqual(contest.prizes, [contest.reward]);
  assert.equal(contest.deadline, "2026-11-30");
  assert.match(contest.criteria.join(" "), /exactly 40 rounds/);
  assert.match(contest.criteria.join(" "), /share.*equally/);
  assert.match(contest.criteria.join(" "), /no reward is awarded/);
});
