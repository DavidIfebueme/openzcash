import { PROGRAM } from "@/lib/coinholder/program";
import { readCoinholderDashboard } from "@/lib/coinholder/analytics/server";
import { CoinholderDashboardView } from "@/components/coinholder-analytics/dashboard";
import { pageMetadata } from "@/lib/seo/page-metadata";
import "./analytics.css";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: `${PROGRAM.officialName} · OpenZcash`,
  description: "Explore Q3 2026 Coinholder voting activity: recorded casts, daily revealed shares, final ZEC weights and proposal decisions, with verifiable sources.",
  path: "/coinholders",
  card: { title: "Coinholder Grants" },
});

export default async function CoinholdersPage() {
  return <CoinholderDashboardView initial={await readCoinholderDashboard()} />;
}
