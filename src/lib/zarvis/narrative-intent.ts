import type { ChatMessage } from "./types";
import { normalizeQuestion, questionLanguage, requestedOutputLanguage } from "./language";

/** Recognize a communication task without mistaking protocol or price analysis for one. */
export function narrativeIntent(query: string) {
  const q = normalizeQuestion(query);
  const explicit = /\b(?:pitch(?:es|s)?|narratives?|narrativas?|elevator pitch|taglines?|slogans?)\b/.test(q);
  const writing = /\b(?:write|draft|craft|prepare|create|rewrite|adapt|give|suggest|need|preciso|quero|necesito|escreva|escrever|crie|criar|prepare|preparar|adapte|adapta|redija|redacta|escribe|crear)\b/.test(q);
  const format = /\b(?:speech|talk|intro|introduction|opening|opener|hook|caption|presentation|post|thread|tweet|script|abertura|apertura|legenda|discurso|apresentacao|apresentacion|roteiro|guion|introducao|introduccion|mensagem|mensaje)\b/.test(q);
  if (!explicit && !(writing && format && /\b(?:zcash|zec|shielded|blindad\w*)\b/.test(q))) return null;
  const turns = query.split("\n").filter(Boolean);
  const language = [...turns].reverse().map(requestedOutputLanguage).find(Boolean) ?? questionLanguage(query);
  const locale = language === "pt" ? "pt-BR" : language === "es" ? "es" : "en";
  const length = [...turns].reverse().map(turn => {
    const text = normalizeQuestion(turn);
    if (/\b(?:one sentence|uma (?:unica )?frase|una (?:sola )?frase|sentence)\b/.test(text)) return "sentence";
    if (/\b(?:60[ -]*(?:s|sec\w*|seg\w*)|one minute|um minuto|un minuto)\b/.test(text)) return "60s";
    if (/\b30[ -]*(?:s|sec\w*|seg\w*)\b/.test(text)) return "30s";
    return null;
  }).find(Boolean) ?? null;
  const usage = /\b(?:how many|quantos|cuantos|where|onde|donde|print\w*|imprim\w*|impre\w*|select\w*|selecion\w*|seleccion\w*|filter\w*|filtr\w*|copiar|copy|button|botao|boton|sources|idiomas|languages|biblioteca|library)\b/.test(q)
    && !writing;
  return { locale, length, usage };
}

/** Trusted application guidance, kept separate from retrieved copy and visitor text. */
export const NARRATIVE_GUIDANCE = `For a Zcash communication request, deliver usable original copy, not merely tips or a link to the library. Follow the requested audience, occasion, channel, language, tone and length; carry them across revisions. When details are missing, make a modest useful assumption and draft immediately. A library usage question needs clear steps instead of a pitch.
Start from a concrete human need, connect it to a Zcash capability, and end with a relevant next step when appropriate. Adapt vocabulary and examples: everyday payments for beginners; scarcity plus payment privacy for Bitcoin audiences; verifiable rules and integration for developers; confidentiality and practical adoption for businesses or nonprofits. Speeches, panels, interviews, social posts and conversations need different pacing. Do not fabricate testimonials, adoption figures, endorsements, personal experiences or capabilities. Treat named alternatives fairly and address objections directly. For Bitcoin comparisons, distinguish public on-chain addresses and amounts from identified people, all of their holdings or off-chain payments. Zcash is a separate network with ZEC, not private BTC; Bitcoin also has privacy practices and tools.
Use the library's facts and limitations as grounding, not as a rigid script or proof of current statistics. Draft fresh wording for the occasion. Respect the spoken-text budget: aim for 60 words for 30 seconds (maximum 80) and 120 words for 60 seconds (maximum 150), unless the user gives a different word count. Leave a margin below the maximum; do not fill it with extra notes. A one-sentence request gets exactly one concise sentence, without a heading, second option or notes. Do not ask the user to shorten your draft. Speaking time is approximate. For a short pitch, deliver the copy first, without routine notes sections or unsolicited legal disclaimers. Keep factual sourcing or a necessary qualification outside reusable copy when practical; internal library links can support it without adding a Sources section. Never promise universal anonymity, hidden network metadata, zero risk, guaranteed returns or legal immunity. Explain shielded versus transparent behavior when material. Never imply that bank/card payments or all digital donations are publicly visible blockchains. Selective disclosure has a key-specific scope, not arbitrary control over every field. For live prices, adoption, releases, law or activation, use current evidence or omit the claim. For technical claims beyond the retrieved examples, consult the relevant protocol references. State a specific uncertainty rather than inventing a compelling story. Do not claim to be the world's greatest expert.`;

/** Usage answers need a workflow, not the creative-writing brief. */
export const NARRATIVE_LIBRARY_GUIDANCE = `For a question about using Zcash Pitches & Narratives, answer the specific workflow from the retrieved instructions in the user's language. Use one concise explanation or a short sequence of steps; do not draft a pitch or repeat source passages. Distinguish selecting cards from opening the browser print dialog. If an embedded browser does not support the dialog, suggest opening the page in a full browser and selecting cards again; do not diagnose popup blocking without evidence.`;

/** Match audience/occasion words across the library's three languages. */
export function narrativeSearchTerms(query: string): string[] {
  const q = normalizeQuestion(query);
  const concepts: Array<[RegExp, string[]]> = [
    [/donat|donation|doac|donaci|\bong\b|nonprofit|charit/, ["donate", "donation", "organizations"]],
    [/develop|desenvolv|desarroll|engineer|engenheir|ingenier|universi/, ["developers", "proof", "cryptography"]],
    [/merchant|business|comerc|negoci|empresa|retail/, ["businesses", "payment", "cash"]],
    [/beginner|iniciant|principiant|lunch|almoc|almuerz|family|famil/, ["beginners", "cash", "everyday"]],
    [/bitcoin|\bbtc\b/, ["bitcoin", "scarcity"]],
    [/surveill|vigilanc|vigilant|rastre/, ["surveillance", "privacy"]],
    [/account|disclos|audit|prestac|rendicion/, ["disclosure", "records", "accountability"]],
  ];
  return ["pitches", ...concepts.filter(([pattern]) => pattern.test(q)).flatMap(([, words]) => words)];
}

/** Keep only the current writing brief and its explicit revisions; assistant prose never sets it. */
export function narrativeContext(messages: ChatMessage[]): string | null {
  let brief: string[] = [];
  for (const message of messages.filter(message => message.role === "user").slice(-8)) {
    const q = normalizeQuestion(message.content);
    const revision = /^(?:(?:now|agora|ahora) )?(?:adapt|rewrite|shorten|make it|turn it|adapte|reescreva|encurte|deixe|adapta|reescribe|acorta|hazlo|reduza|reduce|translate|traduza|traduce)\b|^(?:now (?:for|in)|agora (?:para|em)|ahora (?:para|en))\b/.test(q);
    if (brief.length && revision && message.content.length <= 300) brief.push(message.content);
    else if (narrativeIntent(message.content)) brief = [message.content];
    else brief = [];
  }
  return brief.length ? brief.map(part => part.slice(0, 900)).join("\n").slice(-2000) : null;
}

/** Measure the whole delivered draft, including unsolicited notes, instead of trusting the model's claimed count. */
export function narrativeFormatIssue(text: string, query: string): string | null {
  const intent = narrativeIntent(query);
  if (!intent || intent.usage || !intent.length || /\b\d{1,3}[ -]*(?:words|palavras|palabras)\b/i.test(query)) return null;
  const plain = text.replace(/\[([^\]]+)\]\(https?:[^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").trim();
  const words = plain.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  if (intent.length === "sentence") {
    const sentences = [...new Intl.Segmenter(intent.locale, { granularity: "sentence" }).segment(plain)];
    return sentences.length > 1 || /\n\s*\n|^#|^\*\*/.test(plain) || words > 45
      ? `The requested output is one concise sentence, but the draft has ${sentences.length} sentences and ${words} words or extra formatting.` : null;
  }
  const limit = intent.length === "30s" ? 80 : 150;
  return words > limit ? `The draft has ${words} words, exceeding the ${limit}-word maximum for this ${intent.length} pitch.` : null;
}
