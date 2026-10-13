"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

const TOUR_KEY = "participate-quick-tour-v1";
type TourStep = { target: string; title: string; description: string; path?: string };
const anchorFor = (step: TourStep) => document.querySelector<HTMLElement>(`[data-participate-tour="${step.target}"]`);

function hasSeenTour() {
  try { if (localStorage.getItem(TOUR_KEY)) return true; } catch { /* Storage can be restricted inside an embed. */ }
  try { return Boolean(sessionStorage.getItem(TOUR_KEY)); } catch { return false; }
}

function rememberTour() {
  try { localStorage.setItem(TOUR_KEY, "seen"); } catch { /* Fall back to the current browser session. */ }
  try { sessionStorage.setItem(TOUR_KEY, "seen"); } catch { /* The tour is still dismissible without storage. */ }
}

export function ParticipateTour({ signedIn, canUseCredits }: { signedIn: boolean; canUseCredits: boolean }) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const spotlight = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const exitTarget = useRef<HTMLElement | null>(null);
  const id = useId();
  const step = steps[index];
  const active = steps.length > 0;

  useEffect(() => {
    if (hasSeenTour()) return;
    const available: TourStep[] = [
      { target: "filters", title: "Find a proposal", description: "Switch between proposals under review, approved, rejected or withdrawn." },
      { target: "discussion", title: "Read, verify, discuss", description: "Open the record and sources, or expand comments below a proposal. Likes and discussions stay on this page." },
      { target: "account", title: signedIn ? canUseCredits ? "Your profile & credits" : "Your account" : "Join when you’re ready", description: signedIn
        ? canUseCredits ? "Open your profile for your name, photo, Zcred balance and settings." : "Open your account menu to view your session."
        : "Sign in here to participate. Your profile will hold your credits and settings.",
        ...(canUseCredits ? { path: "Profile → Credits" } : {}) }
    ];
    // First-visit preference and available anchors are only known after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSteps(available.filter(item => anchorFor(item)));
  }, [signedIn, canUseCredits]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!active || !element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    rememberTour(); // A refresh or return visit should not restart the introduction.
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      const focus = exitTarget.current ?? previousFocus;
      if (focus?.isConnected) focus.focus({ preventScroll: true });
    };
  }, [active]);

  useLayoutEffect(() => {
    const target = step && anchorFor(step);
    const panel = card.current;
    const light = spotlight.current;
    if (!target || !panel || !light) return;
    target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    heading.current?.focus({ preventScroll: true });

    function place() {
      if (!target || !panel || !light) return;
      const rect = target.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const margin = 16;
      const gap = 18;
      const cardWidth = Math.min(348, width - margin * 2);
      panel.style.width = `${cardWidth}px`;
      const cardHeight = panel.offsetHeight;
      const below = height - rect.bottom - gap;
      const above = rect.top - gap;
      const side = below >= cardHeight + margin || below >= above ? "below" : "above";
      const left = Math.max(margin, Math.min(rect.left, width - cardWidth - margin));
      const top = Math.max(margin, Math.min(side === "below" ? rect.bottom + gap : rect.top - cardHeight - gap, height - cardHeight - margin));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.dataset.side = side;
      panel.style.setProperty("--tour-pointer", `${Math.max(24, Math.min(rect.left + rect.width / 2 - left, cardWidth - 24))}px`);
      Object.assign(light.style, {
        left: `${Math.max(5, rect.left - 6)}px`, top: `${Math.max(5, rect.top - 6)}px`,
        width: `${Math.min(width - 10, rect.width + 12)}px`, height: `${Math.min(height - 10, rect.height + 12)}px`
      });
    }
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    observer?.observe(target);
    observer?.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step]);

  function dismiss(finished = false) {
    const target = step && anchorFor(step);
    exitTarget.current = finished ? target?.querySelector<HTMLElement>("button, a[href]") ?? null : null;
    setSteps([]);
  }

  if (!step) return null;
  return <dialog ref={dialog} className="participate-tour" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div ref={spotlight} className="participate-tour-spotlight" aria-hidden="true" />
    <div ref={card} className="participate-tour-card">
      <div className="participate-tour-top"><span>Quick tour <span aria-hidden="true">·</span> {index + 1} of {steps.length}</span><button type="button" onClick={() => dismiss()}>Skip</button></div>
      <div key={step.target} className="participate-tour-copy">
        <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{step.title}</h2>
        <p id={`${id}-description`}>{step.description}</p>
        {step.path ? <div className="participate-tour-path">{step.path}</div> : null}
      </div>
      <footer><div className="participate-tour-progress" aria-hidden="true">{steps.map((item, position) => <i key={item.target} data-current={position === index} />)}</div><div className="participate-tour-actions">{index > 0 ? <button type="button" className="participate-tour-back" onClick={() => setIndex(value => value - 1)}>Back</button> : null}<button type="button" className="dao-button dao-button--primary" onClick={() => index === steps.length - 1 ? dismiss(true) : setIndex(value => value + 1)}>{index === steps.length - 1 ? "Got it" : "Next"}<span aria-hidden="true">{index === steps.length - 1 ? "✓" : "→"}</span></button></div></footer>
    </div>
  </dialog>;
}
