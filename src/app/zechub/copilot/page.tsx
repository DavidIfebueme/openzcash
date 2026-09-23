import { CopilotPage } from "@/components/copilot/copilot-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ZecHub Copilot · OpenZcash",
  description:
    "Research ZecHub DAO votes and treasury records in your AI assistant. Start without installation, save instructions, or add an optional agent skill.",
};

const USE_CASES = [
  {
    q: "Did proposal A116 pass? It had twice as many yes as no.",
    a: "Check the proposal's recorded outcome and compute quorum and approval separately using its own voting rules.",
  },
  {
    q: "What is ZecHub voting on right now?",
    a: "Find open proposals, read their tallies and voting rules, and distinguish current support from a final outcome.",
  },
  {
    q: "How much can ZecHub actually spend?",
    a: "Separate the three treasury pots, reserved amounts, and recorded unreserved funds. Preserve the snapshot date.",
  },
  {
    q: "What has ZecHub paid contributors?",
    a: "Reconcile recorded payout rows with the sheet's total, flag missing amounts, and keep commitments separate from payments.",
  },
];

const SOURCES = [
  {
    name: "DAO indexer",
    desc: "Public proposals, votes, and members from the ZecHub DAO on Juno, with pagination and proposal-specific voting rules.",
  },
  {
    name: "Juno LCD",
    desc: "What a proposal actually executes on-chain. Membership changes are invisible without it: the indexer returns no messages.",
  },
  {
    name: "Treasury mirror",
    desc: "The three pots, allocations and payouts, refreshed on a 6h cycle with the ZEC price used at snapshot time.",
  },
  {
    name: "ZCG ledger",
    desc: "The other direction of the money: what Zcash Community Grants has paid ZecHub itself.",
  },
];

export default function ZecHubCopilotPage() {
  return (
    <CopilotPage
      title="ZecHub Copilot"
      subtitle="Explore DAO votes, treasury records and governance thresholds."
      skill="zechub-copilot"
      intro={
        <>
          Explore ZecHub DAO decisions and treasury records with your own AI
          assistant. Understand voting rules, trace contributor funding, and
          check each finding against dated public sources.
        </>
      }
      examples={USE_CASES}
      sources={SOURCES}
      note={
        <>
          The skill encodes the traps that produce wrong answers: abstentions
          that carry quorum without diluting the threshold, <code>closed</code>{" "}
          and <code>rejected</code> both meaning defeat, milestones marked
          complete next to money still pending, a member count that is
          snapshotted per proposal, and the difference between what the DAO
          holds on-chain and what ZecHub can actually spend. It is read-only and
          never submits or votes.
        </>
      }
    />
  );
}
