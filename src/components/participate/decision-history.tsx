import { Stat } from "@/components/ui";
import { SectionHeading, SourceNote } from "@/components/workspace";
import {
  DecisionHomes,
} from "@/components/governance/decision-homes";
import { DecisionsTable } from "@/components/governance/decisions-table";
import { readDecisionHistory } from "@/lib/participate/decision-history";

const shortDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "·";

export async function DecisionHistory() {
  const rows = await readDecisionHistory().catch(() => null);
  if (!rows) return <p role="status">Decision history is temporarily unavailable. Please refresh to try again.</p>;
  const count = (outcome: string) =>
    rows.filter((r) => r.outcome === outcome).length;
  const approved = count("Approved");
  const first = rows.at(-1)?.date ?? null;
  const latest = rows[0]?.date ?? null;
  const onLatest = rows.filter((r) => r.date === latest).length;

  return (
    <>
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
        Verdicts and dates come from the official ZCG sheet and reviewed public
        meeting minutes. The October 12 minutes are matched by exact issue and
        forum topic; asynchronous votes keep their earlier dates. Other minutes
        are linked by meeting date. Grant records use title matching.
      </SourceNote>
    </>
  );
}
