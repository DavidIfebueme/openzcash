import { describe, expect, it } from "vitest";
import { PAYOUTS } from "./program";
import { ROUNDS } from "./rounds";
import {
  awaitingGrantsMissingFrom,
  coinholderGrantViews,
  createOfficialStatus,
  fpfIssueNumber,
  officialGrantStatus,
  officialProposalVerdict,
  type CoinholderLedgerEntry,
} from "./official-status";

const ISSUE =
  "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/";
const q3 = ROUNDS.find((r) => r.id === "q3-2026")!;

/** The overlay as it stood between the Q3 results (Sep 29, 2026) and FPF's report of the payout (Oct 19, 2026). */
const beforeQ3Payout = createOfficialStatus(
  ROUNDS,
  PAYOUTS.map((p) =>
    p.roundId === "q3-2026" ? { ...p, status: "approved" } : p,
  ),
);

describe("fpfIssueNumber", () => {
  it("reads the FPF issue number from plain, fragment and trailing-slash links", () => {
    expect(fpfIssueNumber(`${ISSUE}55`)).toBe("55");
    expect(fpfIssueNumber(`${ISSUE}52#issuecomment-5294050649`)).toBe("52");
    expect(fpfIssueNumber(`${ISSUE}1#issue-3413572985`)).toBe("1");
    expect(fpfIssueNumber(`${ISSUE}24/`)).toBe("24");
  });

  it("ignores other repositories, forum links and placeholders", () => {
    expect(
      fpfIssueNumber(
        "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/55",
      ),
    ).toBeNull();
    expect(
      fpfIssueNumber("https://forum.zcashcommunity.com/t/x/57021"),
    ).toBeNull();
    expect(fpfIssueNumber("NA")).toBeNull();
    expect(fpfIssueNumber(null)).toBeNull();
  });
});

describe("officialProposalVerdict · Q3 2026", () => {
  it("covers all 37 proposals: 17 approved and 20 rejected, as FPF published", () => {
    expect(q3.status).toBe("results");
    expect(q3.proposals).toHaveLength(37);
    const verdicts = q3.proposals.map((p) =>
      officialProposalVerdict({
        platformLink: `${ISSUE}${p.id}`,
        title: "sheet wording",
      }),
    );
    for (const [i, v] of verdicts.entries()) {
      expect(v, q3.proposals[i].title).toMatchObject({
        roundId: "q3-2026",
        roundLabel: "Q3 2026",
      });
    }
    const statuses = verdicts.map((v) => v?.status);
    expect(statuses.filter((s) => s === "approved")).toHaveLength(17);
    expect(statuses.filter((s) => s === "rejected")).toHaveLength(20);
  });

  it("follows every proposal's own outcome, not a count that happens to match", () => {
    for (const p of q3.proposals) {
      const v = officialProposalVerdict({
        platformLink: `${ISSUE}${p.id}`,
        title: p.title,
      });
      expect(v?.status, p.title).toBe(
        p.outcome === "funded" ? "approved" : "rejected",
      );
    }
  });

  it("marks Connaugh Zcash Videos (issue 55) approved after FPF's correction from Abstain", () => {
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}55`,
        title: "Connaugh Zcash Videos",
      }),
    ).toMatchObject({
      status: "approved",
      outcome: "funded",
      proposalId: "55",
    });
  });

  it("matches the spreadsheet's links as imported, fragments included", () => {
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}52#issuecomment-5294050649`,
        title:
          "Project Tachyon - Bonus Grant for Ironwood zk-SNARK Formal Verification",
      })?.status,
    ).toBe("approved");
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}28#issuecomment-4350079774`,
        title: "Open-Source Zcash Hardware-Wallet SDK",
      })?.status,
    ).toBe("rejected");
  });
});

describe("officialProposalVerdict · rows outside a closed round", () => {
  it("leaves a new submission untouched", () => {
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}70`,
        title: "A Q4 2026 application",
      }),
    ).toBeNull();
    expect(
      officialProposalVerdict({
        platformLink: null,
        title: "A Q4 2026 application",
      }),
    ).toBeNull();
  });

  it("never falls back to the title when the row links an FPF issue", () => {
    // Issue 35 (BlindVault, not considered) must not borrow Q3's issue 39 "Blindvault" verdict.
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}35`,
        title: "BlindVault",
      }),
    ).toBeNull();
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}66`,
        title: "Vizor Wallet",
      }),
    ).toBeNull();
  });

  it("maps earlier closed rounds too: veto, approval and rejection", () => {
    expect(
      officialProposalVerdict({ platformLink: `${ISSUE}2`, title: "x" })
        ?.status,
    ).toBe("vetoed");
    expect(
      officialProposalVerdict({ platformLink: `${ISSUE}19`, title: "x" })
        ?.status,
    ).toBe("approved");
    expect(
      officialProposalVerdict({
        platformLink: `${ISSUE}21#issuecomment-3898675571`,
        title: "x",
      })?.status,
    ).toBe("rejected");
  });

  it("uses the title only for rows without an issue link, and never guesses between two rounds", () => {
    expect(
      officialProposalVerdict({
        platformLink: "NA",
        title: "FPF Admin for Coinhold-Directed Retroactive Grants Program",
      }),
    ).toMatchObject({ status: "approved", roundId: "q4-2025" });
    // "NozyWallet" (Q4 2025) and "Nozy Wallet" (Q3 2026) normalise to the same title.
    expect(
      officialProposalVerdict({ platformLink: null, title: "Nozy Wallet" }),
    ).toBeNull();
  });

  it("leaves a discarded question as the records say", () => {
    const rescind = ROUNDS.flatMap((r) => r.proposals).find(
      (p) => p.outcome === "discarded",
    )!;
    expect(
      officialProposalVerdict({ platformLink: null, title: rescind.title }),
    ).toBeNull();
  });
});

/** Q3 2026 grants as FPF's tab named them while they were open. */
const unpaidQ3 = [
  "Ironwood external audit re-imbursement",
  "Ironwood zk-SNARK Formal Verification (Project Tachyon)",
  "Orchard Counterfeiting Vulnerability Bug Bounty",
  "Project Tachyon - Bonus Grant for Ironwood zk-SNARK Formal Verification",
  "Taylor Hornby - Bonus Grant for Orchard Counterfeiting Vulnerability Bug Bounty",
  "Temporary Detectable Unlimited mint and sell Exploit",
  "THORSwap/Metro",
  "Valargroup Ironwood work",
  "zcashtocash via ZcashLabs",
  "Zebra Critical Vulnerability Bug Bounty (CVE-2026-34202)",
  "Zec.rocks (16 months of uptime for Zcash wallets)",
  "ZODL Q1 & Q2 2026 Core Protocol Development",
  "CipherPay",
  "CipherScan Coinholder Retroactive Grant 2026",
  "Five Critical Zebra Consensus Divergence Vulnerabilities",
];

describe("officialGrantStatus · while a closed round awaits payment", () => {
  const { officialGrantStatus } = beforeQ3Payout;

  it("labels every approved, unpaid Q3 grant the ledger marks open as awaiting payment", () => {
    for (const grantKey of unpaidQ3) {
      expect(
        officialGrantStatus({ grantKey, status: "open", paidCount: 0 }),
        grantKey,
      ).toMatchObject({
        status: "awaiting_payment",
        label: "Awaiting payment",
        roundId: "q3-2026",
      });
    }
  });

  it("keeps the ledger's status when a payment is recorded or the grant is closed", () => {
    expect(
      officialGrantStatus({
        grantKey: "CipherPay",
        status: "open",
        paidCount: 1,
      }),
    ).toBeNull();
    expect(
      officialGrantStatus({
        grantKey: "Unstoppable Wallet",
        status: "completed",
        paidCount: 1,
      }),
    ).toBeNull();
    expect(
      officialGrantStatus({
        grantKey: "Bootstrap Org / Electric Coin Company",
        status: "keyholder_veto",
        paidCount: 0,
      }),
    ).toBeNull();
  });

  it("does not relabel a grant from a round FPF reports as paid, or one it cannot place", () => {
    expect(
      officialGrantStatus({
        grantKey: "BitcoinVN",
        status: "open",
        paidCount: 0,
      }),
    ).toBeNull();
    expect(
      officialGrantStatus({
        grantKey: "A future grant",
        status: "open",
        paidCount: 0,
      }),
    ).toBeNull();
  });
});

describe("officialGrantStatus · after FPF reported the Q3 2026 payout (Oct 16, 2026)", () => {
  it("reports every closed round paid, so no grant is awaiting payment", () => {
    const paid = PAYOUTS.filter((p) => p.status === "paid").map(
      (p) => p.roundId,
    );
    const closed = ROUNDS.filter((r) => r.status === "results").map(
      (r) => r.id,
    );
    expect(paid.sort()).toEqual(closed.sort());
  });

  it("keeps the ledger's status on every Q3 grant, even a row still marked open", () => {
    for (const grantKey of unpaidQ3)
      expect(
        officialGrantStatus({ grantKey, status: "open", paidCount: 0 }),
        grantKey,
      ).toBeNull();
    expect(
      officialGrantStatus({
        grantKey: "Unstoppable Wallet",
        status: "open",
        paidCount: 0,
        usdCents: 8_000_000n,
      }),
    ).toBeNull();
  });
});

/** FPF's coinholder grants tab as imported on 2026-09-30: project, status, paid, USD cents. */
const LEDGER: CoinholderLedgerEntry[] = (
  [
    ["BitcoinVN", "completed", true, 1_000_000],
    ["Bootstrap Org / Electric Coin Company", "keyholder_veto", false, 0],
    ["ZcashCommunity.com Website Hosting", "completed", true, 594_100],
    [
      "FPF Admin for Coinhold-Directed Retroactive Grants Program",
      "completed",
      true,
      5_800_000,
    ],
    ["Unstoppable Wallet", "completed", true, 4_800_000],
    [
      "Maya Protocol Advanced Shielded ZEC Support",
      "completed",
      true,
      4_500_000,
    ],
    ["Unstoppable Wallet", "open", false, 8_000_000],
    ["CipherPay", "open", false, 3_500_000],
    ["THORSwap/Metro", "open", false, 6_000_000],
    ["ZODL Q1 & Q2 2026 Core Protocol Development", "open", false, 195_000_000],
    [
      "Ironwood zk-SNARK Formal Verification (Project Tachyon)",
      "open",
      false,
      73_894_200,
    ],
    [
      "Orchard Counterfeiting Vulnerability Bug Bounty",
      "open",
      false,
      75_000_000,
    ],
    ["CipherScan Coinholder Retroactive Grant 2026", "open", false, 37_500_000],
    [
      "Project Tachyon - Bonus Grant for Ironwood zk-SNARK Formal Verification",
      "open",
      false,
      26_105_800,
    ],
    [
      "Temporary Detectable Unlimited mint and sell Exploit",
      "open",
      false,
      40_000_000,
    ],
    [
      "Zebra Critical Vulnerability Bug Bounty (CVE-2026-34202)",
      "open",
      false,
      15_000_000,
    ],
    [
      "Taylor Hornby - Bonus Grant for Orchard Counterfeiting Vulnerability Bug Bounty",
      "open",
      false,
      75_000_000,
    ],
    ["Ironwood external audit re-imbursement", "open", false, 59_900_000],
    [
      "Five Critical Zebra Consensus Divergence Vulnerabilities",
      "open",
      false,
      42_500_000,
    ],
    ["zcashtocash via ZcashLabs", "open", false, 600_000],
    [
      "Zec.rocks (16 months of uptime for Zcash wallets)",
      "open",
      false,
      58_499_200,
    ],
    ["Valargroup Ironwood work", "open", false, 120_300_000],
  ] as const
).map(([project, grantStatus, isPaid, cents]) => ({
  project,
  grantStatus,
  isPaid,
  amountUsdCents: BigInt(cents),
}));

/** What the grants list makes of one project: every entry summed, status by majority (a tie reads "completed"). */
function aggregate(project: string) {
  const own = LEDGER.filter((e) => e.project === project);
  return {
    grantKey: project,
    status: own.some((e) => e.grantStatus === "completed")
      ? "completed"
      : own[0].grantStatus,
    milestoneCount: own.length,
    paidCount: own.filter((e) => e.isPaid).length,
    usdCents: own.reduce((s, e) => s + (e.amountUsdCents ?? 0n), 0n),
  };
}

describe("a project name FPF reused for a later grant · while Q3 2026 awaited payment", () => {
  const { officialGrantStatus, coinholderGrantViews } = beforeQ3Payout;

  it("places the unpaid Unstoppable Wallet entry in Q3 2026 by its amount", () => {
    expect(
      officialGrantStatus({
        grantKey: "Unstoppable Wallet",
        status: "open",
        paidCount: 0,
        usdCents: 8_000_000n,
      }),
    ).toMatchObject({
      label: "Awaiting payment",
      roundId: "q3-2026",
      proposalId: "25",
    });
  });

  it("does not guess without the amount, or with another amount", () => {
    for (const usdCents of [undefined, 4_800_000n, 7_999_900n])
      expect(
        officialGrantStatus({
          grantKey: "Unstoppable Wallet",
          status: "open",
          paidCount: 0,
          usdCents,
        }),
        String(usdCents),
      ).toBeNull();
  });

  it("shows the paid Q4 2025 grant and the unpaid Q3 2026 grant apart, not one completed row", () => {
    const views = coinholderGrantViews(aggregate("Unstoppable Wallet"), LEDGER);
    expect(views).toEqual([
      {
        grantKey: "Unstoppable Wallet",
        status: "completed",
        milestoneCount: 1,
        paidCount: 1,
        usdCents: 4_800_000n,
        official: null,
      },
      expect.objectContaining({
        status: "open",
        milestoneCount: 1,
        paidCount: 0,
        usdCents: 8_000_000n,
        official: expect.objectContaining({ proposalId: "25" }),
      }),
    ]);
  });

  it("keeps every other project as one row", () => {
    for (const project of new Set(LEDGER.map((e) => e.project!))) {
      if (project === "Unstoppable Wallet") continue;
      expect(
        coinholderGrantViews(aggregate(project), LEDGER),
        project,
      ).toHaveLength(1);
    }
    expect(
      coinholderGrantViews(aggregate("CipherPay"), LEDGER)[0].official,
    ).toMatchObject({
      proposalId: expect.any(String),
      roundId: "q3-2026",
    });
  });

  it("keeps the aggregate when the unpaid part cannot be placed", () => {
    const entries: CoinholderLedgerEntry[] = [
      {
        project: "Some wallet",
        grantStatus: "completed",
        isPaid: true,
        amountUsdCents: 100n,
      },
      {
        project: "Some wallet",
        grantStatus: "open",
        isPaid: false,
        amountUsdCents: 200n,
      },
    ];
    const views = coinholderGrantViews(
      {
        grantKey: "Some wallet",
        status: "completed",
        milestoneCount: 2,
        paidCount: 1,
        usdCents: 300n,
      },
      entries,
    );
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ usdCents: 300n, official: null });
  });
});

/** FPF's tab as imported on 2026-10-21: every Q3 grant paid on Oct 16, 2026, the two Unstoppable Wallet grants included. */
const LEDGER_PAID: CoinholderLedgerEntry[] = LEDGER.map((e) =>
  e.grantStatus === "open"
    ? { ...e, grantStatus: "completed", isPaid: true }
    : e,
);

describe("a project name FPF reused for a later grant · after the Q3 2026 payout", () => {
  it("shows Unstoppable Wallet as one completed grant, both payments counted", () => {
    const own = LEDGER_PAID.filter((e) => e.project === "Unstoppable Wallet");
    const views = coinholderGrantViews(
      {
        grantKey: "Unstoppable Wallet",
        status: "completed",
        milestoneCount: own.length,
        paidCount: own.filter((e) => e.isPaid).length,
        usdCents: own.reduce((s, e) => s + (e.amountUsdCents ?? 0n), 0n),
      },
      LEDGER_PAID,
    );
    expect(views).toEqual([
      expect.objectContaining({
        milestoneCount: 2,
        paidCount: 2,
        usdCents: 12_800_000n,
        official: null,
      }),
    ]);
  });

  it("keeps the aggregate even on the older ledger, since no round awaits payment", () => {
    expect(
      coinholderGrantViews(aggregate("Unstoppable Wallet"), LEDGER),
    ).toHaveLength(1);
  });
});

describe("awaitingGrantsMissingFrom", () => {
  const rows = LEDGER.map((e) => ({
    grantKey: e.project!,
    usdCents: e.amountUsdCents,
  }));

  it("named the one Q3 2026 grant FPF's tab did not list while the round awaited payment: Connaugh Zcash Videos", () => {
    expect(beforeQ3Payout.awaitingGrantsMissingFrom(rows)).toEqual([
      expect.objectContaining({ roundLabel: "Q3 2026", proposalId: "55" }),
    ]);
  });

  it("listed every awaiting grant when the tab had none of them", () => {
    const funded = q3.proposals.filter((p) => p.outcome === "funded").length;
    expect(beforeQ3Payout.awaitingGrantsMissingFrom([])).toHaveLength(funded);
  });

  it("names nothing once FPF has reported every closed round paid", () => {
    expect(awaitingGrantsMissingFrom(rows)).toEqual([]);
    expect(awaitingGrantsMissingFrom([])).toEqual([]);
  });
});

describe("ROUNDS issue keys", () => {
  it("links each numbered proposal of a closed round to its own FPF issue", () => {
    for (const round of ROUNDS.filter((r) => r.status === "results")) {
      for (const p of round.proposals.filter((x) => /^\d+$/.test(x.id))) {
        const issues = p.links
          .map((l) => fpfIssueNumber(l.href))
          .filter(Boolean);
        expect(issues, `${round.id} ${p.title}`).toContain(p.id);
      }
    }
  });
});
