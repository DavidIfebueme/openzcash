import Link from "next/link";
import { DecisionHistory } from "@/components/participate/decision-history";
import { Participate } from "@/components/participate/participate";
import { CommitteeWorkspacePanel } from "@/components/participate/workspace/committee-workspace";
import {
  WorkspaceFrame,
  type WorkspaceViewer,
} from "@/components/participate/workspace/community-workspace";
import { ParticipateBridge } from "@/components/participate/workspace/participate-bridge";
import { ParticipateHistory } from "@/components/participate/workspace/participate-history";
import { ParticipateProposalForm } from "@/components/participate/workspace/participate-proposal-form";
import { ProposalWorkspace } from "@/components/participate/workspace/proposal-workspace";
import { WorkspaceThemeProvider } from "@/components/participate/workspace/workspace-theme";
import "@/components/participate/workspace/workspace.css";
import "@/components/participate/workspace/native.css";
import styles from "@/components/participate/participate.module.css";
import {
  PARTICIPATE_PATH,
  participationCommunityId,
  participationView,
} from "@/lib/participate/config";
import { initialOfficialProposals } from "@/lib/participate/official-proposals";
import { initialApprovedBudgets } from "@/lib/participate/approved-budgets";
import { readDecisionHistory } from "@/lib/participate/decision-history";
import {
  readBoard,
  readCommitteeWorkspace,
  readDrafts,
  readProfile,
} from "@/lib/participate/service";
import { readViewerContext } from "@/lib/participate/viewer";
import type { CommitteeWorkspace } from "@/lib/participate/workspace/domain/committee";
import {
  historyResponseSchema,
  type HistoryRecord,
} from "@/lib/participate/workspace/domain/participate-history";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Participate · ZCG · OpenZcash",
  description:
    "An independent participation pilot: explore ZCG proposals, discuss ideas and build a verifiable history. Designed to grow into community governance on Zcash.",
  path: PARTICIPATE_PATH,
});

type Search = {
  compose?: string;
  record?: string;
  comment?: string;
  view?: string;
};
const COMMUNITY_NAME = "ZCG";
const COMMITTEE_HREF = `${PARTICIPATE_PATH}?view=committee`;

/** The workspace's history view reads the portal's own committee register directly. */
async function readHistory(): Promise<{
  rows: HistoryRecord[];
  origin: string;
} | null> {
  try {
    const rows = await readDecisionHistory();
    return {
      rows: historyResponseSchema.parse({ version: 1, rows }).rows,
      origin: "",
    };
  } catch {
    return null;
  }
}

/** The header's Committee entry follows the access the service grants this visitor. */
function committeeEntry(
  committee: CommitteeWorkspace | null,
): WorkspaceViewer["committeeEntry"] {
  if (!committee) return undefined;
  if (committee.access === "MEMBER")
    return {
      label: committee.role ? "Committee workspace" : "Committee preview",
      href: COMMITTEE_HREF,
    };
  if (
    committee.invitations?.some(
      (invite) => invite.mine && invite.state === "PENDING",
    )
  )
    return { label: "Committee invitation", href: COMMITTEE_HREF };
  return undefined;
}

export default async function ParticipatePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const view = participationView(search.view);
  const context = await readViewerContext();

  if (!context.configured) {
    return (
      <Participate view={view} configured={false}>
        {view === "history" ? (
          <section className={styles.history} aria-label="ZCG decision history">
            <DecisionHistory />
          </section>
        ) : (
          <section className={styles.connection}>
            <p>
              The interactive workspace is being prepared. Decision history is
              available now.
            </p>
            <Link
              href={`${PARTICIPATE_PATH}?view=history`}
              className={styles.primary}
            >
              View decision history →
            </Link>
          </section>
        )}
      </Participate>
    );
  }

  const communityId = participationCommunityId();
  const { session, cookie } = context;
  const admin =
    session?.role === "ADMIN" && !session.userId.startsWith("preview_");
  const composing = view === "proposals" && Boolean(search.compose);
  // One session read, then every other service read in parallel: a restarting
  // service costs a single timeout, not one per request.
  const [profile, board, drafts, history, committee, budgets, officialProposals] = await Promise.all([
    session ? readProfile(cookie) : Promise.resolve(null),
    readBoard(session ? cookie : null),
    session && view === "proposals"
      ? readDrafts(cookie)
      : Promise.resolve(null),
    view === "history" ? readHistory() : Promise.resolve(null),
    // Every signed-in visitor: members and invitees need the header entry too.
    view === "committee" || session
      ? readCommitteeWorkspace(cookie)
      : Promise.resolve(null),
    view === "proposals" && !composing ? initialApprovedBudgets() : Promise.resolve(null),
    view === "proposals" && !composing ? initialOfficialProposals() : Promise.resolve(null),
  ]);
  // A failed draft read is not proof that a draft does not exist.
  const draftsUnavailable =
    Boolean(session) && view === "proposals" && drafts === null;
  const community = {
    id: communityId,
    name: COMMUNITY_NAME,
    slug: communityId,
  };
  const viewer: WorkspaceViewer | null = session
    ? {
        nick: session.nick,
        role: "VISITOR",
        canEditProfile: true,
        canPreviewCommittee: admin,
        canModeratePilot: admin,
        committeeEntry: committeeEntry(committee),
      }
    : null;
  const participation = board?.participation ?? null;
  const initialCreditSummary =
    session &&
    participation?.creditScope &&
    participation.availableCredits != null
      ? {
          communityId: participation.creditScope.id,
          communityName: participation.creditScope.name,
          kind: participation.creditScope.kind,
          balance: participation.availableCredits,
          mode: participation.mode,
          commentCost: participation.commentCost,
          reactionCost: participation.reactionCost,
          sandbox: participation.sandbox,
          paymentReview: participation.paymentReview ?? false,
        }
      : null;
  const frame = {
    community,
    communities: [community],
    viewer,
    workspaceModule: "proposals" as const,
    creditScope: participation?.creditScope,
    initialProfile: profile,
    initialCreditSummary,
  };
  const retryHref = `${PARTICIPATE_PATH}${search.compose ? `?compose=${encodeURIComponent(search.compose)}` : ""}`;

  let content;
  if (view === "history") {
    content = (
      <WorkspaceFrame {...frame} embedded embeddedSection="history">
        <ParticipateHistory data={history} />
      </WorkspaceFrame>
    );
  } else if (view === "committee") {
    content = (
      <WorkspaceFrame {...frame} embedded embeddedSection="committee">
        {committee ? (
          <CommitteeWorkspacePanel
            key={session?.userId ?? "guest"}
            initial={committee}
          />
        ) : (
          <div className="dao-empty-state" role="alert">
            <p>The committee workspace is temporarily unavailable.</p>
            <a className="dao-button" href={COMMITTEE_HREF}>
              Try again
            </a>
          </div>
        )}
      </WorkspaceFrame>
    );
  } else if (composing && search.compose !== "new" && draftsUnavailable) {
    content = (
      <WorkspaceFrame {...frame} embedded>
        <div className="dao-empty-state" role="alert">
          <h1>Drafts temporarily unavailable</h1>
          <p>
            Your saved drafts could not be loaded. Nothing was lost; try again
            in a moment.
          </p>
          <a className="dao-button" href={retryHref}>
            Try again
          </a>
        </div>
      </WorkspaceFrame>
    );
  } else if (composing) {
    const initial = (drafts ?? []).find((draft) => draft.id === search.compose);
    content = (
      <WorkspaceFrame {...frame} embedded>
        {search.compose !== "new" && !initial ? (
          <div className="dao-empty-state">
            <h1>Draft unavailable</h1>
            <p>Sign in with its author’s account to open it.</p>
            <Link className="dao-button" href={PARTICIPATE_PATH}>
              Back to proposals
            </Link>
          </div>
        ) : (
          <ParticipateProposalForm
            key={search.compose}
            initial={initial}
            drafts={drafts ?? []}
            signedIn={Boolean(session)}
            sandbox={participation?.sandbox ?? false}
            balance={participation?.availableCredits ?? null}
            communityId={communityId}
            creditScopeId={participation?.creditScope?.id ?? ""}
          />
        )}
      </WorkspaceFrame>
    );
  } else if (!board) {
    content = (
      <WorkspaceFrame {...frame} embedded>
        <div className="dao-empty-state" role="alert">
          <p>Proposals are temporarily unavailable.</p>
          <a className="dao-button" href={PARTICIPATE_PATH}>
            Try again
          </a>
        </div>
      </WorkspaceFrame>
    );
  } else {
    content = (
      <ProposalWorkspace
        key={`${search.record ?? "board"}:${search.comment ?? ""}`}
        embedded
        community={community}
        communities={[community]}
        viewer={viewer}
        board={board}
        initialBudgets={budgets}
        initialOfficialProposals={officialProposals}
        initialProfile={profile}
        initialCreditSummary={initialCreditSummary}
        drafts={drafts ?? []}
        draftsUnavailable={draftsUnavailable}
        initialRecordId={search.record}
        initialCommentId={search.comment}
      />
    );
  }

  return (
    <Participate view={view} configured>
      <div className="oz-participate">
        <WorkspaceThemeProvider>
          <ParticipateBridge>{content}</ParticipateBridge>
        </WorkspaceThemeProvider>
      </div>
    </Participate>
  );
}
