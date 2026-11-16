export const CALENDAR_FEED_PATH = "/api/feeds/calendar.ics";

export interface SubscribeLinks {
  /** The feed itself, for copying into any calendar app. */
  https: string;
  /** Opens the system calendar (Apple Calendar, Outlook) as a subscription. */
  webcal: string;
  /** Google Calendar's "add by URL" screen, pre-filled. */
  google: string;
}

export function subscribeLinks(siteUrl: string): SubscribeLinks {
  const https = new URL(CALENDAR_FEED_PATH, siteUrl).toString();
  const webcal = https.replace(/^https?:/, "webcal:");
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}
