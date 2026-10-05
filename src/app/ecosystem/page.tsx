import { Suspense } from "react";
import { EcosystemExplorer } from "@/components/ecosystem/explorer";
import { EcosystemOverview } from "@/components/ecosystem/overview";
import { loadEcosystemCatalog } from "@/lib/ecosystem/data";
import { explorerCatalog } from "@/lib/ecosystem/explorer-catalog";
import { ecosystemView, type EcosystemSearchParams } from "@/lib/ecosystem/overview-route";
import { pageMetadata } from "@/lib/seo/page-metadata";

// The explorer's headline count, from the same checked snapshot.
const PROJECTS = loadEcosystemCatalog().registry.projects.length;

export const metadata = pageMetadata({
  title: "Ecosystem · OpenZcash",
  description: "Inspect Zcash ecosystem activity, recent releases and evidence coverage. Explore source-linked project records, communities and organizations.",
  path: "/ecosystem",
  card: { stat: `${PROJECTS} projects & components` },
});

export default async function EcosystemPage({ searchParams }: { searchParams: Promise<EcosystemSearchParams> }) {
  const catalog = loadEcosystemCatalog();
  if (ecosystemView(await searchParams) === "overview") {
    return <EcosystemOverview catalog={catalog} />;
  }
  return (
    // useSearchParams inside the explorer needs a boundary for the static shell.
    <Suspense fallback={null}>
      <EcosystemExplorer catalog={explorerCatalog(catalog)} mode="ecosystem" />
    </Suspense>
  );
}
