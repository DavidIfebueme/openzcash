"use client";

import { useEffect, useState } from "react";
import {
  NETWORK_REFRESH_MS, NETWORK_STATUS_PATH, NYM_EXPLORER_URL, NYM_STATUS_URL,
  networkHealthSchema, networkHealthState, type NetworkHealth, type NetworkHealthState,
} from "@/lib/private-chat/network-health";
import styles from "./chat-network-status.module.css";

const healthLabels = { ok: "Checks passing", degraded: "Needs attention", down: "Unavailable", unknown: "Partial data" };
const gatewayLabels = {
  eligible: "Topology score", "below-minimum": "Below SDK minimum", "not-listed": "Not in topology",
  unconfigured: "Not configured", unavailable: "Data unavailable",
};

function Tile({ label, value, detail, state }: { label: string; value: string; detail: string; state: NetworkHealthState }) {
  return <div className={styles.tile} data-state={state}>
    <span className={styles.label}>{label}</span>
    <strong><i className={styles.dot} aria-hidden="true" />{value}</strong>
    <small>{detail}</small>
  </div>;
}

export function ChatNetworkStatus() {
  const [data, setData] = useState<NetworkHealth | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stopped = false;
    let active: AbortController | null = null;
    let lastAttempt = -Infinity;
    async function refresh() {
      if (document.hidden || active || Date.now() - lastAttempt < NETWORK_REFRESH_MS) return;
      lastAttempt = Date.now();
      active = new AbortController();
      const timeout = setTimeout(() => active?.abort(), 25_000);
      try {
        const response = await fetch(NETWORK_STATUS_PATH, {
          credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: active.signal,
        });
        const parsed = response.ok ? networkHealthSchema.safeParse(await response.json()) : null;
        if (!stopped) setData(parsed?.success && Math.abs(Date.now() - parsed.data.checkedAt) < 180_000 ? parsed.data : null);
      } catch {
        if (!stopped) setData(null);
      } finally {
        clearTimeout(timeout);
        active = null;
        if (!stopped) setLoading(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), NETWORK_REFRESH_MS);
    const visible = () => {
      if (!document.hidden) {
        setData(current => current && Date.now() - current.checkedAt < 180_000 ? current : null);
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);

  const state = networkHealthState(data);
  const summary = loading ? "Checking…" : data ? healthLabels[state] : "Status unavailable";
  const service = (key: keyof NetworkHealth["services"], label: string, detail: string) => {
    const item = data?.services[key];
    return <Tile label={label} value={item?.total ? `${item.up}/${item.total}` : "—"}
      detail={item?.state === "unknown" || !item ? "Data unavailable" : detail} state={item?.state ?? "unknown"} />;
  };
  return <details className={styles.panel}>
    <summary aria-label={`Nym network status: ${summary}`}>
      <span className={styles.summaryText}><strong>Nym network</strong><span data-state={state}><i className={styles.dot} aria-hidden="true" />{summary}</span></span>
      <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </summary>
    <div className={styles.content}>
      <div className={styles.grid}>
        {service("validators", "Validators", "Nyx RPC checks")}
        {service("signers", "Signers", "Checks passing")}
        {service("api", "APIs", "Checks passing")}
        <Tile label="Mix nodes" value={data?.mixnodes.count?.toLocaleString("en-US") ?? "—"} detail="Active set" state={data?.mixnodes.state ?? "unknown"} />
        <Tile label="Gateways" value={data?.gateways.count?.toLocaleString("en-US") ?? "—"} detail="Listed entry nodes" state={data?.gateways.state ?? "unknown"} />
        <Tile label="Chat gateway" value={data?.gateway.performance != null ? `${data.gateway.performance}%` : "—"} detail={data ? gatewayLabels[data.gateway.reason] : "Data unavailable"} state={data?.gateway.state ?? "unknown"} />
      </div>
      <p className={styles.caption}>Public network checks. Your connection is shown above.</p>
      <div className={styles.sources}>
        <a href={NYM_STATUS_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Nym Status ↗</a>
        <a href={NYM_EXPLORER_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Explorer ↗</a>
      </div>
      <span className={styles.updated}>{data ? <>Checked <time dateTime={new Date(data.checkedAt).toISOString()}>{new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time> · every 2 min</> : loading ? "Checking official sources…" : "Retrying automatically"}</span>
    </div>
  </details>;
}
