export type PublishingPlatform = "gleyo" | "zec-bounties";
export type Preparation = {
  title: string; description: string; community: string; tasks: string;
  criteria: string; amount: string; xp: string; winners: string;
  deadline: string; reference: string; art?: string;
  language: string; country: string;
};
export const emptyPreparation = (): Preparation => ({ title: "", description: "", community: "", tasks: "", criteria: "", amount: "", xp: "", winners: "", deadline: "", reference: "", language: "", country: "" });
const lines = (s: string) => s.split("\n").map((v) => v.trim()).filter(Boolean);
export function validatePreparation(p: Preparation, provider: PublishingPlatform, today = new Date().toISOString().slice(0, 10)) {
  const errors: Partial<Record<keyof Preparation, string>> = {};
  if (p.title.trim().length < 4) errors.title = "Add a clear title.";
  if (p.description.trim().length < 20) errors.description = "Describe the goal in at least 20 characters.";
  if (!p.tasks.trim()) errors.tasks = provider === "gleyo" ? "Add the tasks in this quest." : "Describe the expected deliverable.";
  if (provider === "gleyo" && lines(p.tasks).length > 5) errors.tasks = "Gleyo quests support up to 5 tasks.";
  if (provider === "zec-bounties" && !p.criteria.trim()) errors.criteria = "Explain how the work will be accepted.";
  if ((provider === "zec-bounties" || p.amount) && (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(p.amount) || Number(p.amount) <= 0 || !Number.isFinite(Number(p.amount)))) errors.amount = "Enter a positive ZEC amount, with up to 8 decimals.";
  if (provider === "zec-bounties" && !p.deadline) errors.deadline = "Choose the deadline requested by ZEC Bounties.";
  if (p.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(p.deadline) || !Number.isFinite(Date.parse(p.deadline)) || new Date(p.deadline).toISOString().slice(0, 10) !== p.deadline || p.deadline < today)) errors.deadline = "Choose today or a later date.";
  if (provider === "gleyo" && p.xp && (!/^\d+$/.test(p.xp) || !Number.isSafeInteger(Number(p.xp)))) errors.xp = "Use a whole number of XP.";
  if (provider === "gleyo" && p.amount && (!/^[1-9]\d*$/.test(p.winners) || !Number.isSafeInteger(Number(p.winners)))) errors.winners = "Add the number of reward recipients.";
  if (p.reference) {
    try { const u = new URL(p.reference); if (u.protocol !== "https:" || u.username || u.password) throw new Error(); }
    catch { errors.reference = "Use a public HTTPS reference link."; }
  }
  return errors;
}
export function preparationText(p: Preparation, provider: PublishingPlatform, cover: string) {
  const blocks = [
    `# ${p.title.trim()}`,
    `Prepared for ${provider === "gleyo" ? "Gleyo" : "ZEC Bounties"}`,
    p.community.trim() && `Community / team: ${p.community.trim()}`,
    p.description.trim(),
    `${provider === "gleyo" ? "Tasks" : "Deliverables"}:\n${lines(p.tasks).map((v, i) => `${i + 1}. ${v}`).join("\n")}`,
    p.criteria.trim() && `Acceptance criteria:\n${p.criteria.trim()}`,
    provider === "gleyo" && p.xp && `XP: ${p.xp}`,
    p.amount && `${provider === "gleyo" ? "ZEC reward pool" : "ZEC reward"}: ${p.amount} ZEC`,
    provider === "gleyo" && p.amount && `Reward recipients: ${p.winners}. Confirm per-person allocation and availability on Gleyo.`,
    p.deadline && `Deadline: ${p.deadline} (confirm time and timezone on the platform)`,
    p.reference && `Reference: ${p.reference}`,
    p.language && `Language: ${p.language}`,
    p.country && `Country / scope: ${p.country}`,
    `Cover: https://openzcash.org/opportunities/art/${cover}.png`,
    "Prepared with OpenZcash. Review and publish on the chosen platform; this brief is not published or funded.",
  ];
  return blocks.filter(Boolean).join("\n\n");
}
