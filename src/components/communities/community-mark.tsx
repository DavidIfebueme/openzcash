"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./community-mark.module.css";

export type CommunityMarkIdentity = {
  name: string;
  logo?: string;
  flag: string;
};

export function CommunityMark({ community, size = 32 }: {
  community: CommunityMarkIdentity;
  size?: number;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const logo = community.logo && community.logo !== failedSource ? community.logo : null;
  const label = logo ? `${community.name} community logo` : `${community.name} community`;

  return <span className={styles.mark} data-community-mark="true" style={{ width: size, height: size }} title={label}>
    {logo ? <Image className={styles.logo} key={logo} src={logo} width={size} height={size}
      alt={label} unoptimized onError={() => setFailedSource(logo)} />
      : <span className={styles.flag} role="img" aria-label={label} style={{ fontSize: size * 20 / 32 }}>{community.flag}</span>}
  </span>;
}
