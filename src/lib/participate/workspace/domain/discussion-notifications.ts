type NotificationBase = {
  id: string;
  proposalTitle: string;
  recordId: string;
  createdAt: string;
  read: boolean;
};

export type DiscussionNotificationItem = NotificationBase & ({
  kind: "COMMENT_LIKED" | "COMMENT_REPLIED";
  actorLabel: string;
  actorAvatarUrl: string | null;
  excerpt: string;
  commentId: string;
} | {
  kind: "PROPOSAL_ARRIVED";
  actorLabel: null;
  actorAvatarUrl: null;
  excerpt: string;
  commentId: null;
});

export type DiscussionInbox = {
  items: DiscussionNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
  asOf: string;
};

export type CommentDestination = { communityId: string; recordId: string; commentId: string };
export const OPEN_COMMENT_EVENT = "participate:open-comment";

export type CommitteeReviewDestination = { communityId: string; recordId: string };
export const OPEN_REVIEW_EVENT = "participate:open-committee-review";
