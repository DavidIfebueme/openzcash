import { BASE, type CatalogItem, curatedItems } from "./catalog";
export function opportunityRoute(segments: string[] = [], items: CatalogItem[] = curatedItems): { title: string; description: string; path: string } | null {
  const path = BASE + (segments.length ? "/" + segments.join("/") : "");
  const description = "Discover Zcash bounties, quests, jobs, research challenges and testing programs. Prepare artwork and a brief, then continue on the source platform.";
  if (!segments.length) return { title: "Zcash Opportunities · Beta", description, path };
  if (segments.length === 1) {
    const title: Record<string, string> = { prepare: "Prepare an activity", platforms: "Opportunity platforms", art: "Zcash art library" };
    return title[segments[0]] ? { title: title[segments[0]], description, path } : null;
  }
  if (segments.length !== 2 || segments[0] !== "tasks") return null;
  const item = items.find((o) => o.id === segments[1]);
  if (item) return { title: item.title, description: item.summary, path };
  // Stable source IDs keep previously shared bounty links useful after removal.
  if (/^zec-[a-zA-Z0-9_-]{1,100}$/.test(segments[1])) return { title: "Opportunity at source", description, path };
  return null;
}
export function legacyOpportunityRedirect(segments: string[]): string | null {
  const route = segments.join("/");
  if (route === "new" || route === "campaigns/new") return BASE + "/prepare";
  if (segments[0] === "communities" || segments[0] === "campaigns") return BASE + "/platforms";
  if (route === "tasks/hashsmash-november") return BASE + "/tasks/hashsmash";
  if (route === "tasks/test-crosslink") return BASE + "/tasks/crosslink-incentives";
  const retired = new Set(["integrate-zero-indexer", "0xramp-pay-brasil", "run-zebra", "run-zakura", "payment-links", "privacy-stories", "portuguese-guide", "first-payment", "weekend-build", "wallet-research", "zodl-wallet-test", "zingo-wallet-test", "ywallet-wallet-test", "zkool-wallet-test", "cake-wallet-test", "edge-wallet-test", "unstoppable-wallet-test", "brave-wallet-test", "vizor-wallet-test", "zcash-explainer", "zero-stack-workshop", "community-meetup-kit", "zcash-short-film", "zero-privacy-check", "community-welcome-kit"]);
  return segments.length === 2 && segments[0] === "tasks" && retired.has(segments[1]) ? BASE : null;
}
