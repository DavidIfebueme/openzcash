export const BASE = "/opportunities";
export type ProviderId = "gleyo" | "zec-bounties" | "yukon" | "shielded-labs" | "zodl";
export type OpportunityKind = "Bounty" | "Quest" | "Challenge" | "Test" | "Job";
export type CatalogItem = {
  id: string;
  provider: ProviderId;
  title: string;
  summary: string;
  description: string;
  kind: OpportunityKind;
  category: string;
  organizer: string;
  art: string;
  sourceUrl: string;
  actionUrl: string;
  actionLabel: string;
  rewardLabel: string;
  rewardZec?: number;
  deadline?: string;
  language?: string;
  country?: string;
  location?: string;
  sourceUpdatedAt?: string;
  checkedAt: string;
  status: "Listed" | "Program" | "Careers board";
  steps: string[];
};
export type SourceState = {
  id: ProviderId;
  status: "available" | "partial" | "unavailable" | "curated";
  checkedAt: string;
};
export type Catalog = { items: CatalogItem[]; sources: SourceState[] };
export type Platform = {
  id: ProviderId;
  name: string;
  label: string;
  description: string;
  url: string;
  docs: string;
  art: string;
  logo?: string;
  steps: string[];
};
export const platforms: Platform[] = [
  { id: "gleyo", name: "Gleyo", label: "Quests & communities", description: "Explore communities, complete quests and take part in sprints. Each activity sets its own XP or ZEC rewards.", url: "https://gleyo.app/", docs: "https://gleyo.app/documentation", art: "community", steps: ["Choose a community and read its quest requirements.", "Join and complete the tasks on Gleyo.", "Follow the quest’s review and reward instructions there."] },
  { id: "zec-bounties", name: "ZEC Bounties", label: "Tasks & contributions", description: "Find scoped work, apply to a bounty and deliver it through ZecHub’s platform.", url: "https://bounties.zechub.wiki/", docs: "https://bounties.zechub.wiki/docs/contributors", art: "zechub", logo: "/community-logos/zechub.png", steps: ["Read the bounty, deadline and eligibility on ZEC Bounties.", "Sign in with GitHub and complete the platform’s profile requirements.", "Apply and wait for assignment before starting the work.", "Submit there. Approval and payment are separate steps."] },
  { id: "yukon", name: "Yukon", label: "Research challenges", description: "Explore HashSmash and contribute to public cryptographic research challenges.", url: "https://www.yukon.org/hashsmash", docs: "https://www.yukon.org/hashsmash", art: "hashsmash", steps: ["Read How it works on the HashSmash page.", "Choose a supported hash function and inspect the current results.", "Use Participate on Yukon for the submission requirements and review."] },
  { id: "shielded-labs", name: "Shielded Labs", label: "Testing & careers", description: "Explore Crosslink testing, incentive updates and opportunities to join the team.", url: "https://shieldedlabs.net/", docs: "/ongoing-test/crosslink", art: "crosslink", logo: "/logos/shielded-labs.png", steps: ["Open the relevant testing guide or job description.", "Check the current requirements and instructions.", "Continue with Shielded Labs through the linked source."] },
  { id: "zodl", name: "ZODL", label: "Careers", description: "Find roles with the team building Zcash protocol software and the Zodl wallet.", url: "https://jobs.ashbyhq.com/zodl", docs: "https://jobs.ashbyhq.com/zodl", art: "zodl", logo: "/logos/ecosystem/zodl-lab.png", steps: ["Choose a role on the official careers board.", "Check its location, experience and application requirements.", "Prepare the requested résumé and work links, then apply on that page."] },
];
export const platformFor = (id: ProviderId) => platforms.find((p) => p.id === id)!;
const checkedAt = "2026-11-03T23:50:00.000Z";
export const curatedItems: CatalogItem[] = [
  { id: "gleyo-quests", provider: "gleyo", title: "Find your next quest on Gleyo", summary: "Join a community and explore its quests, tasks and sprints.", description: "Browse Gleyo for the activities currently offered by its communities. Check the reward shown on each quest: XP and ZEC are distinct, and not every quest offers ZEC.", kind: "Quest", category: "Community", organizer: "Gleyo communities", art: "community", sourceUrl: "https://gleyo.app/documentation", actionUrl: "https://gleyo.app/", actionLabel: "Explore Gleyo", rewardLabel: "XP / ZEC · see quest", checkedAt, status: "Program", steps: platformFor("gleyo").steps },
  { id: "zec-bounties-board", provider: "zec-bounties", title: "Explore ZEC Bounties", summary: "Find tasks in design, development, writing and research.", description: "The original board contains the current rules, application requirements and task status. Some bounties are invite-only. Open the source to confirm whether you can apply.", kind: "Bounty", category: "Community", organizer: "ZEC Bounties", art: "zechub", sourceUrl: "https://bounties.zechub.wiki/docs", actionUrl: "https://bounties.zechub.wiki/", actionLabel: "Browse ZEC Bounties", rewardLabel: "ZEC · see bounty", checkedAt, status: "Program", steps: platformFor("zec-bounties").steps },
  { id: "hashsmash", provider: "yukon", title: "HashSmash", summary: "Find cheaper collision attacks on reduced-round hash functions.", description: "Explore the SHA-256, SHA-3 and BLAKE3 challenge tracks and the results on Yukon. Follow the challenge’s own participation and evaluation rules. This listing does not add a separate monthly prize.", kind: "Challenge", category: "Research", organizer: "Yukon", art: "hashsmash", sourceUrl: "https://www.yukon.org/hashsmash", actionUrl: "https://www.yukon.org/hashsmash", actionLabel: "Participate on Yukon", rewardLabel: "Challenge rules on Yukon", checkedAt, status: "Program", steps: platformFor("yukon").steps },
  { id: "crosslink-incentives", provider: "shielded-labs", title: "Crosslink testing & incentives", summary: "Test Crosslink and follow the current incentive program.", description: "Open the Crosslink guide for testing steps, supported releases and incentive updates. Eligibility, allocations and claim windows follow the program’s announcements; this listing does not promise a fixed reward.", kind: "Test", category: "Infrastructure", organizer: "Shielded Labs", art: "crosslink", sourceUrl: "https://forum.zcashcommunity.com/t/crosslink-incentivized-feature-net/55210", actionUrl: "/ongoing-test/crosslink?tab=incentives", actionLabel: "View Crosslink incentives", rewardLabel: "See current incentive rules", checkedAt, status: "Program", steps: ["Read the Incentives tab in the Crosslink guide.", "Follow the Participate checklist using the current test network.", "Check the source announcements for eligibility and claim windows."] },
  { id: "shielded-labs-cryptographer", provider: "shielded-labs", title: "Cryptographer", summary: "Help develop and evaluate Zcash initiatives at Shielded Labs.", description: "Shielded Labs lists a cryptographer opportunity on its jobs page. Open the employer’s listing for the current role requirements and application instructions.", kind: "Job", category: "Research", organizer: "Shielded Labs", art: "security", sourceUrl: "https://shieldedlabs.net/jobs/", actionUrl: "https://shieldedlabs.net/jobs/", actionLabel: "View role at Shielded Labs", rewardLabel: "Compensation at source", checkedAt, status: "Listed", steps: ["Read the complete role on the Shielded Labs jobs page.", "Check the experience and materials requested by the employer.", "Follow its application instructions directly."] },
  { id: "zodl-careers", provider: "zodl", title: "Careers at ZODL", summary: "Explore the team’s current openings on its official careers board.", description: "Choose a role on ZODL’s careers board to see its location, requirements and compensation when disclosed. Openings can change; the employer’s page is the source for current availability.", kind: "Job", category: "Development", organizer: "ZODL", art: "zodl", sourceUrl: "https://jobs.ashbyhq.com/zodl", actionUrl: "https://jobs.ashbyhq.com/zodl", actionLabel: "View ZODL openings", rewardLabel: "Compensation at source", checkedAt, status: "Careers board", steps: platformFor("zodl").steps },
];
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
export function filterCatalog(items: CatalogItem[], params: URLSearchParams) {
  const query = (params.get("q") || "").trim().toLowerCase();
  const type = params.get("type") || "all";
  return items.filter((item) =>
    (type === "all" || item.kind === type || (type === "Task" && item.kind === "Bounty") || (type === "Contest" && item.kind === "Challenge")) &&
    (!params.get("provider") || params.get("provider") === "all" || item.provider === params.get("provider")) &&
    (!params.get("language") || params.get("language") === "all" || item.language === params.get("language")) &&
    (!params.get("country") || params.get("country") === "all" || item.country === params.get("country")) &&
    `${item.title} ${item.summary} ${item.organizer} ${platformFor(item.provider).name}`.toLowerCase().includes(query),
  );
}
