import type { ChatEnvironment } from "./deployment";

export const CHAT_PORTAL_ORIGIN = "https://openzcash.org";
export const CHAT_READY_MESSAGE = "openzcash-chat-ready-v1";
export const CHAT_INVITATION_MESSAGE = "openzcash-chat-invitation-v1";

/** Server-selected parent, never taken from the embedding URL or a message. */
export function chatParentOrigin(env: ChatEnvironment = process.env): string {
  if (env.NODE_ENV === "development") return "http://127.0.0.1:4432";
  return CHAT_PORTAL_ORIGIN;
}

export type EmbeddedInvitation = { kind: "invite" | "room"; token: string };

/** The parent can hand over an invitation, but cannot command a session. */
export function embeddedInvitation(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  parent: Window,
  parentOrigin: string,
): EmbeddedInvitation | null {
  if (event.origin !== parentOrigin || event.source !== parent) return null;
  const value: unknown = event.data;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "kind,token,type" ||
      data.type !== CHAT_INVITATION_MESSAGE ||
      (data.kind !== "invite" && data.kind !== "room") ||
      typeof data.token !== "string" || !data.token || data.token.length > 4096) return null;
  return { kind: data.kind, token: data.token };
}
