/** ZCG is distributed from the public site; the application repository is private. */
export function installCommand(skill: string, agent?: string) {
  const source = skill === "zcg-copilot"
    ? "skills@1.7.0 add https://openzcash.org"
    : "skills add Michae2xl/openzcash";
  return `npx ${source} --skill ${skill}${agent ? ` -a ${agent}` : ""}`;
}
