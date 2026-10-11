import type { ReactNode, SVGProps } from "react";

type NetworkIconName = "blocks" | "activity" | "privacy" | "network" | "mempool" | "mining" | "supply" | "halving" | "explorer" | "external" | "refresh" | "sun" | "moon" | "chevron" | "globe" | "apps" | "storage" | "exchange";

const icons: Record<NetworkIconName, ReactNode> = {
  storage: <><ellipse cx="12" cy="5" rx="8" ry="3" fill="currentColor" fillOpacity=".12" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
  exchange: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
  blocks: <>
    <path d="m4 7.5 8 4.5v9l-8-4.5Z" fill="currentColor" fillOpacity=".14" stroke="none" />
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm-8 4.5 8 4.5 8-4.5M12 12v9" />
  </>,
  activity: <>
    <path d="m4 13 4-4 4.5 5 4-7 3.5 3v10H4Z" fill="currentColor" fillOpacity=".1" stroke="none" />
    <path d="M4 4v16h16M4 13l4-4 4.5 5 4-7 3.5 3" />
    <circle cx="20" cy="10" r="1.2" fill="currentColor" stroke="none" />
  </>,
  privacy: <>
    <path d="m12 3 7.5 3v5c0 4.6-2.8 7.9-7.5 10-4.7-2.1-7.5-5.4-7.5-10V6Z" fill="currentColor" fillOpacity=".1" />
    <circle cx="12" cy="10.5" r="1.8" fill="currentColor" stroke="none" />
    <path d="M12 12v3" />
  </>,
  network: <>
    <path d="m7.2 6.6 7.6-1.2m2.6 1.8 1.2 7.6m-1.8 2.6-7.6 1.2m-2.6-1.8L5.4 9.2m1.4-.9 10.4 7.4" />
    <circle cx="5" cy="7" r="2.25" fill="currentColor" fillOpacity=".14" />
    <circle cx="17" cy="5" r="2.25" fill="currentColor" fillOpacity=".14" />
    <circle cx="19" cy="17" r="2.25" fill="currentColor" fillOpacity=".14" />
    <circle cx="7" cy="19" r="2.25" fill="currentColor" fillOpacity=".14" />
  </>,
  mempool: <>
    <path d="M3.5 15h5l1.5 2h4l1.5-2h5v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity=".14" stroke="none" />
    <path d="M6 9.5h12l2.5 5.5v3.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V15Zm-2.5 5.5h5l1.5 2h4l1.5-2h5" />
    <circle cx="7" cy="4.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="4.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="4.5" r="1.1" fill="currentColor" stroke="none" />
  </>,
  mining: <>
    <path d="m12.9 7.8-9.1 10.9a1 1 0 0 0 0 1.4l.6.6a1 1 0 0 0 1.4 0l9.8-11.4" />
    <path d="M3.5 6.5c5.7-4.3 13.3-2.7 17 3.5l-2.3 2c-3-4.1-8.1-6.1-14.7-5.5Z" fill="currentColor" fillOpacity=".14" />
  </>,
  supply: <>
    <ellipse cx="8.5" cy="6" rx="5.5" ry="2.75" fill="currentColor" fillOpacity=".1" />
    <path d="M3 6v5c0 1.5 2.5 2.75 5.5 2.75M3 11v5c0 1.5 2.5 2.75 5.5 2.75M14 6v2.25" />
    <circle cx="16" cy="15.5" r="5.5" fill="currentColor" fillOpacity=".14" />
    <path d="M14.25 13.5h3.5l-3.5 4h3.5" strokeWidth="1.5" />
  </>,
  halving: <>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" fillOpacity=".22" stroke="none" />
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
  </>,
  explorer: <>
    <circle cx="12" cy="12" r="9" />
    <path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" fill="currentColor" fillOpacity=".16" />
    <circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none" />
  </>,
  external: <><path d="M13 4h7v7M20 4 10 14M9 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4" /></>,
  refresh: <><path d="M20 4v5h-5M4 20v-5h5M19.2 9A7.5 7.5 0 0 0 6 6M4.8 15A7.5 7.5 0 0 0 18 18" /></>,
  sun: <><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".12" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>,
  moon: <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" fill="currentColor" fillOpacity=".1" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  apps: <><rect x="3.5" y="3.5" width="6" height="6" rx="1.3" fill="currentColor" fillOpacity=".14" /><rect x="14.5" y="3.5" width="6" height="6" rx="1.3" /><rect x="3.5" y="14.5" width="6" height="6" rx="1.3" /><rect x="14.5" y="14.5" width="6" height="6" rx="1.3" fill="currentColor" fillOpacity=".14" /></>,
};

/** A single optical grid for dashboard symbols and controls; labels live on their parent. */
export function NetworkIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: NetworkIconName }) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
