import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { CopilotSetup } from "./copilot-setup";
import { ResearchBrief } from "./research-brief";
import { COPILOT_PROFILES, type CopilotSkill } from "./profiles";

export type CopilotExample = { q: string; a: string };
export type CopilotSource = { name: string; desc: string };

/**
 * Shared entry point: three optional setup levels, domain-specific prompts,
 * examples, and the public sources behind each copilot.
 */
export function CopilotPage({
  title,
  subtitle,
  skill,
  intro,
  examples,
  sources,
  note,
}: {
  title: string;
  subtitle: string;
  skill: CopilotSkill;
  intro: ReactNode;
  examples: CopilotExample[];
  sources: CopilotSource[];
  note: ReactNode;
}) {
  const profile = COPILOT_PROFILES[skill];
  return (
    <div className="ws-copilot" data-skill={skill}>
      <PageHeader title={title} subtitle={subtitle} />
      <p className="ws-copilot-intro">{intro}</p>
      <CopilotSetup profile={profile} brief={<ResearchBrief profile={profile} />} />
      <div className="ws-copilot-resources">
        <details>
          <summary>More examples</summary>
          <ul className="ws-copilot-examples">
            {examples.map((u) => (
              <li key={u.q}>
                <p className="ws-copilot-q">{u.q}</p>
                <p className="ws-copilot-a">{u.a}</p>
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Sources & methodology</summary>
          <ul className="ws-copilot-sources">
            {sources.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong>
                <span>{s.desc}</span>
              </li>
            ))}
          </ul>
          <p className="ws-copilot-note">{note}</p>
        </details>
      </div>
    </div>
  );
}
