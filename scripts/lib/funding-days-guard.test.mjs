import { test } from "node:test";
import assert from "node:assert/strict";
import { historyRewrite } from "./funding-days-guard.mjs";

const a = ["2026-09-22", 1, 10, 300.5];
const b = ["2026-09-23", 11, 20, 301];

test("accepts an identical series and appended days", () => {
  assert.equal(historyRewrite([a], [a]), null);
  assert.equal(historyRewrite([a], [a, b]), null);
});

test("refuses a changed published day", () => {
  assert.match(historyRewrite([a, b], [a, [...b.slice(0, 3), 999]]), /2026-09-23 changed/);
});

test("refuses a shorter series", () => {
  assert.match(historyRewrite([a, b], [a]), /shrank from 2 to 1/);
});
