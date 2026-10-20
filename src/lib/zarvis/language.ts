import type { ZarvisSession } from "./session";
import type { ChatMessage } from "./types";

/** The languages with deterministic templates: every direct answer, badge and fallback exists in all three. */
export type DirectLanguage = "en" | "pt" | "es";
export type AnswerLanguage = DirectLanguage | "other";
export type Texts<T> = { en: T; pt?: T; es?: T };
/** The template for a direct language; English is the interface language and the fallback for any template that lacks a translation. */
export const pick = <T>(language: DirectLanguage, texts: Texts<T>): T => texts[language] ?? texts.en;
/** Intl locales for the direct languages: Latin-American Spanish keeps the dot decimal and comma grouping of the site's figures. */
export const LOCALES: Record<DirectLanguage, string> = { en: "en-US", pt: "pt-BR", es: "es-419" };
export const locale = (language: DirectLanguage): string => LOCALES[language];
/** A language other than the three with templates falls back to English, the interface language. */
export const directLanguage = (language: AnswerLanguage): DirectLanguage => language === "other" ? "en" : language;

/** Accents, case, curly apostrophes, question and exclamation marks (including Spanish ¿¡) and sentence punctuation are removed; a decimal or grouping separator between digits is kept. */
export const normalizeQuestion = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("’", "'").replace(/[?!¿¡]/g, "").replace(/[.,](?!\d)/g, "").replace(/\s+/g, " ").trim();

/** Function words weigh 2 and the few domain nouns the direct templates accept weigh 1, so "Como funciona a viewing key?" is Portuguese. A word may count for several languages: everyday Portuguese that is also Spanish (se, vale, pago, use, usar, sobre, por, dólares) is in both lists so a tie falls to Portuguese, except "se" and "usa", which open the Spanish preferences "sé breve" and "usa dólares" and therefore count only 1 for Portuguese: enough for "Como se usa uma viewing key?" (6–6) and "Ela usa dólares?" (4–3), not enough to flip "Sé breve" or "Usa dólares" (2–3). */
const FUNCTION_WORD = 2, DOMAIN_NOUN = 1;
const words = {
  en: ["what whats how the is are does do did and or in of for to an it its my this that these those where which who when with about much many can could should will was were has have had not no yes hi hello thanks thank explain today now on at by from as into up out over use write draft rewrite shorten adapt craft prepare create give", "a price latest current treasury balance balances holdings paid grants viewing key keys"],
  pt: ["como onde quais qual quanto quantos quanta quantas sao esta estao foi tem ha dizem mostram que de do da dos das um uma o a os as para com nao e em no na nos nas ao aos por mais sim ola oi obrigado obrigada valeu explique pagou pagaram custa hoje agora ultimo ultima atual atuais quando ela ele pode meus minha meu isso esse essa vale pago use usar sobre", "saldo saldos dados preco cotacao tesouro tesouraria carteiras chave chaves cenario cenarios vezes limitacoes breve respostas dolares se usa"],
  es: ["como donde cuales cual cuanto cuantos cuanta cuantas es son esta estan fue tiene tienen hay dicen muestran que de del al a un una el los las la para con no y en si hola buenas gracias muchas explica explicame dime cuesta vale hoy ahora ultimo ultima actual actuales cuando puede puedes podrias mis mi eso ese esa responde contesta usa llamada reunion pagado pago gastado desembolsado se significa quiere decir hablame cuentame sobre por", "saldo saldos datos precio cotizacion tesoreria carteras billetera billeteras clave claves escenario escenarios subvenciones subvencion propuesta propuestas dolares espanol breve respuestas"],
  fr: ["comment ou quel quelle quels quelles combien est sont sera disent montrent que de du des un une le les la pour avec pas ne et en dans sur oui bonjour merci coute aujourd'hui maintenant dernier derniere actuel actuelle quand peut mes mon ma cela ce cette", "solde donnees prix cours tresorerie portefeuille cle cles scenario"],
} as const;
type Known = keyof typeof words;
const lexicon = Object.fromEntries(Object.entries(words).map(([language, [functionWords, nouns]]) => [language,
  new Map([...functionWords.split(" ").map((w) => [w, FUNCTION_WORD] as const), ...nouns.split(" ").map((w) => [w, DOMAIN_NOUN] as const)])])) as Record<Known, Map<string, number>>;

/** Marks Portuguese never writes: the inverted question and exclamation marks and the letter ñ (compared before normalisation strips them). */
const SPANISH_MARK = /[¿¡ñÑ]/;
/** The language of one turn when its own words decide it. Wordless turns ("2025", "ZIP 317") and ties involving English ("Zashi on OS") return undefined; a tie between Portuguese and Spanish or French ("Saldo ZCG", "Último ZIP") goes to Portuguese, as before Spanish had templates, unless the raw text carries ¿, ¡ or ñ ("¿Último ZIP?"); Spanish wins outright ("¿Cuál es el precio del ZEC?", "¿Qué significa ZCG?") or ties only with French. */
export function questionLanguage(question: string): AnswerLanguage | undefined {
  const tokens = normalizeQuestion(question).split(" ").filter(Boolean);
  const ranked = (Object.keys(lexicon) as Known[]).map((language) => [language, tokens.reduce((score, token) => score + (lexicon[language].get(token) ?? 0), 0)] as const).sort((a, b) => b[1] - a[1]);
  const best = ranked[0][1];
  if (!best) return;
  const tied = ranked.filter(([, score]) => score === best).map(([language]) => language);
  if (tied.includes("en")) return tied.length === 1 ? "en" : undefined;
  if (tied.includes("pt") && tied.includes("es") && SPANISH_MARK.test(question)) return "es";
  return tied.includes("pt") ? "pt" : tied.includes("es") ? "es" : "other";
}

/** Explicit output-language requests inside a writing/translation command, not a passing mention of a language. */
export function requestedOutputLanguage(question: string): "en" | "pt" | "es" | "fr" | undefined {
  const q = normalizeQuestion(question);
  if (!/^(?:(?:please|por favor) )?(?:(?:now|agora|ahora) )?(?:answer|reply|respond|responda|responde|respondeme|contesta|contestame|write|draft|prepare|create|craft|give me|faca|faz|haz|haga|quero|quiero|rewrite|adapt|translate|crie|escreva|redija|reescreva|adapte|traduza|escribe|redacta|reescribe|adapta|traduce)\b/.test(q)) return;
  const match = [...q.matchAll(/\b(?:in|em|en|to|para(?: o)?) (english|ingles|portuguese|portugues|spanish|espanhol|espanol|french|frances)\b/g)].at(-1);
  if (!match) return;
  return ({ english: "en", ingles: "en", portuguese: "pt", portugues: "pt", spanish: "es", espanhol: "es", espanol: "es", french: "fr", frances: "fr" } as const)[match[1] as "english"];
}

/** An explicit stored preference wins; otherwise the latest decisive user turn, so short follow-ups keep the language of the question they continue. */
export function answerLanguage(messages: ChatMessage[], session: ZarvisSession = {}): AnswerLanguage {
  if (session.language) return session.language === "fr" ? "other" : session.language;
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const language = questionLanguage(message.content);
    if (language) return language;
  }
  return "en";
}
