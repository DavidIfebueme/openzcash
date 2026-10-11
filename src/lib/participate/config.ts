/** The browser only receives a path on OpenZcash, never the private service origin. */
export const participationService = (configured: boolean) => configured ? { url: "/participate" } : null;

export function isParticipationReadyMessage(data: unknown): boolean {
  return typeof data === "object" && data !== null
    && (data as Record<string, unknown>).type === "participate:ready"
    && (data as Record<string, unknown>).version === 1;
}

/** Appearance is the only workspace preference shared with the host. */
export function participationThemeMessage(data: unknown): "light" | "dark" | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== "participate:theme" || message.version !== 1) return null;
  return message.theme === "light" || message.theme === "dark" ? message.theme : null;
}

export type ParticipationView = "proposals" | "history" | "committee";

/** Fixed destinations only. Committee authorization still belongs to the service. */
export function participationWorkspaceUrl(url: string, view: ParticipationView) {
  if (view === "history") return `${url}?view=history`;
  if (view === "committee") return `${url}/committee`;
  return url;
}

/** The frame can select these views, never supply a URL or an account action. */
export function participationViewMessage(data: unknown): ParticipationView | "about" | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== "participate:view" || message.version !== 1) return null;
  return ["proposals", "history", "committee", "about"].includes(message.view as string) ? message.view as ParticipationView | "about" : null;
}
