import { publicationDay } from "./publication-policy";

type Entry = {
  id: string; kind: string; at: Date; entityKey: string | null;
  fromVal: string | null; toVal: string | null;
};

/** Publish the final change for each completed day, not provisional reversals. */
export function publishedChangelog<T extends Entry>(entries: T[], now = new Date()): T[] {
  const grouped = new Map<string, T>();
  const today = publicationDay(now);
  for (const entry of [...entries].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (entry.kind !== "zechub_payment" && publicationDay(entry.at) >= today) continue;
    const proposal = entry.kind === "proposal_status" || entry.kind === "proposal_new";
    const key = proposal && entry.entityKey
      ? `${publicationDay(entry.at)}|${entry.entityKey}` : entry.id;
    const first = grouped.get(key);
    grouped.set(key, first ? { ...first, toVal: entry.toVal, at: entry.at } : entry);
  }
  return [...grouped.values()]
    .filter((e) => e.kind !== "proposal_status" || e.fromVal !== e.toVal)
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}
