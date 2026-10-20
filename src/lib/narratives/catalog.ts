import rawPitches from './pitches.json';
import spanish from './es.json';
import rawNarratives from './narratives.json';

export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof locales)[number];
export type Localized = Record<Locale, string>;
export const lengths = ['sentence', '30s', '60s'] as const;
export type PitchLength = (typeof lengths)[number];
export const reviewedAt = '2026-10-20';
export const localized = (en: string, pt: string): Localized => ({ en, 'pt-BR': pt, es: (spanish as Record<string, string>)[en] ?? en });
export const audiences = {
  beginners: localized('Beginners', 'Iniciantes'),
  bitcoin: localized('Bitcoin users', 'Quem conhece Bitcoin'),
  developers: localized('Developers', 'Desenvolvedores'),
  businesses: localized('Businesses', 'Negócios'),
  organizations: localized('Organizations', 'Organizações'),
};
export type Audience = keyof typeof audiences;
export const lengthLabels: Record<PitchLength, Localized> = {
  sentence: localized('One sentence', 'Uma frase'),
  '30s': localized('≈ 30 seconds', '≈ 30 segundos'),
  '60s': localized('≈ 60 seconds', '≈ 60 segundos'),
};
export type Narrative = {
  id: string; title: Localized; idea: Localized; context: Localized; fact: Localized; limit: Localized;
  examplePitch: string; next: { href: string; label: Localized };
};
export const narratives = rawNarratives as Narrative[];
export type Pitch = {
  id: string; theme: string; audiences: Audience[];
  kind: 'openzcash-editorial'; reviewStatus: 'reviewed'; reviewedAt: string;
  title: Localized; context: Localized; approach: Localized;
  translations: Record<Locale, Record<PitchLength, string>>;
};
export const pitches = rawPitches as Pitch[];
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function filterPitches({ locale, query = '', audience = '', theme = '' }: { locale: Locale; query?: string; audience?: string; theme?: string }) {
  const terms = normalize(query).trim().split(/\s+/);
  return pitches.filter(p => {
    const family = narratives.find(n => n.id === p.theme)!;
    const text = normalize([p.title[locale], p.context[locale], p.approach[locale], family.title[locale], ...p.audiences.map(a => audiences[a][locale]), ...Object.values(p.translations[locale])].join(' '));
    return (!audience || p.audiences.includes(audience as Audience)) && (!theme || p.theme === theme) && terms.every(t => text.includes(t));
  });
}
export type View = 'pitches' | 'narratives';
export function readState(params: URLSearchParams) {
  const locale: Locale = locales.includes(params.get('lang') as Locale) ? params.get('lang') as Locale : 'en';
  const length: PitchLength = lengths.includes(params.get('length') as PitchLength) ? params.get('length') as PitchLength : '30s';
  const view: View = params.get('view') === 'narratives' ? 'narratives' : 'pitches';
  return { locale, length, view, query: params.get('q') ?? '', audience: Object.hasOwn(audiences, params.get('audience') ?? '') ? params.get('audience')! : '', theme: narratives.some(n => n.id === params.get('theme')) ? params.get('theme')! : '' };
}
export function contentHref(id: string, locale: Locale, length: PitchLength = '30s', view: View = 'pitches') {
  return `/narratives?lang=${locale}&length=${length}&view=${view}#${view === 'narratives' ? 'narrative' : 'pitch'}-${id}`;
}
