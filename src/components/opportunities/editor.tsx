"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BASE, platformFor } from "./catalog";
import { CoverPicker } from "./cover-picker";
import { resolveCover, stockCoverUrl } from "./covers";
import { Field, Heading, PlatformMark } from "./components";
import { Icon, Illustration } from "./visuals";
import { countries, languages } from "./locales";
import { emptyPreparation, preparationText, validatePreparation, type Preparation, type PublishingPlatform } from "./preparation";

export function Editor({ initialProvider }: { initialProvider?: PublishingPlatform }) {
  const [provider, setProvider] = useState<PublishingPlatform>(initialProvider || "zec-bounties");
  const [drafts, setDrafts] = useState<Record<PublishingPlatform, Preparation>>({ gleyo: emptyPreparation(), "zec-bounties": emptyPreparation() });
  const [step, setStep] = useState(initialProvider ? 1 : 0);
  const [errors, setErrors] = useState<Partial<Record<keyof Preparation, string>>>({});
  const [copyState, setCopyState] = useState("");
  const p = drafts[provider], platform = platformFor(provider), isGleyo = provider === "gleyo";
  const cover = resolveCover(p.art, "Community", p.title);
  const brief = preparationText(p, provider, cover);
  function update<K extends keyof Preparation>(key: K, value: Preparation[K]) {
    setDrafts((d) => ({ ...d, [provider]: { ...d[provider], [key]: value } }));
    setErrors((e) => ({ ...e, [key]: undefined })); setCopyState("");
  }
  function next(event: FormEvent) {
    event.preventDefault();
    if (step === 0) { setStep(1); return; }
    const found = validatePreparation(p, provider);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(2);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(brief); setCopyState("Brief copied. Continue on " + platform.name + "."); }
    catch { setCopyState("Copy is unavailable. Select and copy the text below."); }
  }
  return <div className="prepare-page">
    <Heading title="Prepare an activity" description="Choose a platform, bring a cover and prepare your brief." />
    <ol className="prepare-progress" aria-label="Preparation steps">{["Platform", "Brief & cover", "Take it with you"].map((name, index) => <li key={name} aria-current={step === index ? "step" : undefined}><span>{index + 1}</span>{name}</li>)}</ol>
    {step < 2 ? <form onSubmit={next} noValidate>
      {step === 0 ? <>
        <div className="prepare-platforms">{(["zec-bounties", "gleyo"] as const).map((id) => { const x = platformFor(id); return <button type="button" key={id} className="prepare-platform" aria-pressed={provider === id} onClick={() => setProvider(id)}><PlatformMark id={id} /><h2>{x.label}</h2><p>{x.description}</p><span className="op-text">{provider === id ? "Selected" : "Choose platform"}<Icon name={provider === id ? "checkcircle" : "arrow"} size={16} /></span></button>; })}</div>
        <p className="prepare-note">Your account, funding and publication stay with the chosen platform.</p>
      </> : <div className="prepare-layout"><section className="prepare-fields" aria-label="Activity brief">
        <div className="prepare-source"><PlatformMark id={provider} /><button type="button" className="op-text" onClick={() => setStep(0)}>Change platform</button></div>
        <Field label="Title" error={errors.title}><input value={p.title} maxLength={240} onChange={(e) => update("title", e.target.value)} required /></Field>
        <Field label={isGleyo ? "Community name (optional)" : "Team name (optional)"}><input value={p.community} maxLength={120} onChange={(e) => update("community", e.target.value)} /></Field>
        <Field label="Description" error={errors.description} hint="Explain the goal and what a contributor needs to know."><textarea rows={4} value={p.description} maxLength={6000} onChange={(e) => update("description", e.target.value)} required /></Field>
        <Field label={isGleyo ? "Tasks · up to 5" : "Expected deliverables"} error={errors.tasks} hint={isGleyo ? "One task per line. Configure verification on Gleyo." : "One deliverable per line, such as a PR, report or design."}><textarea rows={4} value={p.tasks} maxLength={3000} onChange={(e) => update("tasks", e.target.value)} required /></Field>
        <Field label={isGleyo ? "Review notes (optional)" : "Acceptance criteria"} error={errors.criteria}><textarea rows={3} value={p.criteria} maxLength={3000} onChange={(e) => update("criteria", e.target.value)} required={!isGleyo} /></Field>
        <div className="prepare-field-pair">
          <Field label={isGleyo ? "ZEC reward pool (optional)" : "Reward in ZEC"} error={errors.amount}><input inputMode="decimal" value={p.amount} maxLength={20} placeholder={isGleyo ? "Leave blank for XP only" : "0.05"} onChange={(e) => update("amount", e.target.value)} required={!isGleyo} /></Field>
          {isGleyo ? <Field label="XP (optional)" error={errors.xp}><input inputMode="numeric" value={p.xp} maxLength={10} onChange={(e) => update("xp", e.target.value)} /></Field> : <Field label="Deadline" error={errors.deadline}><input type="date" value={p.deadline} onChange={(e) => update("deadline", e.target.value)} required /></Field>}
        </div>
        {isGleyo && p.amount && <Field label="Reward recipients" error={errors.winners} hint="Confirm per-person amounts and reward availability on Gleyo."><input inputMode="numeric" value={p.winners} maxLength={8} onChange={(e) => update("winners", e.target.value)} /></Field>}
        {isGleyo && <Field label="Deadline (optional)" error={errors.deadline}><input type="date" value={p.deadline} onChange={(e) => update("deadline", e.target.value)} /></Field>}
        <Field label="Reference link (optional)" error={errors.reference}><input type="url" value={p.reference} maxLength={1000} placeholder="https://" onChange={(e) => update("reference", e.target.value)} /></Field>
        <div className="prepare-field-pair"><Field label="Language (optional)"><select value={p.language} onChange={(e) => update("language", e.target.value)}><option value="">Not specified</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></Field><Field label="Country / scope (optional)"><select value={p.country} onChange={(e) => update("country", e.target.value)}><option value="">Not specified</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></Field></div>
      </section><aside className="prepare-sidebar"><CoverPicker value={p.art} title={p.title} category="Community" onChange={(art) => update("art", art)} /><div className="prepare-source-note"><h2>Finish on {platform.name}</h2><p>{isGleyo ? "A community admin or editor creates the quest and configures its tasks and rewards." : "Create or suggest the bounty in your account. The platform handles approval, applications and delivery."}</p><a href={isGleyo ? platform.docs : "https://bounties.zechub.wiki/docs/creators"} target="_blank" rel="noopener noreferrer">Read the publishing guide <Icon name="external" size={14} /></a></div></aside></div>}
      <div className="prepare-actions">{step > 0 ? <button type="button" className="op-button" onClick={() => setStep(step - 1)}>Back</button> : <Link href={BASE} className="op-button">Back to opportunities</Link>}<button type="submit" className="op-button primary">{step === 0 ? "Prepare brief" : "Review & take to platform"}<Icon name="arrow" size={16} /></button></div>
      {Object.keys(errors).some((key) => errors[key as keyof Preparation]) && <p className="field-error" role="alert">Check the highlighted fields before continuing.</p>}
    </form> : <div className="prepare-handoff">
      <section><PlatformMark id={provider} /><h2>Your brief is ready to take to {platform.name}.</h2><p>Copy the text, download your cover and review both on the platform before publishing.</p><div className="prepare-actions"><button type="button" className="op-button primary" onClick={copy}><Icon name="copy" size={16} />Copy brief</button><a className="op-button" href={stockCoverUrl(cover)} download><Icon name="arrowdown" size={16} />Download cover</a></div><p role="status">{copyState}</p><Field label="Prepared brief"><textarea rows={16} readOnly value={brief} onFocus={(e) => e.target.select()} /></Field><button type="button" className="op-text" onClick={() => setStep(1)}>Edit brief</button></section>
      <aside><Illustration kind={cover} /><ol className="directory-steps"><li>Open {platform.name} and use your account there.</li><li>{isGleyo ? "Open your community’s quest editor, add the tasks and configure verification." : "Create or suggest a bounty, then add the title, scope, ZEC reward and deadline."}</li><li>Paste the brief. Add the cover where supported and review the final settings.</li></ol><a className="op-button primary full" href={platform.url} target="_blank" rel="noopener noreferrer">Continue to {platform.name}<Icon name="external" size={16} /></a><p className="prepare-note">Nothing has been submitted. Your draft stays in this tab until you leave.</p></aside>
    </div>}
  </div>;
}
