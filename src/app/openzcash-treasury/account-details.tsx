"use client";

import Image from "next/image";
import { useState } from "react";
import { IconCheck, IconKey, IconWallet } from "@/components/icons";
import { copyText } from "@/components/copilot/copy-text";
import { TREASURY_ACCOUNT } from "@/lib/openzcash-treasury/account";
import { treasuryCopy } from "@/lib/openzcash-treasury/content";
import { CopyIcon, DownloadIcon } from "./treasury-icons";
import styles from "./treasury.module.css";

export function AccountDetails({ qrCode }: { qrCode: string }) {
  const t = treasuryCopy;
  const [feedback, setFeedback] = useState("");
  const [keyOpen, setKeyOpen] = useState(false);

  async function copy(kind: "address" | "key") {
    setFeedback("");
    const value = kind === "address" ? TREASURY_ACCOUNT.address : TREASURY_ACCOUNT.viewingKey;
    const copied = await copyText(value);
    if (!copied && kind === "key") setKeyOpen(true);
    setFeedback(copied ? (kind === "address" ? t.addressCopied : t.keyCopied) : t.copyFailed);
  }

  return <>
    <section className={styles.supportSection} aria-labelledby="donate-title">
      <div className={styles.supportTitle}><span className={styles.supportIcon}><IconWallet /></span><h2 id="donate-title">{t.donate}</h2><span className={styles.network}>Mainnet</span></div>
      <p>{t.donateNote}</p>
      <div className={styles.donationDetails}>
        <a className={styles.qr} href={qrCode} download="openzcash-donation-qr.png" aria-label={t.saveQr}>
          <Image src={qrCode} width={148} height={148} alt={t.qrAlt} unoptimized />
          <span><DownloadIcon />{t.saveQr}</span>
        </a>
        <div className={styles.addressDetails}>
          <code className={styles.address}>{TREASURY_ACCOUNT.address}</code>
          <button className={styles.copyButton} type="button" onClick={() => void copy("address")}>{feedback === t.addressCopied ? <IconCheck /> : <CopyIcon />}{feedback === t.addressCopied ? t.copied : t.copyAddress}</button>
        </div>
      </div>
      <p className={styles.donorNote}>{t.donorNote}</p>
      <p className={styles.donorNote}>{t.designationNote}</p>
    </section>
    <section className={styles.supportSection} aria-labelledby="verify-title">
      <div className={styles.supportTitle}><span className={styles.supportIcon}><IconKey /></span><h2 id="verify-title">{t.key}</h2></div>
      <p>{t.verifyNote}</p>
      <div className={styles.keyActions}>
        <code>{TREASURY_ACCOUNT.viewingKey.slice(0, 24)}…{TREASURY_ACCOUNT.viewingKey.slice(-10)}</code>
        <button className={styles.copyButton} type="button" onClick={() => void copy("key")}>{feedback === t.keyCopied ? <IconCheck /> : <CopyIcon />}{feedback === t.keyCopied ? t.copied : t.copyKey}</button>
      </div>
      <details className={styles.fullKey} open={keyOpen} onToggle={(event) => setKeyOpen(event.currentTarget.open)}>
        <summary>{t.showKey}</summary>
        <label className="sr-only" htmlFor="treasury-viewing-key">{t.key}</label>
        <textarea id="treasury-viewing-key" value={TREASURY_ACCOUNT.viewingKey} readOnly spellCheck={false} rows={5} />
        <p>{t.scanNote}</p>
      </details>
    </section>
    <p className={feedback === t.copyFailed ? styles.copyFeedback : "sr-only"} role="status">{feedback}</p>
  </>;
}
