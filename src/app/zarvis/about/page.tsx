import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { zarvisConfig } from "@/lib/zarvis/config";
import { systemPrompt } from "@/lib/zarvis/prompt";
import { DIRECT_ROUTES, FAQ, FRESHNESS_NOTE, INCIDENTS, KEPT_AT_OPENZCASH, LIMITATIONS, PROVIDER_RETENTION, TOKEN_DISCLAIMER, modelLine, quotaLines } from "@/lib/zarvis/about";
import { modelLabel } from "@/lib/zarvis/provenance";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { xResearchConfig } from "@/lib/zarvis/x-research-config";
import { X_RESEARCH_ACCOUNTS } from "@/lib/zarvis/x-research-policy";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "About Zarvis · OpenZcash",
  description: "How OpenZcash's AI guide answers: which questions never touch a model, which model is used, what a visitor may ask per day, what is kept for how long, what it cannot do, and what broke on launch day.",
  path: "/zarvis/about",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" aria-labelledby={title}>
      <h2 id={title} className="mb-2 text-sm font-semibold text-stone-800">{title}</h2>
      <Card className="text-sm leading-relaxed text-stone-600">{children}</Card>
    </section>
  );
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function AboutZarvisPage() {
  const config = zarvisConfig();
  const xResearch = config.enabled && xResearchConfig().enabled;
  const quotas = quotaLines(config);
  const retention = PROVIDER_RETENTION[config.providerLabel];
  return (
    <>
      <PageHeader
        title="About Zarvis"
        subtitle="Zarvis is OpenZcash's guide to Zcash. This page says how it answers, what it costs you, what it keeps and where it has failed, so you can decide how much to trust it."
      />
      <Card className="mb-6 text-sm leading-relaxed text-stone-600">
        <p className="font-semibold text-amber-700">{TOKEN_DISCLAIMER.title}</p>
        <p className="mt-1">{TOKEN_DISCLAIMER.body}</p>
      </Card>
      <Section title="Two kinds of answer">
        <p className="mb-3">Under every answer a badge says which kind you got:</p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="zarvis-provenance-badge zarvis-provenance-local">Direct from OpenZcash data · no AI</span>
          <span className="zarvis-provenance-badge">{modelLabel(config.model, config.providerLabel)} · 3 sources · check them</span>
        </div>
        <p className="mb-3 text-xs text-stone-500">The first badge marks answers written by this site&apos;s own code from its own records. The second marks answers written by an AI model — open the source list under those and check them.</p>
        <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="mb-1.5 font-semibold text-stone-800">1 · Direct from OpenZcash data · no AI</p>
          <p className="mb-2">The question matched one of the site&apos;s own records and was answered by code, with no model call, no cost and the record&apos;s date. These questions are answered that way:</p>
          <ul className="space-y-1.5">
            {DIRECT_ROUTES.map((route) => <li key={route.label}><span className="font-medium text-stone-800">{route.label}</span>: {route.detail}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="mb-1.5 font-semibold text-stone-800">2 · Model answer</p>
          <p>Everything else goes to {modelLine(config)} The model receives the recent conversation, the records Zarvis retrieved from this site and the official ZIP corpus, and must cite what it used. The badge names the model and counts the sources.</p>
        </div>
      </Section>
      <Section title="What you may ask">
        <ul className="space-y-1.5">{quotas.map((line) => <li key={line}>{line}</li>)}</ul>
        <p className="mt-3">A question is at most 2,000 characters and an answer is written within 55 seconds (110 seconds for Deep analysis). Zarvis is free to use; OpenZcash pays the model.</p>
      </Section>
      <Section title="How fresh is the data?">
        <p>{FRESHNESS_NOTE}</p>
      </Section>
      {xResearch ? <Section title="Research on X">
        <p>Zarvis can look for public Zcash announcements, bounties, grants, releases and events from the last 30 days. Coverage currently includes {X_RESEARCH_ACCOUNTS.map(a => `@${a.handle}`).join(", ")}. Results can be cached for up to 30 minutes and include post links and retrieval dates.</p>
        <p className="mt-3">This search uses xAI. It receives a predefined Zcash topic, without your question or conversation history. Public results are summarized by xAI and passed to the model answering you. <a href={PROVIDER_RETENTION["xAI (Grok)"].url} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">xAI data policy ↗</a></p>
        <p className="mt-3">Coverage is limited and separate usage limits apply. A missing result does not mean an opportunity does not exist. Check the original post and the project&apos;s current terms. Zarvis cannot post, send messages or access private accounts, Discord or Telegram.</p>
      </Section> : null}
      <Section title="What is kept, and for how long">
        <ul className="space-y-1.5">
          <li><span className="font-medium text-stone-800">In your browser:</span> the conversation stays in page memory while you move around the site, including the Monthly pages. Reloading or New chat clears it. Zarvis never writes your question into the page address; “Copy question link” under an answer makes a link that carries that one question and only fills the composer when opened. Shared calculator links carry only scenario assumptions.</li>
          <li><span className="font-medium text-stone-800">At OpenZcash:</span> {KEPT_AT_OPENZCASH}</li>
          <li><span className="font-medium text-stone-800">At the model provider:</span> for model answers, the recent turns and the retrieved records are sent to {retention.provider}, which {retention.summary} Read on {shortDate(retention.readOn)} at <a href={retention.url} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">{retention.linkLabel} ↗</a>{retention.training ? <> and <a href={retention.training.url} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">{retention.training.linkLabel} ↗</a></> : null}.</li>
        </ul>
      </Section>
      <Section title="What it cannot do">
        <ul className="space-y-1.5">{LIMITATIONS.map((line) => <li key={line}>{line}</li>)}</ul>
      </Section>
      <Section title="Frequently asked questions">
        <dl className="space-y-3">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-medium text-stone-800">{item.q}</dt>
              <dd className="mt-0.5">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Using Zarvis">
        <ul className="space-y-1.5">
          <li><span className="font-medium text-stone-800">Learning the interface.</span> The interactive <Link href="/zarvis/guide" className="text-amber-700 hover:underline">Zarvis guide</Link> shows the two badges, a sample answer and the depth choices with live examples, and lists questions you can try with the composer pre-filled.</li>
          <li><span className="font-medium text-stone-800">Asking.</span> Write in any language; a question is at most 2,000 characters. The pills under the composer are one-tap starting points, and the direct routes listed above show what is answered without AI. The selector next to the composer switches between Quick and Deep analysis.</li>
          <li><span className="font-medium text-stone-800">Reading an answer.</span> The badge under it says where it came from, and “N sources consulted” opens the records or pages that were used. For guarded model answers, a notice identifies figures the check withheld; its coverage and limits are described under “What it cannot do”.</li>
          <li><span className="font-medium text-stone-800">Sharing.</span> Copy answer, Copy with sources and Copy question link sit under every complete answer. A question link carries only that question and fills the composer when opened; it never sends anything by itself.</li>
          <li><span className="font-medium text-stone-800">Continuing.</span> The conversation stays in page memory while you move around the site, including the Monthly pages; “＋ New chat” clears it. Limits, languages and privacy are described in the sections above.</li>
        </ul>
      </Section>
      <Section title="The instructions the model receives">
        <p className="mb-2">This is the complete standing instruction sent with every model answer, as deployed right now. Evidence and the current time are added separately for each question.</p>
        <details>
          <summary className="cursor-pointer text-amber-700">Read the instructions</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-stone-600">{systemPrompt("quick")}</pre>
        </details>
      </Section>
      <Section title="Status and incidents">
        <p className="mb-3">An hourly canary asks the four starter questions with the model forbidden and stores the result; <a href="/api/zarvis/health" className="text-amber-700 hover:underline">/api/zarvis/health</a> is public and reports whether the last run passed. What went wrong so far, in the open:</p>
        <ul className="space-y-3">
          {INCIDENTS.map((incident) => (
            <li key={`${incident.date}-${incident.title}`}>
              <span className="font-medium text-stone-800">{shortDate(incident.date)}, {incident.window} · {incident.title}.</span> {incident.what} <span className="text-stone-800">Fix:</span> {incident.fix}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Found something wrong?">
        <p className="mb-2">Zarvis can make mistakes, and so can the data pages. Two ways to reach a fix:</p>
        <ul className="space-y-1.5">
          <li><span className="font-medium text-stone-800">A Zarvis answer:</span> use the rating under it and pick what went wrong. The reason, the route and the day are recorded; the text is not.</li>
          <li><span className="font-medium text-stone-800">Site data</span> (a grant row, a wallet listing, a community entry): post in the <a href="https://forum.zcashcommunity.com/t/openzcash-org-public-transparency/56404" target="_blank" rel="noreferrer" className="text-amber-700 hover:underline">OpenZcash forum thread ↗</a>, the public channel where corrections are read and applied.</li>
        </ul>
        <p className="mt-3"><Link href="/zcg/methodology" className="text-amber-700 hover:underline">How OpenZcash computes its own figures →</Link></p>
      </Section>
    </>
  );
}
