"use client";
/**
 * The marks the workspace chrome draws beside names: an app's logo or line
 * icon, a page's glyph, and the small stroke glyphs of the top bar. Shared by
 * the sidebar and the ⌘K palette.
 */
import type { ComponentType } from "react";
import { ZarvisMark } from "./zarvis/zarvis-mark";
import type { AppDef } from "@/lib/design-routes";
import {
  IconArrowUp,
  IconBalance,
  IconBook,
  IconChart,
  IconCalculator,
  IconCheck,
  IconCoins,
  IconDashboard,
  IconEcosystem,
  IconGlobe,
  IconGrant,
  IconGrid,
  IconKey,
  IconList,
  IconMail,
  IconNews,
  IconPencil,
  IconReceipt,
  IconShield,
  IconSigma,
  IconSwap,
  IconTerminal,
  IconUsers,
  IconVote,
  IconWallet,
} from "./icons";

type IconType = ComponentType<{ className?: string }>;

/** Line icons by key (apps without a logo) and by route (inner pages). */
const ICON_BY_KEY: Record<string, IconType> = {
  zarvis: ZarvisMark,
  book: IconBook,
  calculator: IconCalculator,
  news: IconNews,
  shield: IconShield,
  grant: IconGrant,
  balance: IconBalance,
  wallet: IconWallet,
  swap: IconSwap,
  chart: IconChart,
  terminal: IconTerminal,
  globe: IconGlobe,
  ecosystem: IconEcosystem,
  sigma: IconSigma,
  users: IconUsers,
  grid: IconGrid,
  key: IconKey,
};
const PAGE_ICON: Record<string, IconType> = {
  "/zcg/grants": IconGrant,
  "/zcg/proposals": IconVote,
  "/zcg/disbursements": IconReceipt,
  "/zcg/recipients": IconUsers,
  "/zcg/schedule": IconList,
  "/zcg/totals": IconChart,
  "/zcg/analytics": IconArrowUp,
  "/zcg/reconciliation": IconCheck,
  "/zcg/committee": IconUsers,
  "/zcg/meetings": IconBook,
  "/zcg/stipends": IconCoins,
  "/zcg/budget": IconBalance,
  "/zcg/office": IconDashboard,
  "/zcg/methodology": IconBook,
  "/zcg/copilot": IconTerminal,
  "/coinholders/fund": IconCoins,
  "/zcg/coinholder/copilot": IconTerminal,
  "/zechub/copilot": IconTerminal,
  "/development": IconTerminal,
  "/viewing-keys": IconKey,
  "/invites": IconMail,
  "/onboarding": IconPencil,
  "/login": IconShield,
};

export function Glyph({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d}></path>
    </svg>
  );
}
export const GLYPH = {
  menu: "M2.5 4h11M2.5 8h11M2.5 12h11",
  search: "M11 11l3 3M3 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0z",
  home: "M2.5 7.5L8 3l5.5 4.5V13H9.5V9.5h-3V13H2.5z",
  sun: "M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1",
  moon: "M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z",
  close: "M4 4l8 8M12 4l-8 8",
  chevron: "M6 4l4 4-4 4",
};

export function AppMark({ app, size = 18 }: { app: AppDef; size?: number }) {
  if (app.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={app.logo}
        alt=""
        width={size}
        height={size}
        className={
          app.logo.startsWith("/logos/marks/")
            ? "rd-side-logo rd-side-logo-glyph"
            : "rd-side-logo"
        }
      />
    );
  }
  const Icon = ICON_BY_KEY[app.icon] ?? IconGrid;
  return <Icon className="rd-side-icon" />;
}

export function PageMark({ mark, href }: { mark?: string; href: string }) {
  if (mark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={mark} alt="" width={15} height={15} className="rd-side-page-icon" />
    );
  }
  const Icon = PAGE_ICON[href];
  return Icon ? <Icon className="rd-side-icon" /> : <span className="rd-side-icon" aria-hidden />;
}
