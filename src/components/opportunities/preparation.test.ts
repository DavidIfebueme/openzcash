import { expect, it } from "vitest";
import { emptyPreparation, preparationText, validatePreparation } from "./preparation";
const good = { ...emptyPreparation(), title: "Test a wallet flow", description: "Write a reproducible report about the receiving flow.", tasks: "Report with reproduction steps", criteria: "Include app version and expected behavior", amount: "0.025", deadline: "2026-11-15" };
it("requires a bounty's deliverable, criteria, reward and deadline", () => {
  expect(validatePreparation(good, "zec-bounties", "2026-11-03")).toEqual({});
  expect(validatePreparation({ ...good, criteria: "", amount: "", deadline: "" }, "zec-bounties", "2026-11-03")).toMatchObject({ criteria: expect.any(String), amount: expect.any(String), deadline: expect.any(String) });
});
it("allows XP-only quests, limits quests to five tasks, and requires reward recipients for a ZEC pool", () => {
  expect(validatePreparation({ ...good, amount: "", deadline: "", xp: "100" }, "gleyo", "2026-11-03")).toEqual({});
  expect(validatePreparation({ ...good, tasks: "1\n2\n3\n4\n5\n6" }, "gleyo", "2026-11-03").tasks).toBeTruthy();
  expect(validatePreparation(good, "gleyo", "2026-11-03").winners).toBeTruthy();
  expect(validatePreparation({ ...good, winners: "3" }, "gleyo", "2026-11-03")).toEqual({});
});
it("rejects invalid amounts, dates and unsafe reference protocols", () => {
  for (const amount of ["-1", "NaN", "Infinity", "1e4", "0", "0.000000001"]) expect(validatePreparation({ ...good, amount }, "zec-bounties", "2026-11-03").amount).toBeTruthy();
  for (const deadline of ["2026-02-30", "yesterday", "2026-11-02"]) expect(validatePreparation({ ...good, deadline }, "zec-bounties", "2026-11-03").deadline).toBeTruthy();
  for (const reference of ["javascript:alert(1)", "https://user:password@example.com"]) expect(validatePreparation({ ...good, reference }, "zec-bounties", "2026-11-03").reference).toBeTruthy();
});
it("exports a portable brief with the right reward semantics, timezone caveat and artwork", () => {
  const text = preparationText({ ...good, winners: "5", language: "pt", country: "BR" }, "gleyo", "zingo");
  expect(text).toContain("ZEC reward pool: 0.025 ZEC");
  expect(text).toContain("Reward recipients: 5");
  expect(text).toContain("confirm time and timezone");
  expect(text).toContain("https://openzcash.org/opportunities/art/zingo.png");
  expect(text).toContain("not published or funded");
  expect(preparationText(good, "zec-bounties", "code")).not.toContain("Reward recipients");
});
