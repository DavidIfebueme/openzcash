/** Public policy shared by the server and citation renderer. Account links checked 2026-11-03. */
export const X_RESEARCH_ACCOUNTS = [
  { handle: "ZakuraZcash", source: "https://zakura.com/about/" },
  { handle: "ShieldedLabs", source: "https://github.com/shieldedlabs" },
  { handle: "zodl_co", source: "https://support.zodl.com/article/14-how-do-i-obtain-support-for-zodl" },
  { handle: "zodl_app", source: "https://support.zodl.com/article/14-how-do-i-obtain-support-for-zodl" },
  { handle: "ZcashLabs", source: "https://zcashlabs.org/" },
  { handle: "ZcashFoundation", source: "https://github.com/ZcashFoundation" },
  { handle: "TachyonZcash", source: "https://tachyon.z.cash/" },
  { handle: "qeditzkp", source: "https://qed-it.com/" },
  { handle: "zcash", source: "https://z.cash/" },
  { handle: "ZcashCommGrants", source: "https://zcashcommunitygrants.org/" },
  { handle: "zechub", source: "https://openzcash.org/communities" },
  { handle: "zcashbrazil", source: "https://openzcash.org/communities" },
  { handle: "zcashesp1", source: "https://openzcash.org/communities" },
] as const;
export const X_RESEARCH_TOPICS = ["bounties", "grants", "releases", "events", "news"] as const;
export type XResearchTopic = typeof X_RESEARCH_TOPICS[number];
export const X_RESEARCH_WINDOW_DAYS = 30;
export const X_RESEARCH_CACHE_MS = 30 * 60_000;
/** Post links only, from reviewed accounts. No profiles, redirects, private messages or arbitrary hosts. */
export function safeXPostUrl(raw: string): string | null {
  if (raw.length > 250 || /[\\\s]/u.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(url.hostname)) return null;
    const match = /^\/([a-zA-Z0-9_]{1,15})\/status\/([1-9]\d{14,19})\/?$/.exec(url.pathname);
    const account = match && X_RESEARCH_ACCOUNTS.find(({ handle }) => handle.toLowerCase() === match[1].toLowerCase());
    return account && match ? `https://x.com/${account.handle}/status/${match[2]}` : null;
  } catch { return null; }
}
