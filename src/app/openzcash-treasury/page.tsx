import Link from "next/link";
import QRCode from "qrcode";
import { IconBook } from "@/components/icons";
import { CommunityCredit } from "@/components/community-credit";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { COMMUNITY_DISCUSSION, TREASURY_PATH, treasuryCopy } from "@/lib/openzcash-treasury/content";
import { TREASURY_ACCOUNT } from "@/lib/openzcash-treasury/account";
import { AccountDetails } from "./account-details";
import { TreasuryLedger } from "./ledger";
import { readTreasuryFeed } from "@/lib/openzcash-treasury/store";
import { ArrowIcon } from "./treasury-icons";
import styles from "./treasury.module.css";

export const metadata = pageMetadata({
  title: "OpenZcash Treasury",
  description: "Support OpenZcash with ZEC, inspect the public viewing key and read our open letter to the community.",
  path: TREASURY_PATH,
});

// The balance comes from a snapshot file read on each request, never from the build.
export const dynamic = "force-dynamic";

export default async function OpenZcashTreasury() {
  const t = treasuryCopy;
  // Encode the exact donation address locally; no third-party QR service.
  const qrCode = await QRCode.toDataURL(TREASURY_ACCOUNT.address);
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><h1>OpenZcash <span>Treasury.</span></h1><p>{t.intro}</p></div>
    </header>

    <div className={styles.dashboard}>
      <TreasuryLedger initialFeed={await readTreasuryFeed()} />

      <div className={styles.support} id="support">
        <AccountDetails qrCode={qrCode} />
        <details className={styles.disclosure}>
          <summary>{t.transparency}<span aria-hidden="true">+</span></summary>
          <div>
            <p>{t.overviewNote}</p>
            <p>{t.disclosure}</p>
            <p>{t.scope} <a href="https://zips.z.cash/zip-0316#terminology" target="_blank" rel="noopener noreferrer">ZIP 316 ↗</a></p>
          </div>
        </details>
      </div>
    </div>

    <div className={styles.nextSteps}>
      <Link className={styles.letterCard} href={`${TREASURY_PATH}/letter`}>
        <IconBook />
        <div><span>{t.letter}</span><h2>{t.letterTeaser}</h2></div>
        <span className={styles.arrow}><ArrowIcon /></span>
      </Link>
      <section className={styles.join} aria-labelledby="join-title">
        <h2 id="join-title">{t.join}</h2>
        <div className={styles.joinActions}>
          <a className={styles.primary} href={COMMUNITY_DISCUSSION} target="_blank" rel="noopener noreferrer">{t.collaborate}<ArrowIcon /></a>
          <Link className={styles.textLink} href="/opportunities">{t.opportunities}<ArrowIcon /></Link>
        </div>
      </section>
    </div>
    <CommunityCredit screen="openzcash-treasury" />
  </div>;
}
