import { ACTIVE_CYCLE, roundParam } from "@/lib/coinholder/cycles";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { PROGRAM } from "@/lib/coinholder/program";
import { ResultsView } from "../round-view";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: `Results · ${PROGRAM.officialName} · OpenZcash`,
  description: `Every ${PROGRAM.officialName} round: each proposal's outcome, requested amount and the ZEC voted for each answer.`,
  path: "/coinholders/results",
  card: {
    title: "Results",
    stat: `${ACTIVE_CYCLE.label} · In progress`,
  },
});

/**
 * ?round=<id> picks a round, ?round=all lists every verdict; the active cycle is the default.
 * Ids are matched case-insensitively: old links such as /coinholders/Q1-2026 redirect here as ?round=Q1-2026.
 */
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string | string[] }>;
}) {
  const { round } = await searchParams;
  const id = roundParam(round);
  const selected =
    id === "all" ? "all" : (ROUNDS.find((r) => r.id === id) ?? "pending");
  return <ResultsView selected={selected} />;
}
