'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { audiences, contentHref, filterPitches, lengthLabels, lengths, locales, narratives, pitches, readState, reviewedAt, sources, cellUrl, type Locale, type Pitch, type PitchLength, type View } from '@/lib/narratives/catalog';
import styles from './narratives.module.css';
import { message } from '@/lib/narratives/i18n';

function LibraryIcon({ kind = 'book' }: { kind?: 'book' | 'copy' | 'link' | 'search' | 'arrow' }) {
  const paths = {
    book: <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" /><path d="M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 8V4H4v11h4" /></>,
    link: <><path d="m10 13 4-4M8 15l-1 1a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m0 10a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-1 1" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function CopyButton({ text, locale, link = false }: { text: string; locale: Locale; link?: boolean }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(link ? new URL(text, window.location.origin).href : text);
      setResult('copied');
    } catch { setResult('failed'); }
  }
  return <span className={styles.copy}>
    <button type="button" className={link ? styles.linkButton : styles.copyButton} onClick={copy}><LibraryIcon kind={link ? 'link' : 'copy'} />{result === 'copied' ? (message(locale, 'Copied ✓', 'Copiado ✓')) : link ? (message(locale, 'Copy link', 'Copiar link')) : (message(locale, 'Copy text', 'Copiar texto'))}</button>
    <span className={styles.srOnly} role="status">{result === 'copied' ? (message(locale, 'Copied to clipboard.', 'Copiado para a área de transferência.')) : ''}</span>
    {result === 'failed' && <span role="status" className={styles.copyError}>{message(locale, 'Clipboard unavailable. Select and copy manually:', 'Cópia indisponível. Selecione e copie manualmente:')}<input readOnly aria-label={message(locale, 'Text to copy', 'Texto para copiar')} value={link && typeof window !== 'undefined' ? new URL(text, window.location.origin).href : text} onFocus={e => e.target.select()} /></span>}
  </span>;
}

function SourceLinks({ pitch, locale }: { pitch: Pitch; locale: Locale }) {
  const family = narratives.find(n => n.id === pitch.theme)!;
  return <div className={styles.provenance}>
    <p><strong>{message(locale, 'Editorial adaptation', 'Adaptação editorial')}</strong> · {message(locale, 'Community contributions', 'Contribuições da comunidade')} {pitch.sourceCells.map(cell => <a key={cell} href={cellUrl(cell)} target="_blank" rel="noopener noreferrer">{cell} ↗</a>)}</p>
    <p>{pitch.author ? `${message(locale, 'Attribution in source', 'Autoria indicada na fonte')}: ${pitch.author}` : message(locale, 'No author specified in the contributions used.', 'Autoria não indicada nas contribuições utilizadas.')}</p>
    <p>{message(locale, 'Factual basis', 'Base factual')}: {family.sources.map(id => { const source = sources.find(s => s.id === id)!; return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>; })}</p>
  </div>;
}

function InlineReferences({ pitch, locale }: { pitch: Pitch; locale: Locale }) {
  const family = narratives.find(n => n.id === pitch.theme)!;
  const labels: Record<string, string> = {
    use: message(locale, 'Payment guide', 'Guia de pagamentos'),
    shielded: message(locale, 'Shielded payments', 'Pagamentos shielded'),
    privacy: message(locale, 'Privacy guide', 'Guia de privacidade'),
    proofs: message(locale, 'Zero-knowledge proofs', 'Provas de conhecimento zero'),
    protocol: message(locale, 'Protocol', 'Protocolo'),
    supply: message(locale, 'Supply rules', 'Regras de emissão'),
    keys: message(locale, 'Viewing keys', 'Chaves de visualização'),
    learn: message(locale, 'Learn Zcash', 'Aprenda sobre Zcash'),
  };
  return <div className={styles.inlineReferences} aria-label={message(locale, 'References for this example', 'Referências deste exemplo')}>
    <span>{message(locale, 'References', 'Referências')}</span>
    {family.sources.map(id => { const source = sources.find(s => s.id === id)!; return <a key={id} href={source.url} title={source.title} target="_blank" rel="noopener noreferrer">{labels[id] ?? source.title} ↗</a>; })}
    <span className={styles.communityReferences}>{message(locale, 'Community', 'Comunidade')} {pitch.sourceCells.map(cell => <a key={cell} href={cellUrl(cell)} target="_blank" rel="noopener noreferrer">{cell} ↗</a>)}</span>
  </div>;
}

function PitchCard({ pitch, locale, length, selected, onSelect, compact = false }: { pitch: Pitch; locale: Locale; length: PitchLength; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const family = narratives.find(n => n.id === pitch.theme)!;
  return <article id={compact ? undefined : `pitch-${pitch.id}`} className={styles.card}>
    <div className={styles.cardMeta}><span className={styles.cardIndex}>{String(pitches.indexOf(pitch) + 1).padStart(2, '0')}</span><span>{pitch.audiences.map(a => audiences[a][locale]).join(' · ')}</span><span className={styles.cardLength}>{lengthLabels[length][locale]}</span></div>
    <h3><Link href={contentHref(pitch.id, locale, length)}>{pitch.title[locale]}</Link></h3>
    <p className={styles.pitchText}>{pitch.translations[locale][length]}</p>
    <div className={styles.actions}>
      <CopyButton key={`${pitch.id}-${locale}-${length}`} text={pitch.translations[locale][length]} locale={locale} />
      <CopyButton key={`link-${pitch.id}-${locale}-${length}`} text={contentHref(pitch.id, locale, length)} locale={locale} link />
      {onSelect && <label className={styles.check}><input type="checkbox" checked={selected} onChange={onSelect} />{message(locale, 'Print', 'Imprimir')}</label>}
    </div>
    <details className={styles.details}>
      <summary>{message(locale, 'Context & limits', 'Contexto e cuidados')}</summary>
      <p><strong>{message(locale, 'When to use', 'Quando usar')}.</strong> {pitch.context[locale]}</p>
      <p><strong>{message(locale, 'Approach', 'Abordagem')}.</strong> {pitch.approach[locale]}</p>
      <p><strong>{message(locale, 'Limits', 'Limites')}.</strong> {family.limit[locale]}</p>
      <SourceLinks pitch={pitch} locale={locale} />
      <Link href={contentHref(family.id, locale, length, 'narratives')}>{family.title[locale]} →</Link>
    </details>
    <InlineReferences pitch={pitch} locale={locale} />
  </article>;
}

function PreparePitch({ locale, length }: { locale: Locale; length: PitchLength }) {
  const [audience, setAudience] = useState('beginners');
  const [theme, setTheme] = useState('cash');
  const [language, setLanguage] = useState(locale);
  const [duration, setDuration] = useState(length);
  const [exampleId, setExampleId] = useState('');
  const available = narratives.filter(n => pitches.some(p => p.theme === n.id && p.audiences.some(a => a === audience)));
  const matches = filterPitches({ locale: language, audience, theme });
  const result = matches.find(p => p.id === exampleId) ?? matches[0];
  return <details className={styles.prepare}>
    <summary>{message(locale, 'Prepare your pitch', 'Prepare seu pitch')} <span>{message(locale, 'A reviewed version for your audience', 'Uma versão revisada para o seu público')}</span></summary>
    <p>{message(locale, 'Choose from the available combinations. The result is a reviewed editorial text, ready for you to adapt.', 'Escolha entre as combinações disponíveis. O resultado é um texto editorial revisado, pronto para você adaptar.')}</p>
    <div className={styles.filters}>
      <label>{message(locale, 'Audience', 'Público')}<select value={audience} onChange={e => { setAudience(e.target.value); if (!pitches.some(p => p.theme === theme && p.audiences.some(a => a === e.target.value))) setTheme(pitches.find(p => p.audiences.some(a => a === e.target.value))!.theme); }}>{Object.entries(audiences).map(([id, label]) => <option key={id} value={id}>{label[locale]}</option>)}</select></label>
      <label>{message(locale, 'Available theme', 'Tema disponível')}<select value={theme} onChange={e => setTheme(e.target.value)}>{available.map(n => <option key={n.id} value={n.id}>{n.title[locale]}</option>)}</select></label>
      <label>{message(locale, 'Text language', 'Idioma do texto')}<select value={language} onChange={e => setLanguage(e.target.value as Locale)}>{locales.map(l => <option key={l} value={l}>{l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Português brasileiro'}</option>)}</select></label>
      <label>{message(locale, 'Text length', 'Extensão do texto')}<select value={duration} onChange={e => setDuration(e.target.value as PitchLength)}>{lengths.map(l => <option key={l} value={l}>{lengthLabels[l][locale]}</option>)}</select></label>
    </div>
    {matches.length > 1 && <label className={styles.exampleSelect}>{message(locale, 'Example', 'Exemplo')}<select value={result.id} onChange={e => setExampleId(e.target.value)}>{matches.map(p => <option key={p.id} value={p.id}>{p.title[language]}</option>)}</select></label>}
    <div aria-live="polite" lang={language}>{result && <PitchCard compact pitch={result} locale={language} length={duration} />}</div>
  </details>;
}

export function NarrativesLibrary() {
  const params = useSearchParams();
  const state = readState(params);
  const { locale, length, view, query, audience, theme } = state;
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const results = filterPitches({ locale, query, audience, theme });
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    window.history.replaceState(null, '', `/narratives?${next}`);
  }
  const tabs: [View, string][] = [['pitches', 'Pitches'], ['narratives', message(locale, 'Narratives', 'Narrativas')]];
  return <div lang={locale} className={styles.page}>
    <div className={styles.screen}>
      <div className={styles.masthead}>
        <PageHeader title="Zcash Pitches & Narratives" subtitle={message(locale, 'Clear ways to explain Zcash.', 'Formas claras de explicar Zcash.')} actions={<label className={styles.language}><span className={styles.srOnly}>{message(locale, 'Language', 'Idioma')}</span><select value={locale} onChange={e => update({ lang: e.target.value })}>{locales.map(l => <option key={l} value={l}>{l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Português brasileiro'}</option>)}</select></label>} />
      </div>
      <section className={styles.featured} aria-label={message(locale, 'Start with an idea', 'Comece com uma ideia')}>
        <div className={styles.quoteMark} aria-hidden="true">“</div>
        <div className={styles.featuredContent}>
          <span className={styles.eyebrow}>{message(locale, 'Start with an idea', 'Comece com uma ideia')}</span>
          <p>{pitches[0].translations[locale].sentence}</p>
          <Link href={contentHref('cash-online', locale)}>{message(locale, 'Explore the explanation', 'Explorar a explicação')} <LibraryIcon kind="arrow" /></Link>
        </div>
        <CopyButton key={locale} text={pitches[0].translations[locale].sentence} locale={locale} />
      </section>
      <nav className={styles.tabs} aria-label={message(locale, 'Library sections', 'Áreas da biblioteca')}>{tabs.map(([id, name]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => update({ view: id })}>{name}<span className={styles.tabCount}>{id === 'pitches' ? pitches.length : narratives.length}</span></button>)}</nav>
      {view === 'pitches' && <section aria-label={message(locale, 'Pitch library', 'Biblioteca de pitches')}>
        <h2 className={styles.srOnly}>{message(locale, 'Pitch library', 'Biblioteca de pitches')}</h2>
        <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label={message(locale, 'Filter pitches', 'Filtrar pitches')}>
          <label className={styles.search}><span className={styles.srOnly}>{message(locale, 'Search the library', 'Buscar na biblioteca')}</span><LibraryIcon kind="search" /><input type="search" value={query} onChange={e => update({ q: e.target.value })} placeholder={message(locale, 'Search the library', 'Buscar na biblioteca')} /></label>
          <button className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="pitch-filters" onClick={() => setFiltersOpen(!filtersOpen)}>{message(locale, 'Filter pitches', 'Filtrar pitches')}<span>{filtersOpen ? '−' : '+'}</span></button>
          <div className={styles.filterPanel} id="pitch-filters" data-open={filtersOpen}>
            <fieldset className={styles.audienceList}><legend>{message(locale, 'Audience', 'Público')}</legend>
              {[['', message(locale, 'All audiences', 'Todos os públicos')], ...Object.entries(audiences).map(([id, label]) => [id, label[locale]])].map(([id, label]) => <label key={id} data-checked={audience === id}><input type="radio" name="pitch-audience" value={id} checked={audience === id} onChange={() => update({ audience: id })} /><span>{label}</span><span className={styles.audienceCount}>{filterPitches({ locale, audience: id }).length}</span></label>)}
            </fieldset>
            <div className={styles.filters}>
              <label>{message(locale, 'Theme', 'Tema')}<select value={theme} onChange={e => update({ theme: e.target.value })}><option value="">{message(locale, 'All themes', 'Todos os temas')}</option>{narratives.map(n => <option key={n.id} value={n.id}>{n.title[locale]}</option>)}</select></label>
              <label>{message(locale, 'Length', 'Extensão')}<select value={length} onChange={e => update({ length: e.target.value })}>{lengths.map(l => <option key={l} value={l}>{lengthLabels[l][locale]}</option>)}</select></label>
            </div>
          </div>
        </aside>
        <div className={styles.results}>
        <PreparePitch key={locale} locale={locale} length={length} />
        <div className={styles.resultBar}><span className={styles.resultCount} role="status">{results.length} {results.length === 1 ? message(locale, 'pitch found', 'pitch encontrado') : message(locale, 'pitches found', 'pitches encontrados')}</span><div className={styles.actions}>{(query || audience || theme) && <button onClick={() => update({ q: '', audience: '', theme: '' })}>{message(locale, 'Clear filters', 'Limpar filtros')}</button>}{selected.length > 0 && <button onClick={() => window.print()}>{message(locale, 'Print selected', 'Imprimir selecionados')} ({selected.length})</button>}{selected.length > 0 && <button onClick={() => setSelected([])}>{message(locale, 'Clear selection', 'Limpar seleção')}</button>}</div></div>
        <div className={styles.grid}>{results.map(pitch => <PitchCard key={pitch.id} pitch={pitch} locale={locale} length={length} selected={selected.includes(pitch.id)} onSelect={() => setSelected(current => current.includes(pitch.id) ? current.filter(id => id !== pitch.id) : [...current, pitch.id])} />)}</div>
        {!results.length && <div className={styles.empty}><h3>{message(locale, 'No pitches match this combination.', 'Nenhum pitch nesta combinação.')}</h3><p>{message(locale, 'Try another theme or remove a filter.', 'Experimente outro tema ou remova um filtro.')}</p><button onClick={() => update({ q: '', audience: '', theme: '' })}>{message(locale, 'Show all pitches', 'Ver todos os pitches')}</button></div>}
        <p className={styles.footnote}>{message(locale, 'Speaking times are approximate. All three lengths have been reviewed; read aloud and adapt to your pace.', 'Tempos de fala são aproximados. As três extensões foram revisadas; leia em voz alta e adapte ao seu ritmo.')}</p>
        </div>
        </div>
      </section>}
      {view === 'narratives' && <section aria-label={message(locale, 'Educational narratives', 'Narrativas educativas')}>
        <div className={styles.libraryHeading}><h2>{message(locale, 'Eight ways into the conversation', 'Oito maneiras de começar')}</h2></div>
        <p>{message(locale, 'There is no universal approach. Choose the idea that helps your audience and make its limits clear.', 'Não há uma abordagem universal. Escolha a ideia que ajuda seu público e deixe seus limites claros.')}</p>
        <div className={styles.narrativeList}>{narratives.map((n, index) => { const example = pitches.find(p => p.id === n.examplePitch)!; return <article className={styles.narrative} key={n.id} id={`narrative-${n.id}`}>
          <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
          <div><h3><Link href={contentHref(n.id, locale, length, 'narratives')}>{n.title[locale]}</Link></h3><p className={styles.idea}>{n.idea[locale]}</p><p><strong>{message(locale, 'Context', 'Contexto')}.</strong> {n.context[locale]}</p>
            <blockquote>{example.translations[locale].sentence}</blockquote>
            <details className={styles.details}><summary>{message(locale, 'Expanded example', 'Exemplo expandido')}</summary><p>{example.translations[locale]['60s']}</p><SourceLinks pitch={example} locale={locale} /></details>
            <p><strong>{message(locale, 'Factual basis', 'Base factual')}.</strong> {n.fact[locale]}</p>
            <p className={styles.limit}><strong>{message(locale, 'Limits of the analogy', 'Limites da analogia')}.</strong> {n.limit[locale]}</p>
            <InlineReferences pitch={example} locale={locale} />
            {pitches.some(p => p.theme === n.id && p.id !== example.id) && <div className={styles.relatedExamples}><span>{message(locale, 'More examples', 'Mais exemplos')}</span><div>{pitches.filter(p => p.theme === n.id && p.id !== example.id).map(p => <article key={p.id}><Link href={contentHref(p.id, locale, length)}>{p.title[locale]} →</Link><p>{p.translations[locale].sentence}</p></article>)}</div></div>}
            <div className={styles.actions}><Link href={n.next.href.startsWith('/narratives') ? `/narratives?lang=${locale}&length=60s&view=pitches` : n.next.href} target={n.next.href.startsWith('https://') ? '_blank' : undefined} rel={n.next.href.startsWith('https://') ? 'noopener noreferrer' : undefined}>{n.next.label[locale]} {n.next.href.startsWith('https://') ? '↗' : '→'}</Link><CopyButton locale={locale} link text={contentHref(n.id, locale, length, 'narratives')} /></div>
          </div>
        </article>; })}</div>
      </section>}
      <details className={styles.glossary}><summary><LibraryIcon />{message(locale, 'About this library', 'Sobre esta biblioteca')}</summary>
      <dl className={styles.definitions}>
        <div><dt>Pitch</dt><dd>{message(locale, 'A short introduction that opens a conversation.', 'Uma apresentação curta que abre uma conversa.')}</dd></div>
        <div><dt>{message(locale, 'Narrative', 'Narrativa')}</dt><dd>{message(locale, 'The broader idea that gives the technology meaning.', 'A ideia mais ampla que dá significado à tecnologia.')}</dd></div>
        <div><dt>{message(locale, 'Evidence', 'Evidência')}</dt><dd>{message(locale, 'The mechanism or record that supports a claim.', 'O funcionamento ou registro que sustenta uma afirmação.')}</dd></div>
      </dl>
      <p>{message(locale, 'Every pitch on this page is adapted and translated; these are not verbatim quotations.', 'Todos os pitches desta página foram adaptados e traduzidos; não são citações literais.')}</p>
      <p>{message(locale, 'Scenarios are illustrative examples, not reports of real transactions.', 'As situações são exemplos ilustrativos, não relatos de transações reais.')}</p>
      <a href={sources.find(s => s.id === 'document')!.url} target="_blank" rel="noopener noreferrer">{sources.find(s => s.id === 'document')!.title} ↗</a>
      </details>
      <footer className={styles.footer}>{message(locale, 'Editorial selection and adaptations · reviewed October 20, 2026 · share with context.', 'Seleção e adaptações editoriais · revisão de 20/10/2026 · compartilhe com contexto.')}</footer>
    </div>
    <section className={styles.print} aria-label={message(locale, 'Pitches selected for printing', 'Pitches selecionados para impressão')}>
      <h1>Zcash Pitches & Narratives</h1><p>OpenZcash · {reviewedAt} · {locale}</p>
      {!selected.length && <p>{message(locale, 'Select pitches in the library before printing.', 'Selecione pitches na biblioteca antes de imprimir.')}</p>}
      {pitches.filter(p => selected.includes(p.id)).map(p => <article key={p.id}><h2>{p.title[locale]}</h2><p>{p.translations[locale][length]}</p><p>{narratives.find(n => n.id === p.theme)!.limit[locale]}</p><SourceLinks pitch={p} locale={locale} /><p>https://openzcash.org{contentHref(p.id, locale, length)}</p></article>)}
    </section>
  </div>;
}
