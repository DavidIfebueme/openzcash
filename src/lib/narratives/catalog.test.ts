import { describe, expect, it } from 'vitest';
import { audiences, contentHref, filterPitches, lengths, locales, narratives, pitches, readState, sources } from './catalog';
import { searchNarratives } from './search';
import { APPS, placeOf } from '../design-routes';
import { buildPalette, paletteRows } from '../palette';
const searchSite = (query: string) => paletteRows(buildPalette(APPS, query, false, searchNarratives(query)).groups);
import { readFileSync } from 'node:fs';
import spanishCatalog from './es.json';
import spanishUi from './ui-es.json';

describe('educational narrative catalog', () => {
  it('has complete reviewed translations, references and unique stable IDs', () => {
    expect(pitches).toHaveLength(20);
    expect(narratives).toHaveLength(8);
    expect(new Set(pitches.map(p => p.id)).size).toBe(pitches.length);
    for (const p of pitches) {
      expect(p.reviewStatus).toBe('reviewed');
      expect(p.kind).toBe('editorial-adaptation');
      expect(p.sourceCells.length).toBeGreaterThan(0);
      expect(narratives.some(n => n.id === p.theme)).toBe(true);
      for (const lang of locales) {
        expect(p.title[lang].length).toBeGreaterThan(0);
        for (const length of lengths) expect(p.translations[lang][length].length).toBeGreaterThan(30);
        expect(p.translations[lang]['60s'].length).toBeGreaterThan(p.translations[lang]['30s'].length);
      }
    }
    for (const n of narratives) {
      expect(pitches.some(p => p.id === n.examplePitch)).toBe(true);
      for (const id of n.sources) expect(sources.some(s => s.id === id)).toBe(true);
    }
  });
  it('includes every catalog and interface message in Spanish', () => {
    const catalog = readFileSync('src/lib/narratives/catalog.ts', 'utf8');
    const ui = readFileSync('src/components/narratives/narratives-library.tsx', 'utf8');
    const catalogKeys = [...catalog.matchAll(/localized\('([^']*)',/g)].map(match => match[1]);
    const uiKeys = [...ui.matchAll(/message\(locale, '([^']*)',/g)].map(match => match[1]);
    for (const key of catalogKeys) expect(Object.hasOwn(spanishCatalog, key), key).toBe(true);
    for (const key of uiKeys) expect(Object.hasOwn(spanishUi, key), key).toBe(true);
  });
  it('combines text, audience and theme filters, tolerates accents and returns genuine empty results', () => {
    expect(filterPitches({ locale: 'pt-BR', query: 'doacao', theme: 'freedom', audience: 'organizations' }).map(p => p.id)).toEqual(['donate-with-dignity', 'support-independent-work']);
    expect(filterPitches({ locale: 'en', query: 'zero-knowledge', audience: 'developers' }).length).toBeGreaterThan(0);
    expect(filterPitches({ locale: 'en', theme: 'disclosure', audience: 'bitcoin' })).toEqual([]);
    expect(filterPitches({ locale: 'en', query: 'no-such-pitch' })).toEqual([]);
  });
  it('offers at least one coherent reviewed combination for each audience', () => {
    for (const audience of Object.keys(audiences)) expect(filterPitches({ locale: 'en', audience }).length).toBeGreaterThan(0);
  });
  it('round-trips the language, length and section of shared links and rejects invalid URL state', () => {
    for (const locale of locales) for (const length of lengths) {
      const url = new URL(contentHref('cash-online', locale, length), 'https://openzcash.org');
      expect(url.hash).toBe('#pitch-cash-online');
      expect(readState(url.searchParams)).toMatchObject({ locale, length, view: 'pitches' });
    }
    expect(readState(new URLSearchParams('view=sources'))).toMatchObject({ view: 'pitches' });
    expect(readState(new URLSearchParams('lang=xx&length=123&view=bad&theme=bad&audience=toString'))).toMatchObject({ locale: 'en', length: '30s', view: 'pitches', theme: '', audience: '' });
  });
  it('finds all three editions through global search', () => {
    expect(searchSite('narratives').some(r => r.href === '/narratives')).toBe(true);
    expect(searchSite('zero-knowledge').some(r => r.href.includes('lang=en'))).toBe(true);
    expect(searchSite('conhecimento zero').some(r => r.href.includes('lang=pt-BR'))).toBe(true);
    expect(searchSite('conocimiento cero').some(r => r.href.includes('lang=es'))).toBe(true);
    expect(searchSite('selective disclosure').some(r => r.href.includes('#narrative-disclosure'))).toBe(true);
  });
  it('places Narratives before Monthly in the shared navigation and resolves its breadcrumb', () => {
    const index = APPS.findIndex(app => app.id === 'narratives');
    expect(APPS[index + 1].id).toBe('monthly');
    expect(placeOf('/narratives')?.app.id).toBe('narratives');
  });
  it('does not load examples into empty search and counts matching examples as results', () => {
    expect(searchNarratives('')).toEqual([]);
    expect(buildPalette([], 'conocimiento cero', false, searchNarratives('conocimiento cero')).noMatch).toBe(false);
  });
});
