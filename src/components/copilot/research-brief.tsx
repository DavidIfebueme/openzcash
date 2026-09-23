import Link from "next/link";
import type { CopilotProfile } from "./profiles";

export function ResearchBrief({ profile }: { profile: CopilotProfile }) {
  return (
    <aside className="ws-research-brief" aria-label="Research outcomes">
      <span className="ws-research-eyebrow">{profile.brief.eyebrow}</span>
      <h2>{profile.brief.title}</h2>
      <ol>
        {profile.brief.steps.map((step, index) => (
          <li key={step.title}><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>
        ))}
      </ol>
      <div className="ws-research-brief-links">
        <span>Explore the records yourself</span>
        {profile.brief.links.map((link) => <Link key={link.href} href={link.href}>{link.label} <span aria-hidden="true">↗</span></Link>)}
      </div>
      <p className="ws-research-footnote">Use an assistant with web access. Features depend on your provider, plan, and settings.</p>
    </aside>
  );
}
