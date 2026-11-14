import type { ReactNode } from "react";

function icon(paths: ReactNode) {
  return function TreasuryIcon() {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
  };
}

export const CopyIcon = icon(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>);
export const DownloadIcon = icon(<><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></>);
export const IncomingIcon = icon(<path d="M18 6 6 18m0-9v9h9" />);
export const OutgoingIcon = icon(<path d="M6 18 18 6m-9 0h9v9" />);
export const ActivityIcon = icon(<><path d="M8 3v16m-4-4 4 4 4-4M16 21V5m-4 4 4-4 4 4" /></>);
export const ArrowIcon = icon(<path d="M4 12h16m-6-6 6 6-6 6" />);
