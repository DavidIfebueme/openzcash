import { describe, expect, it } from "vitest";
import {
  electionCycle,
  electionRecord,
  pollDecisions,
  proposalDecisions,
  sortDecisions,
  upgradeDecisions,
  type ProposalInput,
} from "./decisions";

const proposal = (over: Partial<ProposalInput>): ProposalInput => ({
  id: "1",
  program: "zcg",
  title: "Zcash Flutter Wallet SDK",
  status: "approved",
  decisionDate: "2026-09-14",
  applicantsRaw: "Someone",
  requestedUsdCents: 1_500_000,
  platformLink:
    "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/419",
  ...over,
});

const MEETINGS = [
  {
    meetingDate: "2026-09-14",
    title: "Minutes 9/14/2026",
    url: "https://forum.example/minutes-9-14",
  },
  {
    meetingDate: "2026-08-31",
    title: "Minutes 8/31/2026",
    url: "https://forum.example/minutes-8-31",
  },
];

describe("proposal decisions", () => {
  it("records committee verdicts with the same-day minutes and the resulting grant", () => {
    const [row] = proposalDecisions([proposal({})], MEETINGS, [
      "Zcash Flutter Wallet SDK",
    ]);
    expect(row.process).toBe("committee");
    expect(row.outcome).toBe("Approved");
    expect(row.decidedBy).toBe("ZCG committee");
    expect(row.subjectHref).toBe("/zcg/grant?g=Zcash%20Flutter%20Wallet%20SDK");
    expect(row.detail).toBe("Someone · $15,000 requested");
    expect(row.sources.map((s) => s.label)).toEqual(["Application", "Minutes"]);
  });

  it("links minutes only when a meeting falls on the decision date", () => {
    const [row] = proposalDecisions(
      [proposal({ decisionDate: "2026-09-01" })],
      MEETINGS,
      [],
    );
    expect(row.sources.map((s) => s.label)).toEqual(["Application"]);
    expect(row.subjectHref).toBeNull();
  });

  it("skips undated rows and choices that are not verdicts", () => {
    const rows = proposalDecisions(
      [
        proposal({ id: "a", decisionDate: null }),
        proposal({ id: "b", status: "withdrawn" }),
        proposal({ id: "c", status: "under_review" }),
        proposal({ id: "d", status: "rejected" }),
      ],
      MEETINGS,
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["proposal-d"]);
    expect(rows[0].tone).toBe("rose");
  });

  it("attributes coinholder verdicts to the poll, and vetoes to key-holders", () => {
    const rows = proposalDecisions(
      [
        proposal({ id: "p", program: "coinholder", status: "approved" }),
        proposal({ id: "v", program: "coinholder", status: "vetoed" }),
        proposal({ id: "f", program: "coinholder", status: "filtered" }),
      ],
      MEETINGS,
      [],
    );
    expect(rows.map((r) => [r.decidedBy, r.outcome])).toEqual([
      ["Coinholder poll", "Approved"],
      ["Key-holders", "Vetoed"],
      ["Coinholder poll", "Not considered"],
    ]);
    // Coinholder decisions are never tied to committee minutes.
    for (const r of rows)
      expect(r.sources.map((s) => s.label)).toEqual(["Application"]);
  });
});

describe("other decision bodies", () => {
  const record = [
    { id: "2025-12-zcg", label: "ZCG election December 2025", date: "2025-12-18", seats: 3, ballots: 145, elected: [{ name: "Zerodartz", approvals: 108 }, { name: "Artkor", approvals: 84 }, { name: "Hanh", approvals: 75 }], sources: ["https://siv.org/election/1", "https://forum/x"] },
    { id: "2024-12-zcg", label: "ZCG election December 2024", date: null, seats: 3, ballots: 136, elected: [{ name: "Jason McGee", approvals: 100 }], sources: ["https://helios/x"] },
  ];
  const db = [
    { id: "dec-2024", title: "December 2024 Election", seats: 3, url: "https://zfnd.org/dec-2024", votingCloses: "2025-01-06", resultsBy: null, elected: ["Jason McGee"] },
    { id: "june-2027", title: "June 2027 Election", seats: 2, url: "https://zfnd.org/june-2027", votingCloses: "2027-06-29", resultsBy: "2027-06-29", elected: ["Someone"] },
    { id: "june-2024", title: "June 2024 Election", seats: 2, url: "https://forum/x", votingCloses: null, resultsBy: null, elected: null },
  ];

  it("keeps every election with its tallies, newest first, borrowing a missing date from the table", () => {
    const entries = electionRecord(record, db);
    expect(entries.map((e) => [e.id, e.date, e.dbId])).toEqual([
      ["june-2027", "2027-06-29", "june-2027"],
      ["2025-12-zcg", "2025-12-18", null],
      ["2024-12-zcg", "2025-01-06", "dec-2024"],
    ]);
    expect(entries[1].elected[0]).toEqual({ name: "Zerodartz", approvals: 108 });
    expect(entries[1].ballots).toBe(145);
    expect(entries[1].sources.map((s) => s.label)).toEqual(["Results", "Thread"]);
    // A cycle only the table has keeps its names, without tallies.
    expect(entries[0].elected).toEqual([{ name: "Someone", approvals: null }]);
    expect(entries[0].sources).toEqual([{ label: "Results", href: "https://zfnd.org/june-2027" }]);
  });

  it("keeps an election whose day is unknown under its month", () => {
    const [entry] = electionRecord(
      [{ id: "old", label: "ZCG election December 2024", date: null, month: "2024-12", seats: 3, ballots: 136, elected: [{ name: "A", approvals: 1 }], sources: [] }],
      [],
    );
    expect([entry.date, entry.month]).toEqual([null, "2024-12"]);
  });

  it("reads the election cycle from a label or a date", () => {
    expect(electionCycle("ZCG election June 2024")).toBe("2024-06");
    expect(electionCycle("December 2024 Election")).toBe("2024-12");
    expect(electionCycle("Inaugural committee", "2020-09-18")).toBe("2020-09");
  });

  it("labels polls by what they could decide, and skips tool tests", () => {
    const base = { informal: false, quorum: null, verifiable: "yes", scope: "network" as const, sources: ["https://forum/r"] };
    const rows = pollDecisions([
      { ...base, id: "nu7", name: "NU7 Scope coinholder vote", status: "closed_results_published", kind: "protocol_scope", date: "2026-09-14", totalZec: 2403537, outcome: "Preserve halvings." },
      { ...base, id: "feat", name: "Feature sentiment", status: "closed", kind: "sentiment", date: "2026-02-20", totalZec: null, outcome: null },
      { ...base, id: "q3", name: "Q3 round", status: "open", kind: "grant_decision", date: "2026-09-29", totalZec: null, outcome: null },
      { ...base, id: "q2", name: "Q2 round", status: "postponed_merged_into_q3", kind: "grant_decision", date: "2026-06-11", totalZec: null, outcome: "Postponed." },
      { ...base, id: "t", name: "Test", status: "closed", kind: "test", date: "2025-04-05", totalZec: 1, outcome: null },
      { ...base, id: "straw", name: "Straw poll", status: "closed_no_official_tally", informal: true, kind: "sentiment", date: "2019-08-02", totalZec: null, outcome: null },
    ]);
    expect(rows.map((r) => [r.id, r.outcome, r.decidedBy])).toEqual([
      ["poll-nu7", "Decided", "Coin-weighted poll"],
      ["poll-feat", "Advisory", "Coin-weighted poll"],
      ["poll-q3", "Voting open", "Coin-weighted poll"],
      ["poll-q2", "Postponed", "Poll organizers"],
      ["poll-straw", "Informal", "Coin-weighted poll"],
    ]);
    expect(rows[0].detail).toBe("Preserve halvings. · 2.4M ZEC voted");
  });

  it("reads a poll's total as the most-voted question when it asked several", () => {
    const base = { informal: false, quorum: null, verifiable: "yes", status: "closed", outcome: null, sources: [], date: "2025-11-25" };
    const rows = pollDecisions([
      { ...base, id: "round", name: "Q4 round", kind: "grant_decision", scope: "fund" as const, totalZec: 1232440, questions: 9 },
      { ...base, id: "sentiment", name: "Feature poll", kind: "sentiment", scope: "network" as const, totalZec: 1235710, questions: 11 },
      { ...base, id: "runoff", name: "Runoff", kind: "funding_model", scope: "network" as const, totalZec: 300854, questions: 1 },
    ]);
    expect(rows.map((r) => r.detail)).toEqual([
      "up to 1.23M ZEC per proposal",
      "up to 1.24M ZEC per question",
      "300.85K ZEC voted",
    ]);
  });

  it("splits polls between the coinholder fund and the whole network", () => {
    const base = { informal: false, quorum: null, verifiable: "yes", status: "closed", totalZec: null, outcome: null, sources: [] };
    const polls = [
      { ...base, id: "q1", name: "Q1 2026 round", kind: "grant_decision", scope: "fund" as const, date: "2026-04-01" },
      { ...base, id: "ratify", name: "Ratify the program", kind: "funding_model", scope: "fund" as const, date: "2025-09-03" },
      { ...base, id: "nu7", name: "NU7 scope", kind: "protocol_scope", scope: "network" as const, date: "2026-09-14" },
    ];
    expect(pollDecisions(polls, "fund").map((r) => r.id)).toEqual(["poll-q1", "poll-ratify"]);
    expect(pollDecisions(polls, "network").map((r) => r.id)).toEqual(["poll-nu7"]);
    expect(pollDecisions(polls)).toHaveLength(3);
  });

  it("files every poll in the published record under one home", async () => {
    const data = (await import("@/data/governance/record.json")).default as unknown as {
      polls: { id: string; scope?: string }[];
    };
    for (const p of data.polls) expect(["fund", "network"], p.id).toContain(p.scope);
  });

  it("dates network upgrades and sorts everything newest first", () => {
    const upgrades = upgradeDecisions([
      { name: "nu6.3", label: "NU6.3 · Ironwood", height: 3_428_143, date: "2026-07-28", decidedBy: "Joint emergency proposal, no poll", zips: [258, 229], sources: [] },
    ]);
    const sorted = sortDecisions([
      ...upgrades,
      ...proposalDecisions([proposal({ decisionDate: "2026-07-28" }), proposal({ id: "2", decisionDate: "2026-09-14" })], MEETINGS, []),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["proposal-2", "upgrade-nu6.3", "proposal-1"]);
    expect(upgrades[0].detail).toBe("Block 3,428,143 · ZIP 258, 229");
  });
});
