"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ResponseDepth } from "@/lib/zarvis/depth";

const OPTIONS: { value: ResponseDepth; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Adapts to your question" },
  { value: "quick", label: "Quick", description: "Less reasoning, faster replies" },
  { value: "deep", label: "Deep analysis", description: "More reasoning for complex questions" },
];

function DepthIcon({ depth }: { depth: ResponseDepth }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {depth === "auto" ? <><path d="m10 3 1.9 5.1L17 10l-5.1 1.9L10 17l-1.9-5.1L3 10l5.1-1.9L10 3Z"/><path d="M16 2v3m-1.5-1.5h3"/></>
      : depth === "quick" ? <path d="m11.5 2-8 9h6l-1 7 8-10h-6l1-6Z"/>
      : <><path d="m10 2-7 4 7 4 7-4-7-4Z"/><path d="m3 10 7 4 7-4M3 14l7 4 7-4"/></>}
  </svg>;
}

export function ZarvisDepthSelect({ value, onChange, disabled = false }: {
  value: ResponseDepth;
  onChange: (value: ResponseDepth) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const selected = OPTIONS.findIndex((option) => option.value === value);
  const option = OPTIONS[selected];
  const open = focused !== null && !disabled;

  useEffect(() => {
    if (open && focused !== null) items.current[focused]?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setFocused(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() {
    setFocused(null);
    trigger.current?.focus();
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Resume the form's normal tab order from the menu button.
      close();
    } else {
      const next = event.key === "ArrowDown" ? ((focused ?? selected) + 1) % OPTIONS.length
        : event.key === "ArrowUp" ? ((focused ?? selected) + OPTIONS.length - 1) % OPTIONS.length
        : event.key === "Home" ? 0 : event.key === "End" ? OPTIONS.length - 1
        : event.key.length === 1 && /^[a-z]$/i.test(event.key)
          ? OPTIONS.findIndex((item) => item.label.toLowerCase().startsWith(event.key.toLowerCase())) : -1;
      if (next >= 0) { event.preventDefault(); setFocused(next); }
    }
  }

  return <div className="zarvis-depth" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
  }}>
    <button ref={trigger} type="button" className="zarvis-depth-trigger" disabled={disabled}
      aria-label={`Response depth: ${option.label}`} aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? `${id}-menu` : undefined}
      onClick={() => setFocused(open ? null : selected)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setFocused(selected);
        }
      }}>
      <DepthIcon depth={value}/><span>{option.label}</span>
      <svg className="zarvis-depth-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
    </button>
    {open ? <div className="zarvis-depth-menu" id={`${id}-menu`} role="menu" aria-labelledby={`${id}-label`} onKeyDown={navigate}>
      <div className="zarvis-depth-heading" id={`${id}-label`}>Response depth</div>
      {OPTIONS.map((item, index) => <button key={item.value} type="button" role="menuitemradio" tabIndex={-1}
        ref={(node) => { items.current[index] = node; }} className="zarvis-depth-option"
        aria-checked={value === item.value} aria-labelledby={`${id}-${item.value}-label`} aria-describedby={`${id}-${item.value}-description`}
        onFocus={() => setFocused(index)} onClick={() => { onChange(item.value); close(); }}>
        <span className="zarvis-depth-option-icon"><DepthIcon depth={item.value}/></span>
        <span className="zarvis-depth-option-copy"><span id={`${id}-${item.value}-label`}>{item.label}</span><small id={`${id}-${item.value}-description`}>{item.description}</small></span>
        <svg className="zarvis-depth-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>
      </button>)}
    </div> : null}
  </div>;
}
