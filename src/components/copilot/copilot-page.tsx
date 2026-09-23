import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { AddToAgent } from "./add-to-agent";
import { InstallCommand } from "./install-command";

export type CopilotExample = { q: string; a: string };
export type CopilotSource = { name: string; desc: string };

/**
 * One quiet layout for the three copilot skills: what it is, how to install
 * it, a demo transcript, the questions it answers and the sources it reads.
 */
export function CopilotPage({
  title,
  subtitle,
  skill,
  intro,
  examples,
  sources,
  note,
  terminal,
  setup,
  start,
}: {
  title: string;
  subtitle: string;
  skill: string;
  intro: ReactNode;
  examples: CopilotExample[];
  sources: CopilotSource[];
  note: ReactNode;
  terminal: ReactNode;
  setup?: ReactNode;
  start?: ReactNode;
}) {
  return (
    <div className="ws-copilot" data-skill={skill}>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="ws-copilot-hero">
        <div>
          <p className="ws-copilot-intro">{intro}</p>
          {start ?? (
            <>
              <InstallCommand skill={skill} />
              <p className="ws-copilot-fine">
                Use your existing AI agent. No OpenZcash API key required.
              </p>
              <AddToAgent skill={skill} />
            </>
          )}
          {setup}
        </div>
        <div className="ws-copilot-demo">{terminal}</div>
      </section>
      <section className="ws-copilot-block">
        <h2>Ask things like</h2>
        <ul className="ws-copilot-examples">
          {examples.map((u) => (
            <li key={u.q}>
              <p className="ws-copilot-q">{u.q}</p>
              <p className="ws-copilot-a">{u.a}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="ws-copilot-block">
        <h2>Grounded in public sources</h2>
        <ul className="ws-copilot-sources">
          {sources.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>
              <span>{s.desc}</span>
            </li>
          ))}
        </ul>
        <p className="ws-copilot-note">{note}</p>
      </section>
    </div>
  );
}
