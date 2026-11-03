import { notFound } from "next/navigation";
import { OpportunitiesRoutes } from "@/components/opportunities/routes";
import { opportunityRoute } from "@/components/opportunities/route";
import { pageMetadata } from "@/lib/seo/page-metadata";
type Props = { params: Promise<{ segments?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const record = opportunityRoute((await params).segments);
  if (!record) return {};
  return {
    ...pageMetadata({
      ...record,
      title: record.title + " · OpenZcash",
      card: {
        title: record.title,
        kicker: "Explore the read-only beta",
        stat: "27 opportunities",
        section: "Zcash Opportunities",
      },
    }),
    robots: { index: false, follow: true },
  };
}
export default async function Page({ params }: Props) {
  if (!opportunityRoute((await params).segments)) notFound();
  return <OpportunitiesRoutes />;
}
