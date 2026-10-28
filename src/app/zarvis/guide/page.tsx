import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { zarvisConfig } from "@/lib/zarvis/config";
import { fallbackNotice, provenanceLabel, retrievedLabel } from "@/lib/zarvis/provenance";
import { SHARE_PARAM } from "@/lib/zarvis/share";
import { ANATOMY, ANATOMY_LEGEND, BADGE_GUIDANCE, DEPTH_AUTO_NOTE, DEPTH_COMPARISON, GUIDE_QUESTIONS, SHARE_NOTE } from "@/lib/zarvis/guide";
import type { AnswerProvenance } from "@/lib/zarvis/types";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Zarvis guide · OpenZcash",
  description: "Zarvis's interface, explained by showing it: what the two badges mean, which questions never touch a model, how to read an answer's sources, and when to use Deep analysis.",
  path: "/zarvis/guide",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6" aria-labelledby={title}>
      <h2 id={title} className="mb-2 text-sm font-semibold text-stone-800">{title}</h2>
      <Card className="text-sm leading-relaxed text-stone-600">{children}</Card>
    </section>
  );
}

const sample = (over: Partial<AnswerProvenance>): AnswerProvenance => ({ route: "model", model: null, webSearch: false, groundingFallback: false, withheldFigures: 0, language: "en", ...over });
const questionHref = (question: string) => `/zarvis?${SHARE_PARAM}=${encodeURIComponent(question)}`;
const Callout = ({ n }: { n: number }) => <sup className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800" aria-hidden="true">{n}</sup>;

export default function ZarvisGuidePage() {
  const config = zarvisConfig();
  const localBadge = provenanceLabel(sample({ route: "local" }), 0, config.providerLabel);
  const modelBadge = provenanceLabel(sample({ model: config.model }), 3, config.providerLabel);
  const anatomyBadge = provenanceLabel(sample({ model: config.model }), ANATOMY.sources.length, config.providerLabel);
  const anatomyNotice = fallbackNotice(sample({ groundingFallback: true, withheldFigures: ANATOMY.withheldFigures }));
  const anatomyRetrieved = retrievedLabel(ANATOMY.retrievedAt);
  return (
    <>
      <PageHeader
        title="Zarvis guide"
        subtitle="Zarvis is OpenZcash's guide to Zcash, and this page explains its chat by showing it: the badges under answers, the questions you can try, what a complete answer contains and how the depth choice changes it. Limits, retention and the incident log live on the About page."
      />
      <Section title="The two badges">
        <p className="mb-4">Under every answer a badge says which kind you got. These samples are rendered by the same code the chat uses, with the model configured right now:</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="zarvis-provenance-badge zarvis-provenance-local">{localBadge}</span>
          <span className="zarvis-provenance-badge">{modelBadge}</span>
        </div>
        <div className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="mb-1.5 font-semibold text-stone-800">{localBadge}</p>
          <p>{BADGE_GUIDANCE.direct}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="mb-1.5 font-semibold text-stone-800">{modelBadge}</p>
          <p>{BADGE_GUIDANCE.model}</p>
        </div>
      </Section>
      <Section title="Try these questions">
        <p className="mb-4">Each link opens Zarvis with the composer filled in. {SHARE_NOTE}</p>
        <ul className="space-y-3">
          {GUIDE_QUESTIONS.map((item) => <li key={item.question}>
            <Link href={questionHref(item.question)} className="font-medium text-amber-700 hover:underline">{item.question}</Link>
            <span className="ml-2 whitespace-nowrap">→ {item.route === "direct" ? localBadge : "model answer"}</span>
            <p className="mt-0.5">{item.note}</p>
          </li>)}
        </ul>
      </Section>
      <Section title="Anatomy of an answer">
        <p className="mb-4">A sample model answer, annotated. The numbers mark what to check on every real answer:</p>
        <figure className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <figcaption className="sr-only">Sample answer, annotated: badge, sources, withheld-figure notice and sharing actions</figcaption>
          <p className="mb-2 text-stone-800"><span className="font-medium">Q:</span> {ANATOMY.question}</p>
          <div className="zarvis-prose"><p>{ANATOMY.answer}</p></div>
          <div className="zarvis-provenance">
            <span className="zarvis-provenance-badge">{anatomyBadge}</span><Callout n={1}/>
            {anatomyNotice ? <span className="zarvis-provenance-notice" role="note">{anatomyNotice}</span> : null}<Callout n={3}/>
          </div>
          <details className="zarvis-answer-sources" open>
            <summary>{ANATOMY.sources.length} sources consulted<Callout n={2}/></summary>
            <ol>
              {ANATOMY.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{anatomyRetrieved ? <small>{anatomyRetrieved}</small> : null}</li>)}
            </ol>
          </details>
          <span className="zarvis-share">
            <span className="zarvis-text-button">Copy answer</span>
            <span className="zarvis-text-button">Copy with sources</span>
            <span className="zarvis-text-button">Copy question link</span><Callout n={4}/>
          </span>
        </figure>
        <ol className="space-y-1.5">
          {ANATOMY_LEGEND.map((line, index) => <li key={line} value={index + 1}>{line}</li>)}
        </ol>
      </Section>
      <Section title="Quick or Deep?">
        <p className="mb-4">The selector next to the composer sets how much thinking an answer gets. Auto, Quick and Deep analysis are the three choices; these budgets come from the same planner the chat runs:</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-stone-500">
              <th className="py-2 pr-4 font-medium"> </th>
              <th className="py-2 pr-4 font-medium">Quick</th>
              <th className="py-2 font-medium">Deep analysis</th>
            </tr>
          </thead>
          <tbody>
            {DEPTH_COMPARISON.map((row) => <tr key={row.label} className="border-t border-stone-200">
              <td className="py-2 pr-4 text-stone-800">{row.label}</td>
              <td className="py-2 pr-4">{row.quick}</td>
              <td className="py-2">{row.deep}</td>
            </tr>)}
          </tbody>
        </table>
        <p className="mt-4">{DEPTH_AUTO_NOTE}</p>
      </Section>
      <Section title="Where to go next">
        <ul className="space-y-1.5">
          <li><Link href="/zarvis" className="font-medium text-amber-700 hover:underline">Open the chat →</Link> the pills under the composer are one-tap starting points.</li>
          <li><Link href="/zarvis/about" className="font-medium text-amber-700 hover:underline">About Zarvis →</Link> what you may ask per day, what is kept for how long, what it cannot do, and the incident log.</li>
          <li><a href="https://github.com/Michae2xl/openzcash/blob/main/docs/using-zarvis.md" target="_blank" rel="noreferrer" className="font-medium text-amber-700 hover:underline">Using Zarvis, in the repository ↗</a> the same interface described as documentation.</li>
        </ul>
      </Section>
    </>
  );
}
