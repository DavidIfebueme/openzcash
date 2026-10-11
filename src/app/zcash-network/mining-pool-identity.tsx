"use client";

import Image from "next/image";
import { useState } from "react";
import { NetworkIcon } from "./network-icons";
import s from "./network.module.css";

const poolLogos: Record<string, string> = {
  viabtc: "/logos/mining/viabtc.png",
  foundry: "/logos/mining/foundry.png",
  foundryusa: "/logos/mining/foundry.png",
  f2pool: "/logos/mining/f2pool.svg",
  luxor: "/logos/mining/luxor.ico",
  antpool: "/logos/mining/antpool.png",
  kryptex: "/logos/mining/kryptex.png",
  sluicey: "/logos/mining/sluicey.png",
  sluiceypool: "/logos/mining/sluicey.png",
};

export function MiningPoolIdentity({ name }: { name: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = poolLogos[name.toLowerCase().replace(/[^a-z0-9]/g, "")];
  const hasLogo = Boolean(source && source !== failedSource);

  return <span className={s.poolIdentity} title={name}>
    <span className={s.poolLogo} data-brand={hasLogo} aria-hidden="true">
      {hasLogo ? <Image src={source} alt="" width={16} height={16} unoptimized onError={() => setFailedSource(source)} /> : <NetworkIcon name={name === "Other pools" ? "network" : "mining"} />}
    </span>
    <span className={s.poolName}>{name}</span>
  </span>;
}
