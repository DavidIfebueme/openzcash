import { expect, it } from "vitest";
import { displayMemo, memoPreview } from "./memo";

it("removes direction controls so a memo reads in the order it was written", () => {
  expect(displayMemo("For ‮lx2eahciM‬: retroactive work")).toBe(
    "For lx2eahciM: retroactive work",
  );
  expect(displayMemo("⁦For Michae2xl⁩‏‎؜")).toBe("For Michae2xl");
});

it("keeps ordinary text, right-to-left letters and emoji as written", () => {
  expect(displayMemo("openzcash 💛")).toBe("openzcash 💛");
  expect(displayMemo("שלום עולם")).toBe("שלום עולם");
});

it("previews several memos on one line and cuts on whole characters", () => {
  expect(memoPreview(["For the\ncommunity", "thanks"])).toBe(
    "For the community · thanks",
  );
  const preview = memoPreview([`${"a".repeat(89)}💛💛`]);
  expect(preview).toBe(`${"a".repeat(89)}💛…`);
});
