// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NarrativesLibrary } from './narratives-library';

const state = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
afterEach(cleanup);

describe('OpenZcash editorial library', () => {
  it.each(['en', 'pt-BR', 'es'].flatMap(locale => ['pitches', 'narratives'].map(view => [locale, view])))('keeps the %s %s edition self-contained', (locale, view) => {
    state.query = `lang=${locale}&view=${view}`;
    const { container } = render(<NarrativesLibrary />);
    const links = [...container.querySelectorAll('a')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute('href')!;
      expect(href.startsWith('/') || href.startsWith('#')).toBe(true);
      expect(href.startsWith('//')).toBe(false);
      expect(link.getAttribute('target')).not.toBe('_blank');
    }
    expect(container.textContent).not.toMatch(/Editorial adaptation|Community contributions|Attribution in source|Factual basis|Referências|References/);
    expect(container.querySelectorAll(view === 'pitches' ? 'article[id^="pitch-"]' : 'article[id^="narrative-"]')).toHaveLength(view === 'pitches' ? 20 : 8);
  });
});
