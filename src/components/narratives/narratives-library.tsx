'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { audiences, contentHref, filterPitches, lengthLabels, lengths, locales, narratives, pitches, readState, reviewedAt, type Locale, type Pitch, type PitchLength, type View } from '@/lib/narratives/catalog';
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
      <summary>{message(locale, 'Make it your own', 'Leve para sua conversa')}</summary>
      <p><strong>{message(locale, 'When to use', 'Quando usar')}.</strong> {pitch.context[locale]}</p>
      <p><strong>{message(locale, 'Core idea', 'Ideia central')}.</strong> {pitch.approach[locale]}</p>
      <p><strong>{message(locale, 'Keep in mind', 'Vale lembrar')}.</strong> {family.limit[locale]}</p>
      <Link href={contentHref(family.id, locale, length, 'narratives')}>{family.title[locale]} →</Link>
    </details>
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
    <summary>{message(locale, 'Prepare your pitch', 'Prepare seu pitch')} <span>{message(locale, 'Find the right words for your audience', 'Encontre as palavras para seu público')}</span></summary>
    <p>{message(locale, 'Choose who you are speaking to and how much time you have. Start with an example, then bring your own voice.', 'Escolha com quem vai falar e quanto tempo você tem. Comece com um exemplo e acrescente sua voz.')}</p>
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
        <div className={styles.libraryHeading}><h2>{message(locale, 'A reason to care. A way to explain.', 'Um motivo para se importar. Um jeito de explicar.')}</h2></div>
        <p>{message(locale, 'Start with what matters to the person in front of you. These eight perspectives connect Zcash to everyday life.', 'Comece pelo que importa para quem está à sua frente. Estas oito perspectivas conectam Zcash à vida cotidiana.')}</p>
        <nav className={styles.narrativeIndex} aria-label={message(locale, 'Explore the ideas', 'Explore as ideias')}>
          {narratives.map((n, index) => <a key={n.id} href={`#narrative-${n.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{n.title[locale]}</a>)}
        </nav>
        <div className={styles.narrativeList}>{narratives.map((n, index) => {
          const example = pitches.find(p => p.id === n.examplePitch)!;
          return <article className={styles.narrative} key={n.id} id={`narrative-${n.id}`}>
            <header className={styles.narrativeHeader}>
              <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
              <h3>{n.title[locale]}</h3>
              <p className={styles.idea}>{n.idea[locale]}</p>
              <p className={styles.narrativeAudience}>{n.context[locale]}</p>
            </header>
            <div className={styles.narrativeBody}>
              <div className={styles.opening}>
                <span className={styles.eyebrow}>{message(locale, 'Try this opening', 'Comece por aqui')}</span>
                <p>{example.translations[locale].sentence}</p>
                <CopyButton key={`${n.id}-${locale}`} text={example.translations[locale].sentence} locale={locale} />
              </div>
              <details className={styles.conversation}>
                <summary>{message(locale, 'Build on the idea', 'Desenvolva a ideia')}<span aria-hidden="true">+</span></summary>
                {example.translations[locale]['60s'].split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                <CopyButton key={`long-${n.id}-${locale}`} text={example.translations[locale]['60s']} locale={locale} />
              </details>
              <div className={styles.narrativeNotes}>
                <div><h4>{message(locale, 'How it works', 'Como funciona')}</h4><p>{n.fact[locale]}</p></div>
                <div><h4>{message(locale, 'Keep in mind', 'Vale lembrar')}</h4><p>{n.limit[locale]}</p></div>
              </div>
              {pitches.some(p => p.theme === n.id && p.id !== example.id) && <div className={styles.relatedExamples}><h4>{message(locale, 'Another way in', 'Outras formas de começar')}</h4><div>{pitches.filter(p => p.theme === n.id && p.id !== example.id).map(p => <Link key={p.id} href={contentHref(p.id, locale, length)}>{p.title[locale]}<LibraryIcon kind="arrow" /></Link>)}</div></div>}
              <div className={styles.narrativeActions}>
                <Link href={n.next.href.startsWith('/narratives') ? `/narratives?lang=${locale}&length=sentence&view=pitches` : n.next.href}>{n.next.label[locale]} <LibraryIcon kind="arrow" /></Link>
                <CopyButton locale={locale} link text={contentHref(n.id, locale, length, 'narratives')} />
              </div>
            </div>
          </article>;
        })}</div>
      </section>}
      <details className={styles.glossary}><summary><LibraryIcon />{message(locale, 'About this library', 'Sobre esta biblioteca')}</summary>
      <dl className={styles.definitions}>
        <div><dt>Pitch</dt><dd>{message(locale, 'A short introduction that opens a conversation.', 'Uma apresentação curta que abre uma conversa.')}</dd></div>
        <div><dt>{message(locale, 'Narrative', 'Narrativa')}</dt><dd>{message(locale, 'The broader idea that gives the technology meaning.', 'A ideia mais ampla que dá significado à tecnologia.')}</dd></div>
        <div><dt>{message(locale, 'Your voice', 'Sua voz')}</dt><dd>{message(locale, 'Use these starting points to explain the idea in words that feel natural to you.', 'Use estes pontos de partida para explicar a ideia com palavras que soem naturais para você.')}</dd></div>
      </dl>
      <p>{message(locale, 'Written for OpenZcash to make conversations about private digital money clearer, more useful and more human.', 'Textos escritos para o OpenZcash para tornar conversas sobre dinheiro digital privado mais claras, úteis e humanas.')}</p>
      <p>{message(locale, 'Scenarios are illustrative examples, not reports of real transactions.', 'As situações são exemplos ilustrativos, não relatos de transações reais.')}</p>
      </details>
      <footer className={styles.footer}>{message(locale, 'OpenZcash · Ideas worth explaining. Privacy worth understanding.', 'OpenZcash · Ideias que vale explicar. Privacidade que vale entender.')}</footer>
    </div>
    <section className={styles.print} aria-label={message(locale, 'Pitches selected for printing', 'Pitches selecionados para impressão')}>
      <h1>Zcash Pitches & Narratives</h1><p>OpenZcash · {reviewedAt} · {locale}</p>
      {!selected.length && <p>{message(locale, 'Select pitches in the library before printing.', 'Selecione pitches na biblioteca antes de imprimir.')}</p>}
      {pitches.filter(p => selected.includes(p.id)).map(p => <article key={p.id}><h2>{p.title[locale]}</h2><p>{p.translations[locale][length]}</p><p>{narratives.find(n => n.id === p.theme)!.limit[locale]}</p><p>https://openzcash.org{contentHref(p.id, locale, length)}</p></article>)}
    </section>
  </div>;
}
