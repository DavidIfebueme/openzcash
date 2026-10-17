import { pageMetadata } from "@/lib/seo/page-metadata";
import { CrosslinkGuide } from "../crosslink-guide";
import styles from "../ongoing-test.module.css";

export const metadata = { ...pageMetadata({
  title: "Crosslink · OpenZcash",
  description: "Explore Crosslink: a practical testing guide, community tools and incentive updates.",
  path: "/ongoing-test/crosslink",
}), alternates: { canonical: "/ongoing-test/crosslink" } };
export default function OngoingTestPage() {
  return <div className={styles.page}>
    <h1 className={styles.linkHint}>Crosslink test guide</h1>
    <CrosslinkGuide />
  </div>;
}
