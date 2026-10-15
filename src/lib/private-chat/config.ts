/** Preview stays local; the deployable pilot requires separate server validation. */
export const PRIVATE_CHAT_PREVIEW_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW === "true";
export const PRIVATE_CHAT_ENABLED = PRIVATE_CHAT_PREVIEW_ENABLED ||
  process.env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT === "true";
