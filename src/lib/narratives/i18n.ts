import spanish from './ui-es.json';
import type { Locale } from './catalog';

/** Keep UI translations independent of pitch records and preserve original source titles. */
export function message(locale: Locale, english: string, portuguese: string): string {
  if (locale === 'pt-BR') return portuguese;
  if (locale === 'es') return (spanish as Record<string, string>)[english] ?? english;
  return english;
}
