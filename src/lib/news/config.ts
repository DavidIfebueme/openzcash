/** Public forum topics and new grant submissions; no effect on verdict policy. */
export const NEWS_REFRESH_MS = 5 * 60_000;
export const RELEASE_REFRESH_MS = 60 * 60_000;
/** Just under the feed's cycle, so a repository that failed is read again on the next refresh. */
export const RELEASE_RETRY_MS = NEWS_REFRESH_MS - 60_000;
