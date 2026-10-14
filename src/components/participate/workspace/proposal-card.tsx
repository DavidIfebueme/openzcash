import type { ComponentProps, ReactNode } from "react";
import { ProposalCardHeading } from "./proposal-card-heading";
import { ZcgProposalLabels } from "./zcg-proposal-labels";

type LabelProps = ComponentProps<typeof ZcgProposalLabels>;
type Labels = Omit<LabelProps, "recordId" | "outcome" | "statusOverride"> & (
  | { outcome: NonNullable<LabelProps["outcome"]>; statusOverride?: never }
  | { statusOverride: NonNullable<ReactNode>; outcome?: never }
);

/** All proposal listings use this shell. Data availability never selects another layout. */
export function ProposalCard({ recordId, labels, engagement, actions, children, panel, id, focusable, officialIssue, tour, ...heading }: ComponentProps<typeof ProposalCardHeading> & {
  recordId: string;
  labels: Labels;
  engagement: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
  panel?: ReactNode;
  id?: string;
  focusable?: boolean;
  officialIssue?: number;
  tour?: boolean;
}) {
  return <li className="dao-proposal-row dao-zcg-proposal" data-proposal-card={recordId} data-official-issue={officialIssue} id={id} tabIndex={focusable ? -1 : undefined}>
    <ProposalCardHeading {...heading} />
    <ZcgProposalLabels {...labels} recordId={recordId} />
    {children}
    <div className="dao-proposal-card-footer" data-participate-tour={tour ? "discussion" : undefined}>
      {engagement}
      <div className="dao-zcg-record-actions">{actions}</div>
    </div>
    {panel}
  </li>;
}
