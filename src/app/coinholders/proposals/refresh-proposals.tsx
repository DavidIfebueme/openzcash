"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./proposals.module.css";

export function RefreshProposals() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className={styles.refresh} type="button" disabled={pending} aria-label="Refresh proposals" onClick={() => startTransition(() => router.refresh())}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6a8 8 0 0 1 13.5 4M4.4 14a8 8 0 0 0 13.5 4" /></svg>
    <span role="status">{pending ? "Checking…" : "Refresh"}</span>
  </button>;
}
