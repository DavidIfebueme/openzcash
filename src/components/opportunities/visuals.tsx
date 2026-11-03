import Image from "next/image";
import { stockCoverUrl } from "./covers";
export function Icon({
  name,
  size = 18,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </>
    ),
    left: <path d="m14 6-6 6 6 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    filter: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" />
        <circle cx="15" cy="17" r="2" fill="currentColor" />
      </>
    ),
    bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
    check: <path d="m5 12 4 4 10-10" />,
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5" />
      </>
    ),
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-5-13-2 20" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V4h8v3M3 12c5 4 13 4 18 0M12 12v5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    document: (
      <>
        <path d="M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8M8 16h6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    moon: <path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-11v1" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    trophy: (
      <>
        <path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v6m-5 2h10m-8-2h6" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 8V4l14-2v3m4 7h-6v5h6" />
        <path d="M17 14.5h.01" />
      </>
    ),
    bell: (
      <>
        <path d="M5 17h14l-2-3V9A5 5 0 0 0 7 9v5l-2 3Zm5 4h4" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    sort: (
      <>
        <path d="M7 4v16m-4-4 4 4 4-4M14 5h7m-7 5h5m-5 5h3" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    pen: (
      <>
        <path d="m15 3 6 6-12 12H3v-6L15 3Zm-3 3 6 6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2v6m10-6v6M3 11h18" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H3v18h6m4-15 6 6-6 6m-6-6h12" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7V5Z" />,
    upload: (
      <>
        <path d="M12 17V3m-5 5 5-5 5 5M3 15v6h18v-6" />
      </>
    ),
    arrowdown: <path d="M12 4v16m-6-6 6 6 6-6" />,
    checkcircle: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
          transform="translate(1 0)"
        />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] ?? paths.spark}
    </svg>
  );
}

export function Coin({
  className = "",
  black = false,
}: {
  className?: string;
  black?: boolean;
}) {
  return (
    <span className={`zec-coin ${className}`} aria-hidden="true">
      <Image
        width={52}
        height={52}
        unoptimized
        src={
          black
            ? "/opportunities/zcash-official-black.svg"
            : "/opportunities/zcash-official-yellow.svg"
        }
        alt=""
      />
    </span>
  );
}

export function Illustration({
  kind,
  className = "",
}: {
  kind: string;
  className?: string;
}) {
  return (
    <Image
      className={`illustration ${className}`}
      src={stockCoverUrl(kind)}
      width={1536}
      height={1024}
      sizes="(max-width: 690px) 100vw, (max-width: 1180px) 50vw, 33vw"
      alt=""
    />
  );
}
