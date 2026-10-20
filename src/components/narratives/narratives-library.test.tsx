// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NarrativesLibrary } from './narratives-library';

const state = vi.hoisted(() => ({ query: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
  it('selects pitches, exposes the print action and clears the selection', () => {
    state.query = 'lang=en&view=pitches';
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container, getByRole, queryByRole } = render(<NarrativesLibrary />);
    const first = getByRole('checkbox', { name: 'Select for printing: Send the money. Keep your space.' });
    const second = getByRole('checkbox', { name: 'Select for printing: Keep the open network. Rethink the exposure.' });
    expect(queryByRole('button', { name: /Print selected/ })).toBeNull();
    fireEvent.click(first);
    expect(getByRole('button', { name: 'Print selected (1)' })).toBeTruthy();
    fireEvent.click(second);
    expect((first as HTMLInputElement).checked).toBe(true);
    expect((second as HTMLInputElement).checked).toBe(true);
    const output = container.querySelector('section[aria-label="Pitches selected for printing"]')!;
    expect(within(output as HTMLElement).getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      'Send the money. Keep your space.', 'Keep the open network. Rethink the exposure.',
    ]);
    fireEvent.click(getByRole('button', { name: 'Print selected (2)' }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(getByRole('button', { name: 'Clear selection' }));
    expect(queryByRole('button', { name: /Print selected/ })).toBeNull();
    expect((first as HTMLInputElement).checked).toBe(false);
    expect((second as HTMLInputElement).checked).toBe(false);
  });

});
