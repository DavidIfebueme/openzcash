import type { CopilotSkill } from "./profiles";

/** All three skills use public allowlisted files, without private repository access. */
export function installCommand(skill: CopilotSkill, agent?: string) {
  return `npx skills@1.7.0 add https://openzcash.org --skill ${skill}${agent ? ` -a ${agent}` : ""}`;
}
