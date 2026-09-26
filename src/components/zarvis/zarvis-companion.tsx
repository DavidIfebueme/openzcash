"use client";
import { useEffect, useState } from "react";
import { useZarvis } from "./zarvis-provider";
import { ZarvisMark } from "./zarvis-mark";

export function ZarvisCompanion() {
  const { expression, motionPaused } = useZarvis();
  const [greeting, setGreeting] = useState(true);
  const [greetingId, setGreetingId] = useState(0);
  useEffect(() => {
    if (!greeting) return;
    const timer = setTimeout(() => setGreeting(false), 2400);
    return () => clearTimeout(timer);
  }, [greeting, greetingId]);
  return <div className="zarvis-companion">
    <button type="button" className="zarvis-hello" aria-label="Say hello to Zarvis" title="Say hello to Zarvis"
      onClick={() => { setGreeting(true); setGreetingId((id) => id + 1); }}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--zarvis-look-x", `${((event.clientX - box.left) / box.width - .5) * 8}px`);
        event.currentTarget.style.setProperty("--zarvis-look-y", `${((event.clientY - box.top) / box.height - .5) * 5}px`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--zarvis-look-x", "0px");
        event.currentTarget.style.setProperty("--zarvis-look-y", "0px");
      }}>
      <ZarvisMark key={greetingId} className="zarvis-hero-mark"
        expression={greeting ? "greeting" : expression}
        animated paused={motionPaused}/>
    </button>
    <ZarvisMotionToggle/>
  </div>;
}

export function ZarvisMotionToggle({ className = "zarvis-motion" }: { className?: string }) {
  const { motionPaused, toggleMotion } = useZarvis();
  return (
    <button type="button" className={className} onClick={toggleMotion}
      aria-label={motionPaused ? "Resume mascot animation" : "Pause mascot animation"}
      title={motionPaused ? "Resume mascot animation" : "Pause mascot animation"}>
      {motionPaused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 6 4-6 4Z" fill="currentColor"/></svg>
        : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4v8m5-8v8" stroke="currentColor" strokeWidth="2"/></svg>}
    </button>
  );
}
