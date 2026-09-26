export function ZarvisMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M24 3 41 10v13c0 10-7 17-17 22C14 40 7 33 7 23V10L24 3Z" fill="currentColor" opacity=".12"/>
    <path d="M24 3 41 10v13c0 10-7 17-17 22C14 40 7 33 7 23V10L24 3Z" stroke="currentColor" strokeWidth="1.7"/>
    <rect x="12" y="15" width="24" height="17" rx="7" fill="currentColor"/>
    <path d="M18 21v3m12-3v3" stroke="var(--bg, #faf8f4)" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M21 27h6" stroke="var(--bg, #faf8f4)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M24 11v4m-5 22 10-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>;
}
