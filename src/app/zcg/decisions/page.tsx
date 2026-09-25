import { PageHeader, Stat } from "@/components/ui";
import { SectionHeading, SourceNote } from "@/components/workspace";
import {
  DecidedBy,
  DecisionHomes,
} from "@/components/governance/decision-homes";
import { DecisionsTable } from "@/components/governance/decisions-table";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { listProposals } from "@/lib/zcg/proposals-repo";
import { getMeetings } from "@/lib/zcg/governance-repo";
import { listGrants } from "@/lib/zcg/grants-repo";
import { proposalDecisions, sortDecisions } from "@/lib/governance/decisions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Decisions · ZCG · OpenZcash",
  description:
    "Every verdict the Zcash Community Grants committee has taken on a grant proposal, dated, with the minutes of that day and the grant it created.",
};

const shortDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "·";

export default async function ZcgDecisionsPage() {
  const [proposals, meetings, grants] = await Promise.all([
    cached("listProposals:all", LEDGER_TTL_MS, () => listProposals({})).catch(
      () => [],
    ),
    getMeetings().catch(() => []),
    cached("grants:list", LEDGER_TTL_MS, () => listGrants()).catch(() => []),
  ]);

  const rows = sortDecisions(
    proposalDecisions(
      proposals,
      meetings,
      grants.map((g) => g.grantKey),
    ).filter((r) => r.process === "committee"),
  );
  const count = (outcome: string) =>
    rows.filter((r) => r.outcome === outcome).length;
  const approved = count("Approved");
  const first = rows.at(-1)?.date ?? null;
  const latest = rows[0]?.date ?? null;
  const onLatest = rows.filter((r) => r.date === latest).length;

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle="Every verdict the ZCG committee has taken on a grant proposal, dated by the ZCG sheet under the site's D-1 publication rule, with the minutes of that day and the grant it created."
        actions={<DecidedBy who="ZCG committee" how="elected by ZCAP" />}
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Verdicts"
          value={rows.length.toLocaleString("en-US")}
          sub={`since ${shortDate(first)}`}
        />
        <Stat
          label="Approved"
          value={approved.toLocaleString("en-US")}
          sub={
            rows.length
              ? `${Math.round((approved / rows.length) * 100)}% of verdicts`
              : "·"
          }
        />
        <Stat
          label="Rejected"
          value={count("Rejected").toLocaleString("en-US")}
          sub={`${count("Filtered")} more filtered`}
        />
        <Stat
          label="Latest verdict"
          value={shortDate(latest)}
          sub={`${onLatest} ${onLatest === 1 ? "verdict" : "verdicts"} that day`}
        />
      </section>

      <SectionHeading
        title="Every verdict"
        count={rows.length}
        description="Filter by outcome or search a proposal; export the view as CSV."
      />
      <DecisionsTable
        rows={rows}
        csvName="zcg-committee-verdicts.csv"
        hide={["process", "decidedBy"]}
      />

      <DecisionHomes current="committee" />

      <SourceNote>
        Verdicts and dates come from the official ZCG sheet. Minutes are linked
        when a committee meeting falls on the decision day. A verdict links to
        the grant it created when the titles match.
      </SourceNote>
    </>
  );
}
