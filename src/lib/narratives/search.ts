import { audiences, contentHref, locales, narratives, normalize, pitches } from './catalog';
import type { PaletteGroup } from '@/lib/palette';

const entries = locales.flatMap(locale => [
  ...pitches.map(p => ({ label: `${p.title[locale]} · ${locale}`, href: contentHref(p.id, locale), text: [p.title[locale], ...Object.values(p.translations[locale]), ...p.audiences.map(a => audiences[a][locale])].join(' ') })),
  ...narratives.map(n => ({ label: `${n.title[locale]} · ${locale}`, href: contentHref(n.id, locale, '30s', 'narratives'), text: [n.title[locale], n.idea[locale], n.context[locale], n.fact[locale]].join(' ') })),
]);

/** Loaded only when global search opens; the full catalog is not in the shell bundle. */
export function searchNarratives(query: string): PaletteGroup[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows = entries.filter(entry => words.every(word => normalize(entry.text).includes(word)))
    .slice(0, 20).map(({ href, label }) => ({ href, label }));
  return rows.length ? [{ id: 'narrative-content', label: 'Pitches & narratives', rows }] : [];
}
