import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  proposals: [] as Record<string, unknown>[],
  applications: [] as Record<string, unknown>[],
  decisions: new Map<number, string>(),
  missing: new Set<number>(),
}));

vi.mock("@/lib/zcg/proposals-repo", () => ({
  listProposals: async () => state.proposals,
  proposalsFunnel: async () => ({
    total: state.proposals.length,
    byStatus: ["approved", "rejected", "under_review", "pending"].map((status) => ({
      status,
      count: state.proposals.filter((p) => p.status === status).length,
    })),
  }),
}));
vi.mock("@/lib/auth/admin", () => ({ getIsAdmin: async () => false }));
vi.mock("@/lib/zcg/governance-repo", () => ({ getLinks: async () => ({}) }));
vi.mock("@/lib/cache/memo", () => ({
  LEDGER_TTL_MS: 1,
  cached: async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
}));
vi.mock("@/lib/zcg/github-applications", () => ({
  getGrantApplications: async () => state.applications,
  ZCG_APPLICATIONS_REPO_URL: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants",
}));
vi.mock("@/lib/zcg/diligence", () => ({ getDiligence: () => new Map() }));
vi.mock("@/lib/zcg/issue-amounts", () => ({
  getIssueAmounts: () => new Map(),
  getIssueDecisions: () => state.decisions,
  getMissingIssues: () => state.missing,
}));
vi.mock("@/components/synced", () => ({ Synced: () => null }));
vi.mock("./proposals-table", () => ({ ProposalsTable: () => null }));

import Page from "./page";
import { ProposalsTable } from "./proposals-table";
import { Stat } from "@/components/ui";

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...elements(child.props.children as ReactNode)];
  });
}

async function page(status?: string) {
  const nodes = elements(await Page({ searchParams: Promise.resolve({ status }) }));
  return {
    rows: nodes.find((n) => n.type === ProposalsTable)?.props.rows as Record<string, unknown>[],
    total: nodes.find((n) => n.type === Stat && n.props.label === "Proposals")?.props.value,
    approved: nodes.find((n) => n.type === Stat && n.props.label === "Approved")?.props.value,
  };
}

beforeEach(() => {
  state.proposals = Array.from({ length: 450 }, (_, index) => ({
    id: `proposal-${index}`,
    title: `Archive proposal ${index}`,
    program: "zcg",
    status: index >= 400 ? "approved" : "rejected",
    submittedDate: "2022-01-01",
    platformLink: null,
  }));
  state.applications = [];
  state.decisions.clear();
  state.missing.clear();
});

describe("complete proposal history", () => {
  it("makes proposals beyond the first 400 available to table search", async () => {
    const result = await page();
    expect(result.rows).toHaveLength(450);
    expect(result.rows.at(-1)?.title).toBe("Archive proposal 449");
    expect(result.total).toBe("450");
  });

  it("filters the full history and agrees with the approved count", async () => {
    const result = await page("approved");
    expect(result.rows).toHaveLength(50);
    expect(result.approved).toBe(String(result.rows.length));
  });

  it("preserves program identity instead of attaching a ZCG issue to Coinholder", async () => {
    state.proposals = [{
      id: "coinholder-1", title: "Shared project title", program: "coinholder",
      status: "pending", submittedDate: "2026-08-01",
      platformLink: "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/999",
    }];
    state.applications = [{
      number: 900, title: "Shared project title", status: "review", applicant: "example",
      url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900",
      createdAt: "2026-09-01T00:00:00Z", amountUsd: 500,
    }];
    const result = await page();
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.id === "coinholder-1")).toMatchObject({
      program: "coinholder", status: "pending", source: "sheet",
    });
    expect(result.rows.find((r) => r.id === "gh-900")).toMatchObject({
      program: "zcg", status: "under_review",
    });
  });

  it("shows FPF's official verdict for a closed coinholder round the sheet still lists as pending", async () => {
    state.proposals = [{
      id: "coinholder-55", title: "Connaugh Zcash Videos", program: "coinholder",
      status: "pending", submittedDate: "2026-08-14",
      platformLink: "https://github.com/Financial-Privacy-Foundation/ZcashCoinholderGrantsProgram/issues/55",
    }];
    const result = await page();
    expect(result.rows[0]).toMatchObject({ status: "approved", statusLabel: "Approved", source: "sheet" });
    expect(result.approved).toBe("1");
  });

  it("does not merge a resubmission into a different historical issue", async () => {
    state.proposals = [{
      id: "old", title: "Shared project title", program: "zcg", status: "rejected",
      platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/8",
    }];
    state.applications = [{
      number: 900, title: "Shared project title", status: "review", applicant: "example",
      url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900",
      createdAt: "2026-09-01T00:00:00Z",
    }];
    const result = await page();
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.id === "old")?.platformLink).toContain("/issues/8");
  });

  it("reconciles an exact issue beyond row 400 even after its title changes", async () => {
    state.proposals[449].platformLink = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900";
    state.applications = [{
      number: 900, title: "Renamed application", status: "review",
      url: state.proposals[449].platformLink, createdAt: "2026-09-01T00:00:00Z",
    }];
    const result = await page();
    expect(result.rows).toHaveLength(450);
    expect(result.rows.find((r) => r.id === "proposal-449")).toMatchObject({
      status: "approved", source: "github",
    });
  });

  it("counts reconciled GitHub decisions from the same rows used by filters", async () => {
    state.proposals[449].status = "under_review";
    state.proposals[449].platformLink = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/900";
    state.decisions.set(900, "approved");
    const result = await page("approved");
    expect(result.rows).toHaveLength(50);
    expect(result.approved).toBe("50");
    expect(result.total).toBe("450");
  });
});
