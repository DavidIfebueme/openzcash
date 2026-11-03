import { pick } from "./language";
import type { AnswerProvenance } from "./types";

/** Client-safe labels for the badge under each answer. Counts and names only; the discarded text never reaches the browser. */
export function modelLabel(model: string | null, provider?: string | null): string {
  const m = model?.match(/^(grok|gpt)-?(\d+(?:\.\d+)?)(?:-(.+))?$/i);
  if (m) return `${m[1].toLowerCase() === "grok" ? "Grok" : "GPT"}${m[1].toLowerCase() === "grok" ? " " : "-"}${m[2]}${m[3] ? ` ${m[3].replace(/-/g, " ")}` : ""}`;
  // claude-<family>-<major>[-<minor>][-<yyyymmdd>]: the family is capitalised and the version dotted; a dated snapshot suffix is dropped.
  const claude = model?.match(/^claude-(sonnet|haiku|opus)-(\d+)(?:-(\d+))?(?:-\d{8})?$/i);
  if (claude) return `Claude ${claude[1][0].toUpperCase()}${claude[1].slice(1).toLowerCase()} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  return model || provider || "AI model";
}
export function provenanceLabel(p: AnswerProvenance, sources: number, provider?: string | null): string {
  const lang = p.language;
  if (p.route === "local") return pick(lang, { en: "Direct from OpenZcash data · no AI", pt: "Direto dos dados OpenZcash · sem IA", es: "Directo de los datos de OpenZcash · sin IA" });
  const count = `${sources} ${pick(lang, { en: sources === 1 ? "source" : "sources", pt: sources === 1 ? "fonte" : "fontes", es: sources === 1 ? "fuente" : "fuentes" })}`;
  return [modelLabel(p.model, provider), ...(p.webSearch ? [pick(lang, { en: "web search", pt: "busca na web", es: "búsqueda web" })] : []), ...(p.xResearch ? [pick(lang, { en: "X research via xAI", pt: "pesquisa no X via xAI", es: "investigación en X vía xAI" })] : []), count, pick(lang, { en: "check them", pt: "confira", es: "verifícalas" })].join(" · ");
}
/** Rendered under a partial answer so dropped sentences or table rows never read as complete; the count comes from provenance, never the withheld text. */
export function fallbackNotice(p: AnswerProvenance): string | undefined {
  if (!p.groundingFallback) return;
  const n = p.withheldFigures;
  return pick(p.language, {
    en: n === 1 ? "1 figure could not be verified and was left out." : n > 1 ? `${n} figures could not be verified and were left out.` : "Some figures could not be verified and were left out.",
    pt: n === 1 ? "1 valor não pôde ser verificado e foi omitido." : n > 1 ? `${n} valores não puderam ser verificados e foram omitidos.` : "Alguns valores não puderam ser verificados e foram omitidos.",
    es: n === 1 ? "1 cifra no pudo verificarse y se omitió." : n > 1 ? `${n} cifras no pudieron verificarse y se omitieron.` : "Algunas cifras no pudieron verificarse y se omitieron.",
  });
}
/** Retrieval stamps carry their zone; the interface itself stays English. */
export function retrievedLabel(iso: string): string | undefined {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return;
  return `Retrieved ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(at)} UTC`;
}
