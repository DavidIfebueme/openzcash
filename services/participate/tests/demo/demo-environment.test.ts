// @vitest-environment node
import {
  demoConfigurationProblem,
  demoEnvironmentActive,
} from "@/lib/demo/environment";
import { demoEmailAllowed, demoTesterName, isDemoSeat } from "@/lib/demo/seats";
import { seatChoice, seatRationale } from "@/lib/demo/fill";
import { decisionRationale } from "@/lib/decisions/format";

const demo = {
  PARTICIPATE_DEMO_ENVIRONMENT: "true",
  PARTICIPATE_COMMITTEE_ENABLED: "true",
  DATABASE_URL:
    "postgresql://app:pw@demo-db.railway.internal:5432/participate_demo",
  APP_BASE_URL: "https://demo.openzcash.org",
  PASSKEY_ORIGIN: "https://demo.openzcash.org",
  PARTICIPATE_PARENT_ORIGIN: "https://demo.openzcash.org",
};

describe("committee demo guard", () => {
  it("accepts only an explicit demo deployment on a demo database and origin", () => {
    expect(demoConfigurationProblem(demo)).toBeNull();
    expect(
      demoConfigurationProblem({
        ...demo,
        DATABASE_URL:
          "postgresql://u:p@localhost:5432/participate_demo_sandbox",
      }),
    ).toBeNull();
  });
  it.each([
    [{ PARTICIPATE_DEMO_ENVIRONMENT: undefined }, "DEMO_FLAG_OFF"],
    [{ PARTICIPATE_DEMO_ENVIRONMENT: "1" }, "DEMO_FLAG_OFF"],
    [{ PARTICIPATE_COMMITTEE_ENABLED: "false" }, "DEMO_COMMITTEE_OFF"],
    [{ PARTICIPATE_PUBLIC_DEMO: "true" }, "DEMO_COMMITTEE_OFF"],
    [
      {
        DATABASE_URL:
          "postgresql://app:pw@db.railway.internal:5432/participate",
      },
      "DEMO_DATABASE_REQUIRED",
    ],
    [
      {
        DATABASE_URL:
          "postgresql://app:pw@db.railway.internal:5432/railway",
      },
      "DEMO_DATABASE_REQUIRED",
    ],
    [
      { DATABASE_URL: "postgresql://app:pw@db:5432/participate_demo-prod" },
      "DEMO_DATABASE_REQUIRED",
    ],
    [{ DATABASE_URL: undefined }, "DEMO_DATABASE_REQUIRED"],
    [{ APP_BASE_URL: "https://openzcash.org" }, "DEMO_ORIGIN_REQUIRED"],
    [{ PASSKEY_ORIGIN: "https://www.openzcash.org" }, "DEMO_ORIGIN_REQUIRED"],
    [
      { PARTICIPATE_PARENT_ORIGIN: "https://openzcash.org" },
      "DEMO_ORIGIN_REQUIRED",
    ],
    [
      {
        APP_BASE_URL: undefined,
        PASSKEY_ORIGIN: undefined,
        PARTICIPATE_PARENT_ORIGIN: undefined,
      },
      "DEMO_ORIGIN_REQUIRED",
    ],
    [
      { PARTICIPATE_AUTOMATION_CONFIG: "/etc/participate.json" },
      "DEMO_EXTERNAL_WRITES_CONFIGURED",
    ],
    [
      { ARCHIVE_TESTNET_SIGNING_ENABLED: "true" },
      "DEMO_EXTERNAL_WRITES_CONFIGURED",
    ],
    [{ ZALLET_RPC_URL: "http://wallet" }, "DEMO_EXTERNAL_WRITES_CONFIGURED"],
  ])("refuses %o", (override, problem) => {
    expect(demoConfigurationProblem({ ...demo, ...override })).toBe(problem);
  });
  it("never queries the database when the configuration does not qualify", async () => {
    const client = { $queryRaw: vi.fn() };
    expect(
      await demoEnvironmentActive(client as never, {
        ...demo,
        PARTICIPATE_DEMO_ENVIRONMENT: undefined,
      }),
    ).toBe(false);
    expect(client.$queryRaw).not.toHaveBeenCalled();
  });
  it("requires the marker row in a demo-named database", async () => {
    const missing = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          { database: "participate_demo", marker: null },
        ]),
    };
    expect(await demoEnvironmentActive(missing as never, demo)).toBe(false);
    const wrongName = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          { database: "participate", marker: "ParticipateDemoEnvironment" },
        ]),
    };
    expect(await demoEnvironmentActive(wrongName as never, demo)).toBe(false);
    const ready = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          {
            database: "participate_demo",
            marker: "ParticipateDemoEnvironment",
          },
        ])
        .mockResolvedValueOnce([{ id: "participate-committee-demo" }]),
    };
    expect(await demoEnvironmentActive(ready as never, demo)).toBe(true);
  });
});

describe("committee demo seats", () => {
  it("splits TEST ballots so the tester decides, or follows the requested outcome", () => {
    expect([0, 1, 2, 3].map((i) => seatChoice("SPLIT", i))).toEqual([
      "APPROVE",
      "APPROVE",
      "REJECT",
      "REJECT",
    ]);
    expect([0, 1, 2, 3].map((i) => seatChoice("APPROVE", i))).toEqual(
      Array(4).fill("APPROVE"),
    );
    expect([0, 1, 2, 3].map((i) => seatChoice("REJECT", i))).toEqual(
      Array(4).fill("REJECT"),
    );
  });
  it("labels every TEST ballot as a demo ballot with a valid public reason", () => {
    const text = seatRationale("Test seat 2", "APPROVE");
    expect(text).toMatch(/^Demo test ballot\./);
    expect(text).toContain("not a committee member's vote");
    expect(decisionRationale.parse(text)).toBe(text);
  });
  it("recognises only the four TEST seats", () => {
    expect(["demo_seat_2", "demo_seat_5"].every(isDemoSeat)).toBe(true);
    expect(
      ["demo_seat_1", "demo_seat_6", "test_reviewer_2", undefined].some(
        isDemoSeat,
      ),
    ).toBe(false);
  });
  it("names testers without exposing their email", () => {
    expect(demoTesterName("cm-user-1")).toMatch(/^Demo tester [0-9A-F]{4}$/);
    expect(demoTesterName("cm-user-1")).toBe(demoTesterName("cm-user-1"));
  });
  it("applies the optional email allowlist", () => {
    expect(demoEmailAllowed("someone@example.org", "")).toBe(true);
    expect(
      demoEmailAllowed("Member@ZCG.example", "member@zcg.example, other@x.org"),
    ).toBe(true);
    expect(demoEmailAllowed("member@zcg.example", "@zcg.example")).toBe(true);
    expect(
      demoEmailAllowed("member@evil.example", "@zcg.example,other@x.org"),
    ).toBe(false);
  });
});
