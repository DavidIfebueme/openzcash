import { pageMetadata } from "@/lib/seo/page-metadata";
import Link from "next/link";
import { CrosslinkGuide } from "../crosslink-guide";
import styles from "../ongoing-test.module.css";

export const metadata = { ...pageMetadata({
  title: "Crosslink · OpenZcash",
  description: "Explore Crosslink: a practical testing guide, community tools and incentive updates.",
  path: "/ongoing-test/crosslink",
}), alternates: { canonical: "/ongoing-test/crosslink" } };
export default async function OngoingTestPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab;
  const initialTab = tab === "incentives" ? "Incentives" : tab === "tools" ? "Community tools" : "Participate";
  return <div className={styles.page}>
    <Link href="/opportunities" className={styles.returnLink}>← Back to opportunities</Link>
    <h1 className={styles.linkHint}>Crosslink test guide</h1>
    <CrosslinkGuide key={initialTab} initialTab={initialTab} />
  </div>;
}
