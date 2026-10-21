/** Stateless navigation artwork shared by the portal and the isolated chat entry. */
import type { ComponentType } from "react";
import { OngoingTestIcon } from "./ongoing-test-icons";
import { NetworkIcon } from "@/app/zcash-network/network-icons";
import { IconPrivateChat, IconBook, IconMegaphone, IconCalculator, IconNews, IconShield, IconGrant, IconBalance, IconWallet, IconSwap, IconChart, IconTerminal, IconGlobe, IconEcosystem, IconSigma, IconUsers, IconGrid, IconKey } from "./icons";

type IconType = ComponentType<{ className?: string }>;

export const ICON_BY_KEY: Record<string, IconType> = {
  "private-chat": IconPrivateChat,
  experiment: (props) => <OngoingTestIcon name="experiment" {...props} />,
  network: (props) => <NetworkIcon name="network" {...props} />,
  book: IconBook,
  narratives: IconMegaphone,
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
export function NavigationIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_BY_KEY[name] ?? IconGrid;
  return <Icon className={className} />;
}
