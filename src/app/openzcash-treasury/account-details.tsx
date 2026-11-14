"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { IconBook, IconCheck, IconKey, IconWallet } from "@/components/icons";
import { copyText } from "@/components/copilot/copy-text";
import { TREASURY_ACCOUNT } from "@/lib/openzcash-treasury/account";
import { TREASURY_PATH, treasuryCopy } from "@/lib/openzcash-treasury/content";
import { ArrowIcon, CopyIcon, DownloadIcon } from "./treasury-icons";
import styles from "./treasury.module.css";

export function AccountDetails({ qrCode }: { qrCode: string }) {
  const t = treasuryCopy;
  const [feedback, setFeedback] = useState("");

  async function copy(kind: "address" | "key") {
    setFeedback("");
    const value = kind === "address" ? TREASURY_ACCOUNT.address : TREASURY_ACCOUNT.viewingKey;
    const copied = await copyText(value);
    setFeedback(copied ? (kind === "address" ? t.addressCopied : t.keyCopied) : t.copyFailed);
  }

  // The address and the key are shown whole, each in its own frame: a click selects all of it, so it can be copied by hand when the button cannot.
  return <>
    <section className={styles.supportSection} aria-labelledby="donate-title">
      <div className={styles.supportTitle}><span className={styles.supportIcon}><IconWallet /></span><h2 id="donate-title">{t.donate}</h2><span className={styles.network}>Mainnet</span></div>
      <p>{t.donateNote}</p>
      <div className={styles.donationDetails}>
        <a className={styles.qr} href={qrCode} download="openzcash-donation-qr.png" aria-label={t.saveQr}>
          <Image src={qrCode} width={200} height={200} alt={t.qrAlt} unoptimized />
          <span><DownloadIcon />{t.saveQr}</span>
        </a>
        <div className={styles.addressDetails}>
          <code className={styles.keyBox}>{TREASURY_ACCOUNT.address}</code>
          <button className={styles.copyButton} type="button" onClick={() => void copy("address")}>{feedback === t.addressCopied ? <IconCheck /> : <CopyIcon />}{feedback === t.addressCopied ? t.copied : t.copyAddress}</button>
        </div>
      </div>
      <p className={styles.donorNote}>{t.donorNote}</p>
      <Link className={styles.letterLink} href={`${TREASURY_PATH}/letter`}>
        <IconBook />
        <span><span>{t.letter}</span><strong>{t.letterTeaser}</strong><span>{t.letterNote}</span></span>
        <ArrowIcon />
      </Link>
    </section>
    <section className={styles.supportSection} aria-labelledby="verify-title">
      <div className={styles.supportTitle}><span className={styles.supportIcon}><IconKey /></span><h2 id="verify-title">{t.key}</h2></div>
      <p>{t.verifyNote}</p>
      <code className={styles.keyBox}>{TREASURY_ACCOUNT.viewingKey}</code>
      <div className={styles.keyActions}>
        <button className={styles.copyButton} type="button" onClick={() => void copy("key")}>{feedback === t.keyCopied ? <IconCheck /> : <CopyIcon />}{feedback === t.keyCopied ? t.copied : t.copyKey}</button>
        <p>{t.scanNote}</p>
      </div>
    </section>
    <p className={feedback === t.copyFailed ? styles.copyFeedback : "sr-only"} role="status">{feedback}</p>
  </>;
}
