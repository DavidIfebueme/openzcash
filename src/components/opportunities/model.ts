import { opportunities as examples, communities as groups } from "./data";
import { isCover, resolveCover } from "./covers";
import {
  normalizeLanguage,
  normalizeCountry,
  validLanguage,
  validCountry,
} from "./locales";
import { showcaseOpportunities } from "./showcase";
import { betaReward, betaPrizes } from "./beta";

export const BASE = "/opportunities";
export const categories = [
  "Development",
  "Content",
  "Design",
  "Translation",
  "Research",
  "Wallets",
  "Education",
  "Community",
  "Events",
  "Testing",
];
export type Organizer = {
  id: string;
  name: string;
  mark: string;
  color: string;
  description: string;
  owner?: string;
};
export type Campaign = {
  id: string;
  title: string;
  description: string;
  organizer: string;
  kind: "Campaign" | "Hackathon";
  deadline: string;
  owner?: string;
  art: string;
};
export type Opportunity = Omit<(typeof examples)[number], "type"> & {
  type: "Task" | "Contest";
  owner?: string;
  prizes: number[];
  reviewDays: number;
  deliveryDays: number;
  funding: "Pledged" | "Example";
};
export type Draft = {
  id: string;
  title: string;
  type: "Task" | "Contest";
  category: string;
  organizer: string;
  campaign: string;
  description: string;
  deliverables: string;
  criteria: string;
  reward: string;
  prizes: string[];
  deadline: string;
  reviewDays: string;
  deliveryDays: string;
  step: number;
  art?: string;
  language: string;
  country: string;
};
export type Contribution = {
  id: string;
  opportunityId: string;
  message: string;
  url: string;
  kind: string;
  stage?: "Applied" | "Submitted";
};
export type Profile = { id: string; name: string };
export const sampleOrganizers: Organizer[] = groups;
export const sampleCampaigns: Campaign[] = [
  {
    id: "shielded-labs-lab",
    title: "Shielded Labs integration lab",
    description:
      "Community test ideas for Crosslink, zero-indexer and the Zero stack.",
    organizer: "open-builders",
    kind: "Campaign",
    deadline: "2026-11-28",
    art: "crosslink",
  },
  {
    id: "november",
    title: "Build with Zcash",
    description: "Tools, stories, and resources for a more private everyday.",
    organizer: "open-builders",
    kind: "Campaign",
    deadline: "2026-11-25",
    art: "wallet",
  },
  {
    id: "weekend",
    title: "Zcash Builders Weekend",
    description:
      "A weekend for small teams to build a working Zcash prototype.",
    organizer: "open-builders",
    kind: "Hackathon",
    deadline: "2026-11-29",
    art: "code",
  },
];
const exampleBudgets: Record<string, number> = {
  "test-crosslink": 96,
  "integrate-zero-indexer": 98,
  "0xramp-pay-brasil": 28,
  "hashsmash-november": 95,
  "run-zebra": 48,
  "run-zakura": 52,
  "payment-links": 75,
  "privacy-stories": 44,
  "portuguese-guide": 32,
  "first-payment": 68,
  "weekend-build": 90,
  "wallet-research": 24,
  "zodl-wallet-test": 27,
  "zingo-wallet-test": 38,
  "ywallet-wallet-test": 29,
  "zkool-wallet-test": 26,
  "cake-wallet-test": 31,
  "edge-wallet-test": 23,
  "unstoppable-wallet-test": 22,
  "brave-wallet-test": 34,
  "vizor-wallet-test": 36,
  "zcash-explainer": 25,
  "zero-stack-workshop": 72,
  "community-meetup-kit": 35,
  "zcash-short-film": 42,
  "zero-privacy-check": 58,
  "community-welcome-kit": 18,
};
// The layout randomizes all examples equally for each new visit.
const orderedExamples = [
  ...showcaseOpportunities.slice(0, 2),
  ...examples,
  ...showcaseOpportunities.slice(2),
];
export const sampleOpportunities: Opportunity[] = orderedExamples.map((o) => {
  const reward = betaReward(exampleBudgets[o.id]);
  return {
    ...o,
    reward,
    applicants: 0,
    type: o.type === "Hackathon" ? "Contest" : o.type,
    language: o.language || "en",
    country: o.country || "GLOBAL",
    campaign: o.id === "weekend-build" ? "weekend" : o.campaign,
    title:
      o.id === "weekend-build" ? "Build a useful Zcash prototype" : o.title,
    prizes: o.type === "Task" ? [] : betaPrizes(reward, o.prizes || [6, 3, 1]),
    reviewDays: 7,
    deliveryDays: 14,
    funding: "Example",
  };
});
export const newDraft = (values: Partial<Draft> = {}): Draft => ({
  id: crypto.randomUUID(),
  title: "",
  type: "Task",
  category: "Development",
  organizer: "personal",
  campaign: "",
  description: "",
  deliverables: "",
  criteria: "",
  reward: "",
  prizes: [""],
  deadline: "",
  reviewDays: "7",
  deliveryDays: "14",
  step: 0,
  language: "any",
  country: "GLOBAL",
  ...values,
});
export const lines = (value: string) =>
  value
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
export const rewardOf = (draft: Draft) =>
  draft.type === "Task"
    ? Number(draft.reward)
    : draft.prizes.reduce((sum, n) => sum + Number(n), 0);
export function migrateDraft(raw: Record<string, unknown>): Draft {
  const { postingAs, ...current } = raw;
  return newDraft({
    ...current,
    id: String(raw.id || crypto.randomUUID()),
    type: raw.type === "Contest" ? "Contest" : "Task",
    organizer: postingAs ? "personal" : String(raw.organizer || "personal"),
    description: String(raw.description || ""),
    criteria: String(raw.criteria || ""),
    deliverables: String(raw.deliverables || ""),
    reward: String(raw.reward || ""),
    prizes: Array.isArray(raw.prizes) ? (raw.prizes as string[]) : [""],
    step: Math.min(Number(raw.step) || 0, 3),
    art: isCover(raw.art) ? raw.art : undefined,
    language: normalizeLanguage(raw.language),
    country: normalizeCountry(raw.country),
  } as Partial<Draft>);
}
export type Errors = Record<string, string>;
export function validateDraft(
  d: Draft,
  step: number,
  managed: string[],
  campaigns: Campaign[],
  today = new Date().toISOString().slice(0, 10),
): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.title.trim().length < 8) e.title = "Use at least 8 characters.";
    if (!managed.includes(d.organizer))
      e.organizer = "Choose your profile or a community you manage.";
    if (
      d.campaign &&
      !campaigns.some((c) => c.id === d.campaign && c.organizer === d.organizer)
    )
      e.campaign = "Choose a campaign from this organizer.";
    if (!validLanguage(d.language)) e.language = "Choose a language.";
    if (!validCountry(d.country)) e.country = "Choose a country or Global.";
  }
  if (step === 1) {
    if (d.description.trim().length < 30)
      e.description = "Describe the work in at least 30 characters.";
    if (!lines(d.deliverables).length)
      e.deliverables = "Add at least one deliverable.";
    if (!lines(d.criteria).length)
      e.criteria = "Add at least one acceptance criterion.";
  }
  if (step === 2) {
    const amounts = d.type === "Task" ? [d.reward] : d.prizes;
    if (
      !amounts.length ||
      amounts.some(
        (n) =>
          !n.trim() ||
          !Number.isFinite(Number(n)) ||
          Number(n) < 0.00000001 ||
          Math.abs(Number(n) * 1e8 - Math.round(Number(n) * 1e8)) > 0.000001,
      ) ||
      rewardOf(d) > 21000000
    )
      e.reward = "Use positive ZEC amounts with up to 8 decimal places.";
    const parsed = Date.parse(d.deadline);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline) ||
      Number.isNaN(parsed) ||
      new Date(parsed).toISOString().slice(0, 10) !== d.deadline ||
      d.deadline <= today
    )
      e.deadline = "Choose a future deadline.";
    const campaign = campaigns.find((c) => c.id === d.campaign);
    if (campaign && d.deadline > campaign.deadline)
      e.deadline = "The deadline must be on or before the campaign ends.";
    if (
      !Number.isInteger(Number(d.reviewDays)) ||
      Number(d.reviewDays) < 1 ||
      Number(d.reviewDays) > 30
    )
      e.reviewDays = "Choose 1–30 days.";
    if (
      d.type === "Task" &&
      (!Number.isInteger(Number(d.deliveryDays)) ||
        Number(d.deliveryDays) < 1 ||
        Number(d.deliveryDays) > 180)
    )
      e.deliveryDays = "Choose 1–180 days.";
  }
  return e;
}
export function publishDraft(d: Draft, owner: string): Opportunity {
  return {
    id: d.id,
    title: d.title.trim(),
    description: d.description.trim().split("\n")[0],
    brief: d.description.trim(),
    type: d.type,
    category: d.category,
    community: d.organizer,
    campaign: d.campaign || undefined,
    language: normalizeLanguage(d.language),
    country: normalizeCountry(d.country),
    deliverables: lines(d.deliverables),
    criteria: lines(d.criteria),
    reward: rewardOf(d),
    deadline: d.deadline,
    prizes: d.type === "Contest" ? d.prizes.map(Number) : [],
    reviewDays: Number(d.reviewDays),
    deliveryDays: Number(d.deliveryDays),
    owner,
    applicants: 0,
    level: "All levels",
    funding: "Pledged",
    art: resolveCover(d.art, d.category, d.title),
  };
}
export const safeHttpUrl = (url: string) => {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
