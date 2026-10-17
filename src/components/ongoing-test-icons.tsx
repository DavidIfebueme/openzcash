/** Original OpenZcash pictograms: 24px grid, rounded strokes, gold ink and wash. */
export type OngoingTestIconName = "experiment" | "tools" | "rewards" | "shield" | "finalizer" | "phone";

export function OngoingTestIcon({ name, className }: { name: OngoingTestIconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink, #92600f)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "experiment" && <>
      <path d="M9 3h6m-5 0v7l-5.5 8.5A2.2 2.2 0 0 0 6.4 22h11.2a2.2 2.2 0 0 0 1.9-3.5L14 10V3" />
      <path d="m7.4 15.5-2.9 4.4c-.4.6 0 1.3.7 1.3h13.6c.7 0 1.1-.7.7-1.3l-2.9-4.4Z" fill="var(--accent-soft, #b7791f1a)" stroke="none" />
      <path d="M8 15.5h8M9 18.5h2m3 0h1" /><path d="M11.5 7h1" />
    </>}
    {name === "tools" && <>
      <rect x="3" y="7" width="18" height="14" rx="3" fill="var(--accent-soft, #b7791f1a)" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h7m4 0h7" />
      <rect x="10" y="10" width="4" height="5" rx="1" fill="var(--surface, #fff)" />
      <path d="M8 18h8" />
    </>}
    {name === "rewards" && <>
      <path d="M18 5a9 9 0 0 1 0 16" />
      <circle cx="10.5" cy="11.5" r="8.5" fill="var(--accent-soft, #b7791f1a)" />
      <path d="M7.5 8h6l-6 7h6m-3-9v2m0 7v2" strokeWidth="2" />
    </>}
    {name === "finalizer" && <>
      <rect x="4" y="3" width="16" height="12" rx="2.5" fill="var(--accent-soft, #b7791f1a)" />
      <path d="M9 21h6m-3-6v6m-4-11 2.5 2.5L16 7" />
    </>}
    {name === "phone" && <>
      <rect x="6" y="2" width="12" height="20" rx="3" fill="var(--accent-soft, #b7791f1a)" />
      <path d="M10 5h4m-3 14h2" />
    </>}
    {name === "shield" && <>
      <path d="M12 2.5 21 6v5.5c0 5-3.7 8.4-9 11-5.3-2.6-9-6-9-11V6Z" fill="var(--accent-soft, #b7791f1a)" />
      <path d="m8 12 2.5 2.5L16 9" strokeWidth="2" />
    </>}
  </svg>;
}
