import { notFound, redirect } from "next/navigation";
import { OpportunitiesRoutes } from "@/components/opportunities/routes";
import { opportunityRoute, legacyOpportunityRedirect } from "@/components/opportunities/route";
import { getCatalog } from "@/components/opportunities/catalog.server";
import { pageMetadata } from "@/lib/seo/page-metadata";
type Props = { params: Promise<{ segments?: string[] }>; searchParams: Promise<{ tab?: string }> };
export async function generateMetadata({ params }: Props) {
  const segments = (await params).segments;
  const record = opportunityRoute(segments, (await getCatalog()).items);
  if (!record) return {};
  return { ...pageMetadata({ ...record, title: record.title + " · OpenZcash", card: { title: record.title, kicker: "Discover. Prepare. Participate.", stat: "Across the ecosystem", section: "Zcash Opportunities" } }), robots: { index: false, follow: true } };
}
export default async function Page({ params, searchParams }: Props) {
  const segments = (await params).segments || [];
  const legacy = legacyOpportunityRedirect(segments);
  if (legacy) redirect(legacy);
  const { tab } = await searchParams;
  if (!segments.length && ["activity", "campaigns", "communities"].includes(tab || "")) redirect("/opportunities/platforms");
  const catalog = await getCatalog();
  if (!opportunityRoute(segments, catalog.items)) notFound();
  return <OpportunitiesRoutes catalog={catalog} />;
}
